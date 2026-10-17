import { schema } from "@santiso/db";
import { cookies } from "next/headers";
import { z } from "zod";
import { COOKIE_SESION } from "@/lib/acceso/config";
import { ErrorCapacidadCartel } from "@/lib/cartel2/lectura";
import { respuestaSinSesion } from "@/lib/server/acceso/sesion";
import {
  cartelesDePartidos,
  ErrorDatosCartel,
  ErrorPartidoCartel,
  guardarCartelesPaso,
} from "@/lib/server/carteles/guardados";

const cuerpoGuardar = z.object({
  partidoId: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9_-]+$/),
  paso: z.enum(schema.PASOS_CARTEL_PARTIDO),
  peticiones: z.array(z.unknown()).min(1).max(2),
});

/** El Chromium recibe la sesión solo por el servidor local, nunca por la cabecera Host. */
function origenLocal() {
  const puerto = process.env.PORT;
  if (!puerto || !/^\d+$/.test(puerto)) throw new Error("Falta PORT para abrir el render.");
  return `http://127.0.0.1:${puerto}`;
}

export async function POST(request: Request) {
  const sinSesion = await respuestaSinSesion();
  if (sinSesion) return sinSesion;
  const cuerpo = cuerpoGuardar.safeParse(await request.json().catch(() => null));
  if (!cuerpo.success)
    return Response.json({ error: "Datos del cartel no válidos." }, { status: 400 });
  const { partidoId, paso, peticiones } = cuerpo.data;
  try {
    const sesion = (await cookies()).get(COOKIE_SESION)?.value;
    await guardarCartelesPaso({ partidoId, paso, peticiones, origen: origenLocal(), sesion });
    const estado = await cartelesDePartidos([partidoId]);
    return Response.json(estado[partidoId]?.[paso] ?? [], {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    if (error instanceof ErrorDatosCartel)
      return Response.json({ error: error.message }, { status: 400 });
    if (error instanceof ErrorPartidoCartel)
      return Response.json({ error: error.message }, { status: 404 });
    if (error instanceof ErrorCapacidadCartel)
      return Response.json({ error: error.message }, { status: 422 });
    console.error("guardarCartelesPaso", error);
    return Response.json({ error: "No se pudo guardar el cartel." }, { status: 500 });
  }
}
