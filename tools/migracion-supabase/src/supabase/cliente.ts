import { BUCKET_MEDIA } from "../snapshot/media";
import type { TablaOrigen } from "../snapshot/tipos";

export interface ConfigSupabase {
  url: string;
  claveServicio: string;
}

export type Fetch = typeof fetch;

const TAMANO_PAGINA = 1000;

/** Orden estable para paginar; las tablas sin `id` usan su clave natural. */
const ORDEN: Partial<Record<TablaOrigen, string>> = {
  competicion_etiquetas: "competicion_id,etiqueta",
};

export function leerConfig(rutaEnv: string): ConfigSupabase {
  process.loadEnvFile(rutaEnv);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const claveServicio = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !claveServicio) {
    throw new Error(`Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en ${rutaEnv}.`);
  }
  return { url: url.replace(/\/+$/, ""), claveServicio };
}

const cabeceras = (config: ConfigSupabase) => ({
  apikey: config.claveServicio,
  Authorization: `Bearer ${config.claveServicio}`,
});

/**
 * Extrae el total de `Content-Range` (formato PostgREST `inicio-fin/total`, o un asterisco en
 * vez del rango cuando no hay filas). Devuelve `undefined` si la cabecera falta o el total en sí
 * es un asterisco (desconocido).
 */
function totalDesdeContentRange(valor: string | null): number | undefined {
  if (!valor) return undefined;
  const total = valor.split("/")[1];
  if (!total || total === "*") return undefined;
  const numero = Number(total);
  return Number.isFinite(numero) ? numero : undefined;
}

/** Lee todas las filas de una tabla vía PostgREST (máximo 1.000 por petición). Solo GET. */
export async function leerTabla(
  config: ConfigSupabase,
  tabla: TablaOrigen,
  fetchImpl: Fetch = fetch,
): Promise<unknown[]> {
  const filas: unknown[] = [];
  const orden = ORDEN[tabla] ?? "id";
  let total: number | undefined;
  for (let desde = 0; ; desde += TAMANO_PAGINA) {
    const respuesta = await fetchImpl(`${config.url}/rest/v1/${tabla}?select=*&order=${orden}`, {
      headers: {
        ...cabeceras(config),
        Range: `${desde}-${desde + TAMANO_PAGINA - 1}`,
        Prefer: "count=exact",
      },
    });
    if (!respuesta.ok) throw new Error(`Lectura de ${tabla}: HTTP ${respuesta.status}.`);
    total = totalDesdeContentRange(respuesta.headers.get("Content-Range")) ?? total;
    const pagina: unknown = await respuesta.json();
    if (!Array.isArray(pagina))
      throw new Error(`Lectura de ${tabla}: la respuesta no es una lista.`);
    filas.push(...pagina);
    if (pagina.length < TAMANO_PAGINA) break;
  }
  // PostgREST puede recortar en silencio (p. ej. límites del proxy): si el total declarado no
  // coincide con lo leído, es mejor abortar la migración que continuar con datos incompletos.
  if (total !== undefined && filas.length !== total) {
    throw new Error(`Lectura de ${tabla}: se leyeron ${filas.length} filas de ${total}.`);
  }
  return filas;
}

export async function descargarMedia(
  config: ConfigSupabase,
  clave: string,
  fetchImpl: Fetch = fetch,
): Promise<Uint8Array> {
  const ruta = clave.split("/").map(encodeURIComponent).join("/");
  const respuesta = await fetchImpl(
    `${config.url}/storage/v1/object/public/${BUCKET_MEDIA}/${ruta}`,
    { headers: cabeceras(config) },
  );
  if (!respuesta.ok) throw new Error(`Descarga de media "${clave}": HTTP ${respuesta.status}.`);
  return new Uint8Array(await respuesta.arrayBuffer());
}
