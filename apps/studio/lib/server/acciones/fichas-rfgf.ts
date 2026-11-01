"use server";

import { capturar, type Resultado } from "@/lib/resultado";
import { soloAdmin } from "@/lib/server/acceso/permisos";
import {
  archivoHistorico,
  fichaCompletaDeJugador,
  fichaDeEquipo,
  type ArchivoHistorico,
  type FichaCompletaDeJugador,
  type FichaDeEquipo,
} from "@/lib/server/consultas/fichas-rfgf";
import { crearDescargador } from "@/lib/server/rfgf/descargador";
import {
  traerTemporadasDeJugador,
  type ResumenTemporadasJugador,
} from "@/lib/server/rfgf/historico";

/** Lectura local: obtenerDb comprueba la sesión, sin exigir rol de administrador. */
export async function cargarFichaDeEquipo(
  equipoId: string,
): Promise<Resultado<FichaDeEquipo | null>> {
  return capturar("No se pudo cargar la ficha del equipo.", () => fichaDeEquipo(equipoId));
}

/** Lectura local, como la anterior. */
export async function cargarFichaCompletaDeJugador(
  jugadorId: string,
): Promise<Resultado<FichaCompletaDeJugador | null>> {
  return capturar("No se pudo cargar la ficha del jugador.", () =>
    fichaCompletaDeJugador(jugadorId),
  );
}

/** Lectura local del archivo de temporadas pasadas. */
export async function cargarArchivoHistorico(): Promise<Resultado<ArchivoHistorico>> {
  return capturar("No se pudo cargar el archivo de temporadas pasadas.", () => archivoHistorico());
}

/**
 * Adelanta lo que falta de las temporadas pasadas de un jugador: dos páginas de la federación
 * como mucho por llamada. Lo demás sigue en segundo plano, al ritmo del programador.
 */
export async function traerTemporadasJugador(
  jugadorId: string,
): Promise<Resultado<ResumenTemporadasJugador>> {
  const sinPermiso = await soloAdmin();
  if (sinPermiso) return sinPermiso;
  return capturar("No se pudieron traer las temporadas del jugador.", () =>
    traerTemporadasDeJugador(jugadorId, crearDescargador()),
  );
}

export async function elegirClubDeHistorial(id: string, codigo: string): Promise<Resultado<void>> {
  const sinPermiso = await soloAdmin();
  if (sinPermiso) return sinPermiso;
  return capturar("No se pudo elegir el club.", async () => {
    const { elegirClubAnterior } = await import("@/lib/server/rfgf/anteriores");
    await elegirClubAnterior(id, codigo);
  });
}

export async function elegirEquipoDeHistorial(
  id: string,
  codigo: string,
): Promise<Resultado<void>> {
  const sinPermiso = await soloAdmin();
  if (sinPermiso) return sinPermiso;
  return capturar("No se pudo elegir el equipo.", async () => {
    const { elegirEquipoAnterior } = await import("@/lib/server/rfgf/anteriores");
    await elegirEquipoAnterior(id, codigo);
  });
}
