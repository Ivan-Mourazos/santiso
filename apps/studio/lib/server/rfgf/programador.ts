import "server-only";

import { tocaPasadaDiaria } from "@/lib/rfgf/plan";
import { comoSistema } from "@/lib/server/db";
import { crearDescargador } from "./descargador";
import { traerClubesSiToca } from "./clubes";
import { avanzarHistorico } from "./historico";
import { sincronizarTodo, ultimaComprobacion } from "./sincronizar";

/** Cada cuánto se mira el reloj para ver si ya toca la comprobación del día. */
const CADA_MS = 10 * 60_000;

declare global {
  var santisoProgramadorRfgf: ReturnType<typeof setInterval> | undefined;
}

/**
 * Comprobación diaria de la federación, a partir de las 21:00 (ver `tocaPasadaDiaria`). Lo
 * que la federación publica no cambia de una hora para otra, y cuantas menos descargas, mejor:
 * quien quiera los datos antes tiene «Comprobar ahora» en el panel de Jornada.
 *
 * En el mismo tic, el repaso de temporadas pasadas (dos páginas) y, una vez por semana, el
 * listado de clubes.
 *
 * Solo se activa con `STUDIO_RFGF_AUTO=1`, que lleva la copia de uso diario: ni desarrollo ni
 * pruebas salen nunca a la red por su cuenta.
 */
export function iniciarProgramadorRfgf() {
  if (process.env.STUDIO_RFGF_AUTO !== "1" || globalThis.santisoProgramadorRfgf) return;
  const comprobar = async () => {
    try {
      // No viene de ninguna petición: se ejecuta como el propio servidor.
      const resumenes = await comoSistema(async () => {
        if (!tocaPasadaDiaria(new Date(), await ultimaComprobacion())) return [];
        return sincronizarTodo(crearDescargador(), new Date());
      });
      for (const r of resumenes) {
        if (r.actas || r.resultados || r.horarios.length || r.revisar.length || r.errores.length) {
          console.info(
            `[rfgf] ${r.competicion}: ${r.actas} actas, ${r.resultados} resultados, ${r.horarios.length} horarios, ${r.revisar.length} por revisar, ${r.errores.length} errores`,
          );
        }
      }
    } catch (error) {
      console.error("[rfgf] La comprobación falló.", error);
    }
    // Aparte, el repaso de temporadas pasadas: dos páginas por tic, hasta que no quede nada.
    try {
      await comoSistema(() => avanzarHistorico(crearDescargador(), new Date()));
    } catch (error) {
      console.error("[rfgf] El repaso de temporadas pasadas falló.", error);
    }
    // Y una vez por semana, el listado de clubes (una sola petición): datos y colores de cada rival.
    try {
      const clubes = await comoSistema(() => traerClubesSiToca(crearDescargador(), new Date()));
      if (clubes?.clubes) {
        console.info(
          `[rfgf] Clubes: ${clubes.clubes} leídos, ${clubes.enlazados} equipos enlazados, ${clubes.colores} con colores, ${clubes.dudosos.length} por elegir`,
        );
      }
    } catch (error) {
      console.error("[rfgf] El listado de clubes falló.", error);
    }
  };
  globalThis.santisoProgramadorRfgf = setInterval(() => void comprobar(), CADA_MS);
  // La primera, al minuto de arrancar: que el servidor esté ya atendiendo.
  setTimeout(() => void comprobar(), 60_000);
}
