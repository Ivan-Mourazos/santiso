import { schema } from "@santiso/db";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import type { PersonaMulta } from "@/lib/multas/modelo";
import type { obtenerDb } from "./db";
type Db = Pick<Awaited<ReturnType<typeof obtenerDb>>["db"], "select">;
/** Plantilla y cuerpo técnico de la temporada; cada persona una vez. */
export async function personas(
  db: Db,
  temporadaId: string,
  categoria?: "Senior" | "Veteranos",
): Promise<PersonaMulta[]> {
  const jugadores = await db
    .select({
      id: schema.jugadores.id,
      nombre: schema.jugadores.nombre,
      apodo: schema.jugadores.apodo,
      categoria: schema.jugadoresTemporada.categoria,
      dorsal: schema.jugadoresTemporada.dorsal,
    })
    .from(schema.jugadoresTemporada)
    .innerJoin(schema.jugadores, eq(schema.jugadores.id, schema.jugadoresTemporada.jugadorId))
    .where(
      and(
        eq(schema.jugadoresTemporada.temporadaId, temporadaId),
        categoria ? eq(schema.jugadoresTemporada.categoria, categoria) : undefined,
      ),
    )
    .orderBy(asc(schema.jugadoresTemporada.categoria), asc(schema.jugadores.nombre));
  const tecnicos = await db
    .select({
      id: schema.staff.id,
      nombre: schema.staff.nombre,
      categoria: schema.staffTemporada.categoria,
      cargo: schema.staffTemporada.cargo,
    })
    .from(schema.staffTemporada)
    .innerJoin(schema.staff, eq(schema.staff.id, schema.staffTemporada.staffId))
    .where(
      and(
        eq(schema.staffTemporada.temporadaId, temporadaId),
        eq(schema.staffTemporada.tipo, "tecnico"),
        categoria
          ? or(
              eq(schema.staffTemporada.categoria, categoria),
              isNull(schema.staffTemporada.categoria),
            )
          : undefined,
      ),
    )
    .orderBy(asc(schema.staff.nombre));

  const lista = new Map<string, PersonaMulta>();
  for (const j of jugadores) {
    const clave = `jugador:${j.id}`;
    if (lista.has(clave)) continue;
    lista.set(clave, {
      clave,
      tipo: "jugador",
      id: j.id,
      nombre: j.apodo?.trim() ? `${j.nombre} (${j.apodo.trim()})` : j.nombre,
      detalle: `${j.categoria}${j.dorsal === null ? "" : ` · ${j.dorsal}`}`,
      adestrador: false,
    });
  }
  for (const t of tecnicos) {
    const clave = `staff:${t.id}`;
    if (lista.has(clave)) continue;
    lista.set(clave, {
      clave,
      tipo: "staff",
      id: t.id,
      nombre: t.nombre,
      detalle: [t.categoria, t.cargo].filter(Boolean).join(" · "),
      adestrador: true,
    });
  }
  return [...lista.values()];
}
