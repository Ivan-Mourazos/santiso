import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { type Client, createClient } from "@libsql/client";
import { DIR_BACKUPS, DIR_MEDIA, marcaFichero, urlArchivo } from "./rutas";

export interface ManifiestoCopia {
  formato: 1;
  fecha: string;
  migracion: { hash: string; aplicadaEn: number } | null;
  media: { ficheros: number; bytes: number };
  mediaFaltante: string[];
}

export interface VerificacionCopia {
  ruta: string;
  ok: boolean;
  errores: string[];
  mediaFaltante: string[];
}

const ES_COPIA = /^santiso-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/;

/** Solo carpetas publicadas del formato nuevo; nunca los antiguos .db ni temporales. */
export function listarCopiasCompletas(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter(
      (entrada) =>
        entrada.isDirectory() &&
        ES_COPIA.test(entrada.name) &&
        existsSync(path.join(dir, entrada.name, "manifiesto.json")),
    )
    .map((entrada) => path.join(dir, entrada.name))
    .sort();
}

function inventarioMedia(dir: string): ManifiestoCopia["media"] {
  const total = { ficheros: 0, bytes: 0 };
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const ruta = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      const parte = inventarioMedia(ruta);
      total.ficheros += parte.ficheros;
      total.bytes += parte.bytes;
    } else if (entrada.isFile()) {
      total.ficheros++;
      total.bytes += statSync(ruta).size;
    } else {
      throw new Error(`Media contiene un enlace o fichero especial: ${ruta}`);
    }
  }
  return total;
}

/** Lee la instantánea, no la BD que sigue cambiando. DETACH libera su fichero en Windows. */
async function inspeccionarBd(ruta: string) {
  if (!statSync(ruta).isFile()) throw new Error("Falta santiso.db.");
  const lector = createClient({ url: ":memory:" });
  let adjunta = false;
  try {
    await lector.execute({
      sql: "ATTACH DATABASE ? AS copia",
      args: [`${urlArchivo(ruta)}?mode=ro`],
    });
    adjunta = true;
    const integridad = await lector.execute("PRAGMA copia.integrity_check");
    const foraneas = await lector.execute("PRAGMA copia.foreign_key_check");
    const errores = integridad.rows
      .filter((fila) => fila[0] !== "ok")
      .map((fila) => String(fila[0]));
    if (foraneas.rows.length)
      errores.push(`${foraneas.rows.length} referencias de clave foránea inválidas.`);
    const migracion = (
      await lector.execute(
        "SELECT hash, created_at FROM copia.__drizzle_migrations ORDER BY created_at DESC LIMIT 1",
      )
    ).rows[0];
    const referencias = await lector.execute(`
      SELECT escudo AS clave FROM copia.equipos WHERE escudo IS NOT NULL
      UNION SELECT foto FROM copia.jugadores_temporada WHERE foto IS NOT NULL
      UNION SELECT foto FROM copia.staff_temporada WHERE foto IS NOT NULL
      UNION SELECT logo FROM copia.patrocinadores WHERE logo IS NOT NULL
      UNION SELECT clave FROM copia.fotos_partido
      UNION SELECT json_extract(valor, '$') FROM copia.ajustes
        WHERE id IN ('club.escudo', 'cartel.logo_xunta', 'cartel.logo_rfgf')
    `);
    return {
      errores,
      claves: referencias.rows.map((fila) => String(fila[0])).sort(),
      migracion: migracion
        ? { hash: String(migracion.hash), aplicadaEn: Number(migracion.created_at) }
        : null,
    };
  } finally {
    try {
      if (adjunta) await lector.execute("DETACH DATABASE copia");
    } finally {
      lector.close();
    }
  }
}

function mediaFaltante(claves: string[], dir: string): string[] {
  return claves.filter((clave) => {
    const partes = clave.split("/");
    if (partes.some((parte) => !parte || parte === "." || parte === ".." || /[\\:\0]/.test(parte)))
      return true;
    try {
      return !statSync(path.join(dir, ...partes)).isFile();
    } catch {
      return true;
    }
  });
}

/** BD consistente con VACUUM INTO y media inmutable. Publica la carpeta solo al terminar. */
export async function copiarBd(
  cliente: Client,
  dirDestino = DIR_BACKUPS,
  fecha = new Date(),
  dirMedia = DIR_MEDIA,
): Promise<string> {
  mkdirSync(dirDestino, { recursive: true });
  const nombre = `santiso-${marcaFichero(fecha)}`;
  const destino = path.join(dirDestino, nombre);
  const temporal = path.join(dirDestino, `.${nombre}.tmp`);
  if (existsSync(destino)) throw new Error(`Ya existe la copia ${destino}.`);
  mkdirSync(temporal);
  try {
    const rutaBd = path.join(temporal, "santiso.db");
    await cliente.execute({ sql: "VACUUM INTO ?", args: [rutaBd] });
    const datos = await inspeccionarBd(rutaBd);
    if (datos.errores.length) throw new Error(datos.errores.join(" "));
    const media = path.join(temporal, "media");
    // Una instalación sin imágenes todavía puede no tener directorio de media.
    if (existsSync(dirMedia))
      cpSync(dirMedia, media, { recursive: true, errorOnExist: true, force: false });
    else mkdirSync(media);
    const manifiesto: ManifiestoCopia = {
      formato: 1,
      fecha: fecha.toISOString(),
      migracion: datos.migracion,
      media: inventarioMedia(media),
      mediaFaltante: mediaFaltante(datos.claves, media),
    };
    writeFileSync(
      path.join(temporal, "manifiesto.json"),
      JSON.stringify(manifiesto, null, 2) + "\n",
    );
    renameSync(temporal, destino);
    return destino;
  } catch (error) {
    rmSync(temporal, { recursive: true, force: true });
    throw error;
  }
}

/** Restaura en os.tmpdir; jamás abre ni modifica la BD de uso diario. */
export async function verificarCopia(ruta: string): Promise<VerificacionCopia> {
  const resultado: VerificacionCopia = { ruta, ok: false, errores: [], mediaFaltante: [] };
  const temporal = mkdtempSync(path.join(tmpdir(), "santiso-restauracion-"));
  try {
    const restaurada = path.join(temporal, "copia");
    cpSync(ruta, restaurada, { recursive: true, errorOnExist: true, force: false });
    const manifiesto: ManifiestoCopia = JSON.parse(
      readFileSync(path.join(restaurada, "manifiesto.json"), "utf8"),
    );
    if (manifiesto.formato !== 1 || !Number.isFinite(Date.parse(manifiesto.fecha)))
      throw new Error("Manifiesto inválido.");
    const datos = await inspeccionarBd(path.join(restaurada, "santiso.db"));
    resultado.errores.push(...datos.errores);
    const media = path.join(restaurada, "media");
    const inventario = inventarioMedia(media);
    resultado.mediaFaltante = mediaFaltante(datos.claves, media);
    if (resultado.mediaFaltante.length)
      resultado.errores.push(
        `Faltan ${resultado.mediaFaltante.length} ficheros de media referenciados.`,
      );
    if (
      inventario.ficheros !== manifiesto.media.ficheros ||
      inventario.bytes !== manifiesto.media.bytes
    )
      resultado.errores.push("El inventario de media no coincide con el manifiesto.");
    if (JSON.stringify(datos.migracion) !== JSON.stringify(manifiesto.migracion))
      resultado.errores.push("La migración no coincide con el manifiesto.");
    resultado.ok = resultado.errores.length === 0;
  } catch (error) {
    resultado.errores.push(error instanceof Error ? error.message : String(error));
  } finally {
    rmSync(temporal, { recursive: true, force: true });
  }
  return resultado;
}

/** Busca también las diarias; las fechas ISO permiten ordenar manuales y automáticas juntas. */
export function ultimaCopia(dir = DIR_BACKUPS): string | null {
  return (
    [...listarCopiasCompletas(dir), ...listarCopiasCompletas(path.join(dir, "diarias"))].sort(
      (a, b) => path.basename(b).localeCompare(path.basename(a)),
    )[0] ?? null
  );
}

/** Estado verificable para Inicio, sin depender de la BD real. */
export async function ultimaCopiaValida(
  dir = DIR_BACKUPS,
): Promise<{ ruta: string; fecha: string; ok: true } | null> {
  const rutas = [
    ...listarCopiasCompletas(dir),
    ...listarCopiasCompletas(path.join(dir, "diarias")),
  ].sort((a, b) => path.basename(b).localeCompare(path.basename(a)));
  for (const ruta of rutas) {
    if ((await verificarCopia(ruta)).ok) {
      const manifiesto: ManifiestoCopia = JSON.parse(
        readFileSync(path.join(ruta, "manifiesto.json"), "utf8"),
      );
      return { ruta, fecha: manifiesto.fecha, ok: true };
    }
  }
  return null;
}
