/**
 * Fuera de la ficha, los jugadores del club salen por su apodo, también en lo que llega de la
 * federación (que escribe «APELLIDOS, NOMBRE»). Puro: sin base de datos.
 */
import { jugadorSeguro, type JugadorPlantilla } from "@/lib/actas/enlazar";

/**
 * El nombre con que se enseña a alguien del acta: el apodo del jugador del club si se reconoce
 * sin duda (o su nombre, si no tiene apodo); si no, tal cual lo escribe la federación.
 */
export function nombreDelClub(persona: string, plantilla: readonly JugadorPlantilla[]): string {
  const jugador = jugadorSeguro(persona, plantilla);
  return jugador ? jugador.apodo?.trim() || jugador.nombre : persona;
}
