import { z } from "zod";
import { COMPOSICIONES } from "@/lib/cartel2/modelo";
import { renderizarCartel } from "@/lib/server/cartel2/render";

const equipo = z.object({
  nombre: z.string().max(120),
  escudo: z.string().max(8_000_000).nullable(),
  propio: z.boolean(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
});

const peticion = z.object({
  plantilla: z.literal("partido"),
  composicion: z.enum(COMPOSICIONES.map((c) => c.id) as [string, ...string[]]),
  datos: z.object({
    categoria: z.string().max(40),
    competicion: z.string().max(200),
    jornada: z.string().max(10),
    local: equipo,
    visitante: equipo,
    fecha: z.string().max(10),
    hora: z.string().max(5),
    campo: z.string().max(200),
    patrocinadores: z.array(z.string().max(500)).max(12),
    institucionales: z.array(z.string().max(500)).max(4),
  }),
});

/** Exporta un cartel del motor nuevo a PNG. Solo escucha en 127.0.0.1, como el resto del panel. */
export async function POST(request: Request) {
  const leida = peticion.safeParse(await request.json().catch(() => null));
  if (!leida.success) {
    return Response.json({ error: "Datos del cartel no válidos." }, { status: 400 });
  }
  try {
    const png = await renderizarCartel(
      new URL(request.url).origin,
      leida.data as Parameters<typeof renderizarCartel>[1],
    );
    return new Response(new Uint8Array(png), {
      headers: { "content-type": "image/png", "cache-control": "no-store" },
    });
  } catch (error) {
    console.error("renderizarCartel", error);
    return Response.json({ error: "No se pudo generar el PNG del cartel." }, { status: 500 });
  }
}
