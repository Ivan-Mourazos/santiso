"use server";

import { capturar, type Resultado } from "@/lib/resultado";
import { cartelesDePartidos, type CartelesDePartidos } from "@/lib/server/carteles/guardados";

/** Estado de los PNG guardados, incluida su vigencia respecto a la base actual. */
export async function cargarCartelesPartido(
  partidoIds: string[],
): Promise<Resultado<CartelesDePartidos>> {
  return capturar("No se pudieron cargar los carteles guardados.", () =>
    cartelesDePartidos(partidoIds),
  );
}
