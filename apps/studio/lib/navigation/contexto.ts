export const SECCIONES = [
  { id: "calendario", label: "Calendario", grupo: "Competición" },
  { id: "clasificacion", label: "Clasificación", grupo: "Competición" },
  { id: "jugadores", label: "Jugadores", grupo: "Plantilla" },
  { id: "tecnicos", label: "Cuerpo técnico", grupo: "Plantilla" },
  { id: "directiva", label: "Directiva", grupo: "Plantilla" },
  { id: "carteles", label: "Carteles", grupo: "Producción" },
  { id: "actas", label: "Actas", grupo: "Producción" },
  { id: "importar-jornada", label: "Importar jornada", grupo: "Producción" },
  { id: "equipos", label: "Equipos", grupo: "Catálogos" },
  { id: "patrocinadores", label: "Patrocinadores", grupo: "Catálogos" },
  { id: "temporadas", label: "Temporadas", grupo: "Ajustes" },
  { id: "ajustes-graficos", label: "Ajustes gráficos", grupo: "Ajustes" },
] as const;
export type Seccion = (typeof SECCIONES)[number]["id"];
export function esSeccion(value: string): value is Seccion {
  return SECCIONES.some((section) => section.id === value);
}
export function categoriaDe(params: URLSearchParams): "Senior" | "Veteranos" {
  return params.get("categoria") === "Veteranos" ? "Veteranos" : "Senior";
}
export type CategoriaPlantilla = "Senior" | "Femenino" | "Veteranos";
/** Secciones cuya categoría admite también Femenino. */
export const SECCIONES_DE_PLANTILLA: readonly Seccion[] = ["jugadores", "tecnicos"];
/**
 * En Plantilla la categoría incluye Femenino: aunque este año no compita, su plantilla y su
 * cuerpo técnico de temporadas anteriores siguen existiendo y tienen que poder consultarse.
 * El resto de secciones sigue con `categoriaDe`.
 */
export function categoriaPlantillaDe(params: URLSearchParams): CategoriaPlantilla {
  const categoria = params.get("categoria");
  return categoria === "Veteranos" || categoria === "Femenino" ? categoria : "Senior";
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
