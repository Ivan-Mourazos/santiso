import "server-only";
import { chromium, type Browser } from "playwright";
import { MEDIDAS, type PeticionCartel } from "@/lib/cartel2/modelo";

declare global {
  // Un Chromium por proceso, reutilizado entre exportaciones: arrancarlo cuesta ~1 s.
  var santisoNavegador: Promise<Browser> | undefined;
}

async function navegador(): Promise<Browser> {
  const actual = globalThis.santisoNavegador
    ? await globalThis.santisoNavegador.catch(() => null)
    : null;
  if (actual?.isConnected()) return actual;
  globalThis.santisoNavegador = chromium.launch().catch((error: unknown) => {
    globalThis.santisoNavegador = undefined;
    throw error;
  });
  return globalThis.santisoNavegador;
}

/**
 * PNG del cartel a doble resolución (2160 × 2700), fotografiando la página
 * `/render/cartel` en un Chromium local. `origen` es el del propio servidor: las imágenes
 * (`/media/...`) y las fuentes se sirven desde él; nada sale a internet.
 */
export async function renderizarCartel(origen: string, peticion: PeticionCartel): Promise<Buffer> {
  const contexto = await (
    await navegador()
  ).newContext({
    viewport: { width: MEDIDAS.ancho, height: MEDIDAS.alto },
    deviceScaleFactor: 2,
  });
  try {
    const pagina = await contexto.newPage();
    await pagina.goto(`${origen}/render/cartel`, { waitUntil: "domcontentloaded" });
    await pagina.waitForFunction(() => typeof window.__pintarCartel === "function", null, {
      timeout: 30_000,
    });
    await pagina.evaluate((p) => window.__pintarCartel?.(p), peticion);
    const cartel = pagina.locator("[data-listo] [data-cartel]");
    await cartel.waitFor({ timeout: 30_000 });
    return await cartel.screenshot({ type: "png", animations: "disabled" });
  } finally {
    await contexto.close();
  }
}
