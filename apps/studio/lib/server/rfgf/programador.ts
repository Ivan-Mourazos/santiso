import "server-only";

import { crearDescargador } from "./descargador";
import { sincronizarTodo } from "./sincronizar";

/** Cada cuánto se mira si hay actas nuevas de los partidos recientes. */
const CADA_MS = 30 * 60_000;
/** Una de cada tantas pasadas mira también lo antiguo que siga pendiente: una vez al día. */
const PASADAS_POR_DIA = 48;

declare global {
  var santisoProgramadorRfgf: ReturnType<typeof setInterval> | undefined;
}

/**
 * Comprobación periódica de la federación. Solo se activa con `STUDIO_RFGF_AUTO=1`, que lleva
 * la copia de uso diario: ni desarrollo ni pruebas salen nunca a la red por su cuenta.
 */
export function iniciarProgramadorRfgf() {
  if (process.env.STUDIO_RFGF_AUTO !== "1" || globalThis.santisoProgramadorRfgf) return;
  let pasada = 0;
  const comprobar = async () => {
    const completa = pasada % PASADAS_POR_DIA === 0;
    pasada += 1;
    try {
      const resumenes = await sincronizarTodo(crearDescargador(), new Date(), !completa);
      for (const r of resumenes) {
        if (r.actas || r.resultados || r.revisar.length || r.errores.length) {
          console.info(
            `[rfgf] ${r.competicion}: ${r.actas} actas, ${r.resultados} resultados, ${r.revisar.length} por revisar, ${r.errores.length} errores`,
          );
        }
      }
    } catch (error) {
      console.error("[rfgf] La comprobación falló.", error);
    }
  };
  globalThis.santisoProgramadorRfgf = setInterval(() => void comprobar(), CADA_MS);
  // La primera, al minuto de arrancar: que el servidor esté ya atendiendo.
  setTimeout(() => void comprobar(), 60_000);
}
