/**
 * El punto de aviso de la barra de abajo: en la pestaña donde está el siguiente paso de alguno de
 * nuestros partidos de la semana. Solo cuando de verdad queda algo por hacer.
 */
import { preparaConvocatoria, type PasoPartido } from "@/lib/jornada/vestiario";
import type { Seccion } from "./contexto";
import { pestanaDe, type IdPestana } from "./menu";

export interface ProgresoParaAviso {
  pasos: PasoPartido[];
  principal: { href: string; traerActa?: boolean };
}

/** La sección de un enlace del Studio: `/admin/convocatoria?…` → `convocatoria`. */
export function seccionDeRuta(href: string): Seccion | undefined {
  const ruta = href.split(/[?#]/)[0] ?? "";
  const m = /^\/admin(?:\/([^/]+))?\/?$/.exec(ruta);
  if (!m) return undefined;
  return (m[1] ?? "inicio") as Seccion;
}

/**
 * Las pestañas con aviso. Esperar a la federación no es tarea nuestra; con todo hecho no hay
 * aviso. Inicio nunca lo lleva: ya lo enseña todo.
 */
export function pestanasConAviso(progresos: readonly ProgresoParaAviso[]): Set<IdPestana> {
  const avisos = new Set<IdPestana>();
  for (const { pasos, principal } of progresos) {
    if (principal.traerActa) continue;
    if (!pasos.some((p) => p.tono === "pendiente")) continue;
    const pestana = pestanaDe(seccionDeRuta(principal.href));
    if (pestana !== "inicio") avisos.add(pestana);
  }
  return avisos;
}

/** Lo mínimo de un partido de la semana para saber si falta su convocatoria. */
export interface PartidoParaConvocar {
  categoria: string;
  despues: boolean;
  convocados: number | null;
}

/**
 * Las categorías con la convocatoria de esta semana sin hacer: ahí la pestaña «Equipo» lleva
 * directa a ella. Hecha (o jugado ya el partido), la pestaña abre su menú.
 */
export function categoriasPorConvocar(partidos: readonly PartidoParaConvocar[]): Set<string> {
  return new Set(
    partidos
      .filter((p) => preparaConvocatoria(p.categoria) && !p.despues && !p.convocados)
      .map((p) => p.categoria),
  );
}
