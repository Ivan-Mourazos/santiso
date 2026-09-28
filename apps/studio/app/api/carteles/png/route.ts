import { leerPeticion } from "@/lib/cartel2/esquema";
import { renderizarCartel } from "@/lib/server/cartel2/render";

/** Exporta un cartel del motor nuevo a PNG. Solo escucha en 127.0.0.1, como el resto del panel. */
export async function POST(request: Request) {
  const peticion = leerPeticion(await request.json().catch(() => null));
  if (!peticion) {
    return Response.json({ error: "Datos del cartel no válidos." }, { status: 400 });
  }
  try {
    const png = await renderizarCartel(new URL(request.url).origin, peticion);
    return new Response(new Uint8Array(png), {
      headers: { "content-type": "image/png", "cache-control": "no-store" },
    });
  } catch (error) {
    console.error("renderizarCartel", error);
    return Response.json({ error: "No se pudo generar el PNG del cartel." }, { status: 500 });
  }
}
