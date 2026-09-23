"use server";

import { CATEGORIAS, esValorDe, normalizarCategoria, type Categoria } from "@santiso/domain";
import type { CompeticionDto, TemporadaDto } from "@/lib/dto";
import { capturar, fallo, type Resultado } from "@/lib/resultado";
import { listarCompeticionesDeTemporada } from "@/lib/server/consultas/competiciones";
import {
  listarEstadisticasJugadores,
  type EstadisticasTemporada,
} from "@/lib/server/consultas/estadisticas-jugadores";
import { listarTemporadas } from "@/lib/server/consultas/temporadas";
import { resolverTemporada } from "@/lib/server/temporada";

export interface PantallaEstadisticas {
  temporadas: TemporadaDto[];
  temporadaId: string;
  competiciones: CompeticionDto[];
  /** `null` = todas las competiciones del ámbito. */
  competicionId: string | null;
  filas: EstadisticasTemporada["filas"];
  /** El acta no distingue penaltis: la pantalla lo dice en vez de enseñar un cero. */
  disponibilidadPenaltis: false;
}

/**
 * Todo lo que pinta la pantalla, en una sola acción: Next despacha las acciones del cliente de
 * una en una, así que tres llamadas serían tres viajes en serie.
 */
export async function cargarPantallaEstadisticas(
  categoria: string,
  temporadaId?: string | null,
  competicionId?: string | null,
): Promise<Resultado<PantallaEstadisticas>> {
  // `normalizarCategoria` lanza ante una categoría inventada; aquí se convierte en un fallo
  // legible, que es lo que la pantalla sabe mostrar.
  let categoriaValida: Categoria;
  try {
    const normalizada = normalizarCategoria(categoria);
    if (!esValorDe(CATEGORIAS, normalizada)) return fallo("Categoría desconocida.");
    categoriaValida = normalizada;
  } catch {
    return fallo("Categoría desconocida.");
  }

  return capturar("No se pudieron cargar las estadísticas.", async () => {
    const [temporadas, temporada] = await Promise.all([
      listarTemporadas(),
      resolverTemporada(temporadaId),
    ]);
    if (!temporada) {
      return {
        temporadas,
        temporadaId: "",
        competiciones: [],
        competicionId: null,
        filas: [],
        disponibilidadPenaltis: false as const,
      };
    }

    const competiciones = await listarCompeticionesDeTemporada(temporada.id, categoriaValida);
    // Al cambiar de temporada, la competición elegida antes ya no pertenece al ámbito: se cae a
    // «todas» en vez de fallar, que es lo que el usuario acaba de pedir sin decirlo.
    const elegida = competiciones.some((c) => c.id === competicionId) ? competicionId : null;

    const estadisticas = await listarEstadisticasJugadores({
      temporadaId: temporada.id,
      categoria: categoriaValida,
      ...(elegida ? { competicionId: elegida } : {}),
    });

    return {
      temporadas,
      temporadaId: temporada.id,
      competiciones,
      competicionId: elegida ?? null,
      filas: estadisticas.filas,
      disponibilidadPenaltis: false as const,
    };
  });
}
