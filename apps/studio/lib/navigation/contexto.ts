export const SECCIONES = [
  { id: "jornada", label: "Jornada", grupo: "Competición" },
  { id: "calendario", label: "Calendario", grupo: "Competición" },
  { id: "clasificacion", label: "Clasificación", grupo: "Competición" },
  { id: "estadisticas", label: "Estadísticas", grupo: "Competición" },
  { id: "jugadores", label: "Jugadores", grupo: "Plantilla" },
  { id: "tecnicos", label: "Cuerpo técnico", grupo: "Plantilla" },
  { id: "directiva", label: "Directiva", grupo: "Plantilla" },
  { id: "multas", label: "Multas", grupo: "Plantilla" },
  { id: "convocatoria", label: "Convocatoria", grupo: "Producción" },
  { id: "alineacion", label: "Alineación", grupo: "Producción" },
  { id: "carteles", label: "Carteles", grupo: "Producción" },
  { id: "importar", label: "Importar", grupo: "Producción" },
  // Siguen teniendo dirección propia (enlaces desde Jornada, lote, calendario PDF), pero se
  // entra por «Importar»: no salen en el menú.
  { id: "actas", label: "Actas", grupo: "Producción", oculta: true },
  { id: "importar-jornada", label: "Importar jornada", grupo: "Producción", oculta: true },
  { id: "equipos", label: "Equipos", grupo: "Catálogos" },
  { id: "patrocinadores", label: "Patrocinadores y logos", grupo: "Catálogos" },
  { id: "temporadas", label: "Temporadas", grupo: "Ajustes" },
  { id: "ajustes-graficos", label: "Ajustes gráficos", grupo: "Ajustes" },
] as const;
export type Seccion = (typeof SECCIONES)[number]["id"];
/** Las secciones que salen en el menú. */
export const SECCIONES_MENU = SECCIONES.filter((seccion) => !("oculta" in seccion));
export function esSeccion(value: string): value is Seccion {
  return SECCIONES.some((section) => section.id === value);
}
export function categoriaDe(params: URLSearchParams): "Senior" | "Veteranos" {
  return params.get("categoria") === "Veteranos" ? "Veteranos" : "Senior";
}
export function cambiarParametros(
  params: URLSearchParams,
  patch: Record<string, string | null>,
): URLSearchParams {
  const next = new URLSearchParams(params);
  if (patch.categoria && patch.categoria !== categoriaDe(params)) {
    next.delete("competicion");
    next.delete("jornada");
  }
  if (patch.temporada !== undefined && patch.temporada !== params.get("temporada")) {
    next.delete("competicion");
    next.delete("jornada");
  }
  if (patch.competicion !== undefined && patch.competicion !== params.get("competicion"))
    next.delete("jornada");
  for (const [key, value] of Object.entries(patch)) {
    if (value) next.set(key, value);
    else next.delete(key);
  }
  return next;
}
export function rutaSeccion(section: Seccion, params: URLSearchParams): string {
  const query = params.toString();
  return `/admin/${section}${query ? `?${query}` : ""}`;
}
