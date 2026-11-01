export const SECCIONES = [
  { id: "inicio", label: "Inicio" },
  { id: "partidos", label: "Partidos" },
  { id: "calendario", label: "Calendario" },
  { id: "clasificacion", label: "Clasificación" },
  { id: "estadisticas", label: "Estadísticas" },
  { id: "liga", label: "Goleadores" },
  { id: "federacion", label: "Federación", admin: true },
  { id: "archivo", label: "Archivo" },
  // Fichas: se abren tocando un equipo o un jugador, no desde el menú.
  { id: "equipo", label: "Ficha de equipo", oculta: true },
  { id: "jugador", label: "Ficha de jugador", oculta: true },
  { id: "jugadores", label: "Jugadores" },
  { id: "tecnicos", label: "Cuerpo técnico" },
  { id: "directiva", label: "Directiva" },
  { id: "adestramentos", label: "Adestramentos" },
  { id: "multas", label: "Multas" },
  { id: "convocatoria", label: "Convocatoria" },
  { id: "alineacion", label: "Once inicial" },
  // Los carteles los lleva el delegado: el técnico no los ve en el menú ni puede abrirlos.
  { id: "carteles", label: "Carteles", admin: true },
  { id: "importar", label: "Importar" },
  // Siguen teniendo dirección propia (enlaces desde Jornada, lote, calendario PDF), pero se
  // entra por «Importar»: no salen en el menú.
  { id: "actas", label: "Actas", oculta: true },
  // La mesa del partido vive ahora en Liga → Partidos; la dirección sigue para enlaces viejos.
  { id: "jornada", label: "Jornada", oculta: true },
  { id: "importar-jornada", label: "Importar jornada", oculta: true },
  { id: "equipos", label: "Equipos" },
  { id: "patrocinadores", label: "Patrocinadores y logos" },
  { id: "temporadas", label: "Temporadas", admin: true },
  { id: "ajustes-graficos", label: "Ajustes gráficos", admin: true },
  { id: "usuarios", label: "Usuarios", admin: true },
  // Solo existe con el acceso por contraseña encendido.
  { id: "cuenta", label: "Mi cuenta", conSesion: true },
] as const;
export type Seccion = (typeof SECCIONES)[number]["id"];
/** Las secciones que salen en el menú. */
export const SECCIONES_MENU = SECCIONES.filter((seccion) => !("oculta" in seccion));
/** Quién está usando el panel; `null` con el acceso por contraseña apagado. */
export type AccesoPanel = { nombre: string; rol: "admin" | "tecnico" } | null;
/** Si esa sección es solo del administrador y quien mira no lo es. */
export function reservada(id: Seccion, acceso: AccesoPanel): boolean {
  const seccion = SECCIONES.find((item) => item.id === id);
  return !!seccion && "admin" in seccion && acceso?.rol === "tecnico";
}
/** Las secciones del menú para quien mira. */
export function seccionesDelMenu(acceso: AccesoPanel) {
  return SECCIONES_MENU.filter(
    (seccion) => !reservada(seccion.id, acceso) && (acceso !== null || !("conSesion" in seccion)),
  );
}
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
