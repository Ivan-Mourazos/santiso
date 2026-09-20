import { schema } from "@santiso/db";
import { count, eq } from "drizzle-orm";
import { obtenerDb } from "@/lib/server/db";

/** Diagnóstico local: confirma que la app lee `data/santiso.db`. */
export async function GET() {
  try {
    const { db } = await obtenerDb();
    const [temporada] = await db
      .select({ nombre: schema.temporadas.nombre })
      .from(schema.temporadas)
      .where(eq(schema.temporadas.activa, true));
    const [partidos] = await db.select({ total: count() }).from(schema.partidos);
    return Response.json({
      ok: true,
      temporadaActiva: temporada?.nombre ?? null,
      partidos: partidos?.total ?? 0,
    });
  } catch (error) {
    console.error("GET /api/estado", error);
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 503 },
    );
  }
}
