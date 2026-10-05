import { leerPeticion } from "@/lib/cartel2/esquema";
import { renderizarCartel } from "@/lib/server/cartel2/render";

/**
 * Origen por el que el Chromium local abre `/render/cartel`: siempre el propio servidor en
 * 127.0.0.1. Con el Studio abierto desde el móvil (Tailscale) la petición llega con otro
 * nombre de máquina, y pintar el cartel dando la vuelta por la red sería más lento y frágil.
 */
function origenLocal(request: Request) {
  const puerto = process.env.PORT;
  return puerto ? `http://127.0.0.1:${puerto}` : new URL(request.url).origin;
}

/** Exporta un cartel del motor nuevo a PNG. */
export async function POST(request: Request) {
  const peticion = leerPeticion(await request.json().catch(() => null));
  if (!peticion) {
    return Response.json({ error: "Datos del cartel no válidos." }, { status: 400 });
  }
  try {
    const png = await renderizarCartel(origenLocal(request), peticion);
    return new Response(new Uint8Array(png), {
      headers: { "content-type": "image/png", "cache-control": "no-store" },
    });
  } catch (error) {
    console.error("renderizarCartel", error);
    return Response.json({ error: "No se pudo generar el PNG del cartel." }, { status: 500 });
  }
}
