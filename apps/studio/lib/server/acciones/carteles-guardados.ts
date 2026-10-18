"use server";

import { capturar, type Resultado } from "@/lib/resultado";
import type { FotoCartel } from "@/lib/cartel2/modelo";
import type { PasoCartel } from "@/lib/cartel2/pasos";
import {
  cartelesDePartidos,
  fotoGuardada,
  type CartelesDePartidos,
} from "@/lib/server/carteles/guardados";

/** Estado de los PNG guardados, incluida su vigencia respecto a la base actual. */
export async function cargarCartelesPartido(
  partidoIds: string[],
): Promise<Resultado<CartelesDePartidos>> {
  return capturar("No se pudieron cargar los carteles guardados.", () =>
    cartelesDePartidos(partidoIds),
  );
}

/** La foto elegida a mano del cartel guardado de un paso, para volver a ponerla al reabrirlo. */
export async function cargarFotoGuardada(
  partidoId: string,
  paso: PasoCartel,
): Promise<Resultado<FotoCartel | null>> {
  return capturar("No se pudo cargar la foto del cartel guardado.", () =>
    fotoGuardada(partidoId, paso),
  );
}
