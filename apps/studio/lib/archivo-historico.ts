import { esEquipoPropio, normalizarNombreCompeticion } from "@santiso/domain";
import type { GrupoDeArchivo } from "./server/consultas/fichas-rfgf";

export function esCopa(g: GrupoDeArchivo) {
  return g.clasificacion?.formato === "copa" || /\bcopa\b/iu.test(g.competicion);
}

export function nombreCompeticion(g: GrupoDeArchivo, grupos: GrupoDeArchivo[]) {
  const nombre = normalizarNombreCompeticion(g.competicion);
  const repetida = grupos.some(
    (otra) => otra.codGrupo !== g.codGrupo && otra.competicion === g.competicion,
  );
  return repetida && g.grupo ? `${nombre} · ${normalizarNombreCompeticion(g.grupo)}` : nombre;
}

function fase(g: GrupoDeArchivo) {
  const nombre = `${g.competicion} ${g.grupo}`;
  if (/ascenso|permanencia|final|segunda fase|fase 2/iu.test(nombre)) return 2;
  if (/previa|primera fase|fase 1/iu.test(nombre)) return 0;
  return 1;
}

function disponibilidad(g: GrupoDeArchivo) {
  const c = g.clasificacion;
  if (c?.estado === "leido" && (c.filas?.length || c.ronda)) return 0;
  return c?.estado === "sin_datos" || c?.estado === "leido" ? 2 : 1;
}

function compararFases(a: GrupoDeArchivo, b: GrupoDeArchivo, grupos: GrupoDeArchivo[]) {
  return (
    fase(a) - fase(b) ||
    nombreCompeticion(a, grupos).localeCompare(nombreCompeticion(b, grupos), "es") ||
    a.codGrupo.localeCompare(b.codGrupo, "es", { numeric: true })
  );
}

/** Ligas antes de copas; dentro de cada grupo, datos primero y sin publicación al final. */
export function ordenarCompeticiones(grupos: GrupoDeArchivo[]): GrupoDeArchivo[] {
  return [...grupos].sort(
    (a, b) =>
      Number(esCopa(a)) - Number(esCopa(b)) ||
      disponibilidad(a) - disponibilidad(b) ||
      compararFases(a, b, grupos),
  );
}

/** La última fase de liga representa la temporada, aunque su tabla siga pendiente. */
export function elegirLigaPrincipal(grupos: GrupoDeArchivo[]): GrupoDeArchivo | null {
  return (
    grupos
      .filter((g) => !esCopa(g))
      .sort((a, b) => compararFases(a, b, grupos))
      .at(-1) ?? null
  );
}

export function filaSantiso(g: GrupoDeArchivo) {
  return g.clasificacion?.estado === "leido"
    ? g.clasificacion.filas?.find((f) => esEquipoPropio(f.equipo))
    : undefined;
}

export function estadoClasificacion(g: GrupoDeArchivo) {
  const c = g.clasificacion;
  if (!c || c.estado === "pendiente") return "Buscando…";
  if (c.estado === "error") return "No se pudo leer la clasificación";
  return "La federación no publica clasificación";
}
