/**
 * Sanciones y apercibidos de la liga puestos sobre la plantilla, para avisar al convocar y al
 * alinear. Puro: sin base de datos.
 */
import { jugadorSeguro, type JugadorPlantilla } from "@/lib/actas/enlazar";
import type { Disciplina, Situacion } from "./tablas";

export interface AvisoJugador {
  /** El de la plantilla, o `null` si el nombre del acta no se reconoce sin duda. */
  jugadorId: string | null;
  /** Como lo escribe la federación. */
  persona: string;
  situacion: Exclude<Situacion, null>;
  motivo: string;
}

/** Los avisos del equipo propio, cada uno con su jugador si se reconoce. */
export function avisosDePlantilla(
  disciplina: readonly Disciplina[],
  equipoId: string,
  plantilla: readonly JugadorPlantilla[],
): AvisoJugador[] {
  return disciplina.flatMap((d) =>
    d.situacion && d.equipoId === equipoId
      ? [
          {
            jugadorId: jugadorSeguro(d.persona, plantilla)?.id ?? null,
            persona: d.persona,
            situacion: d.situacion,
            motivo: d.motivo,
          },
        ]
      : [],
  );
}
