/**
 * Atajo de la pestaña «Equipo»: con la convocatoria de la semana por hacer, lleva directa a ella.
 * (El punto de aviso de la barra de abajo se quitó el 15/11/2026: Iván no quiere tareas guiadas.)
 */
import { preparaConvocatoria } from "@/lib/jornada/vestiario";

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
