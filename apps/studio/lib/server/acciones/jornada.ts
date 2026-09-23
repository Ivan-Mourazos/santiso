"use server";

import { esDia, hoyLocal } from "@/lib/jornada/semana";
import { capturar, type Resultado } from "@/lib/resultado";
import { pantallaJornada, type PantallaJornada } from "@/lib/server/consultas/jornada";

/** La semana del día pedido; sin día válido, la de hoy. */
export async function cargarPantallaJornada(
  dia?: string | null,
): Promise<Resultado<PantallaJornada>> {
  const elegido = esDia(dia) ? dia : hoyLocal();
  return capturar("No se pudo cargar la jornada.", () => pantallaJornada(elegido));
}
