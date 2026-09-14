import type { Snapshot } from "./tipos";

export const BUCKET_MEDIA = "fotos";
/** El escudo del club no está referenciado en ninguna tabla: vive en una ruta fija del bucket. */
export const CLAVE_ESCUDO_CLUB = "escudo_club.webp";

const MARCA_PUBLICA = `/storage/v1/object/public/${BUCKET_MEDIA}/`;

/** URL pública de Supabase Storage → clave relativa (`escudos/<uuid>.webp`). */
export function claveMediaDesdeUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const inicio = url.indexOf(MARCA_PUBLICA);
  if (inicio < 0) throw new Error(`URL de media fuera del bucket "${BUCKET_MEDIA}": ${url}`);
  const [ruta = ""] = url.slice(inicio + MARCA_PUBLICA.length).split("?");
  const clave = decodeURIComponent(ruta);
  // `\` no separa segmentos aquí, pero path.join la trata como separador en Windows:
  // sin este rechazo, una clave como "..\\..\\evil" escaparía del directorio de media.
  if (clave.includes("\\")) throw new Error(`Clave de media inválida: ${url}`);
  const segmentos = clave.split("/");
  if (segmentos.some((segmento) => segmento === "" || segmento === "." || segmento === "..")) {
    throw new Error(`Clave de media inválida: ${url}`);
  }
  return clave;
}

/** Claves de todos los ficheros referenciados más el escudo del club. */
export function clavesMedia(snapshot: Snapshot): Set<string> {
  const urls = [
    ...snapshot.equipos.map((equipo) => equipo.escudo_url),
    ...snapshot.jugadores.map((jugador) => jugador.foto_url),
    ...snapshot.staff_club.map((miembro) => miembro.foto_url),
    ...snapshot.patrocinadores.map((patrocinador) => patrocinador.logo_url),
    ...snapshot.cartel_assets.filter((asset) => asset.tipo !== "config").map((asset) => asset.url),
  ];
  const claves = new Set<string>([CLAVE_ESCUDO_CLUB]);
  for (const url of urls) {
    const clave = claveMediaDesdeUrl(url);
    if (clave) claves.add(clave);
  }
  return claves;
}
