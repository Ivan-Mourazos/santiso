"use server";
import { schema as s } from "@santiso/db";
import { claveNombre } from "@santiso/domain";
import { and, desc, eq, isNull } from "drizzle-orm";
import { conceptoDe, cambioDe, type Marca } from "@/lib/adestramentos/modelo";
import { esDia, importeDeMulta, textoDeConcepto } from "@/lib/multas/modelo";
import { capturar, fallo } from "@/lib/resultado";
import { obtenerDb } from "../db";
import { personas } from "../personas-multas";

type Categoria = "Senior" | "Veteranos";
async function activa(db: Pick<Awaited<ReturnType<typeof obtenerDb>>["db"], "select">) {
  const [t] = await db.select().from(s.temporadas).where(eq(s.temporadas.activa, true));
  if (!t) throw new Error("No hay temporada activa.");
  return t;
}
export async function cargarAdestramentos(categoria: Categoria) {
  return capturar(
    "No se pudieron cargar los entrenamientos. Comprueba la temporada activa.",
    async () => {
      const { db } = await obtenerDb();
      const temporada = await activa(db);
      const entrenamientos = await db
        .select()
        .from(s.entrenamientos)
        .where(
          and(
            eq(s.entrenamientos.temporadaId, temporada.id),
            eq(s.entrenamientos.categoria, categoria),
          ),
        )
        .orderBy(desc(s.entrenamientos.fecha));
      const marcas = await db
        .select({
          asistencia: s.asistencias,
          nombreJugador: s.jugadores.nombre,
          nombreStaff: s.staff.nombre,
          pagadaEn: s.multas.pagadaEn,
          importeCentimos: s.multas.importeCentimos,
        })
        .from(s.asistencias)
        .innerJoin(s.entrenamientos, eq(s.entrenamientos.id, s.asistencias.entrenamientoId))
        .leftJoin(s.jugadores, eq(s.jugadores.id, s.asistencias.jugadorId))
        .leftJoin(s.staff, eq(s.staff.id, s.asistencias.staffId))
        .leftJoin(s.multas, eq(s.multas.id, s.asistencias.multaId))
        .where(
          and(
            eq(s.entrenamientos.temporadaId, temporada.id),
            eq(s.entrenamientos.categoria, categoria),
          ),
        );
      const lista = await personas(db, temporada.id, categoria);
      for (const { asistencia: a, nombreJugador, nombreStaff } of marcas) {
        const clave = a.jugadorId ? `jugador:${a.jugadorId}` : `staff:${a.staffId}`;
        if (!lista.some((p) => p.clave === clave))
          lista.push({
            clave,
            id: (a.jugadorId ?? a.staffId)!,
            tipo: a.jugadorId ? "jugador" : "staff",
            nombre: (nombreJugador ?? nombreStaff)!,
            detalle: "Fuera de la plantilla actual",
            adestrador: !!a.staffId,
          });
      }
      const conceptos = await db
        .select()
        .from(s.multasConceptos)
        .where(eq(s.multasConceptos.grupo, "adestramento"));
      return {
        temporada,
        entrenamientos,
        marcas,
        personas: lista,
        conceptos,
        actuales: (await personas(db, temporada.id, categoria)).map((p) => p.clave),
      };
    },
  );
}
export async function guardarAdestramento(entrada: {
  id?: string;
  categoria: Categoria;
  fecha: string;
  hora?: string;
  nota?: string;
  marcas: Marca[];
}) {
  if (
    !esDia(entrada.fecha) ||
    !["Senior", "Veteranos"].includes(entrada.categoria) ||
    (entrada.hora && !/^([01]\d|2[0-3]):[0-5]\d$/.test(entrada.hora))
  )
    return fallo("Fecha, hora o categoría no válida.");
  if (
    !Array.isArray(entrada.marcas) ||
    entrada.marcas.some(
      (m) =>
        !["presente", "tarde", "ausente"].includes(m.estado) ||
        typeof m.justificado !== "boolean" ||
        (m.motivo != null && typeof m.motivo !== "string"),
    ) ||
    new Set(entrada.marcas.map((m) => m.personaClave)).size !== entrada.marcas.length
  )
    return fallo("Lista no válida.");
  return capturar("No se pudo guardar. Revisa si ya hay un entrenamiento ese día.", async () => {
    const { db } = await obtenerDb();
    return db.transaction(async (tx) => {
      const temporada = await activa(tx);
      const lista = await personas(tx, temporada.id, entrada.categoria);
      const anteriores = entrada.id
        ? await tx.select().from(s.asistencias).where(eq(s.asistencias.entrenamientoId, entrada.id))
        : [];
      let id = entrada.id;
      if (id) {
        const [existente] = await tx
          .select()
          .from(s.entrenamientos)
          .where(
            and(
              eq(s.entrenamientos.id, id),
              eq(s.entrenamientos.temporadaId, temporada.id),
              eq(s.entrenamientos.categoria, entrada.categoria),
            ),
          );
        if (!existente || existente.fecha !== entrada.fecha)
          throw new Error("Entrenamiento no válido");
        await tx
          .update(s.entrenamientos)
          .set({ hora: entrada.hora?.trim() || null, nota: entrada.nota?.trim() || null })
          .where(eq(s.entrenamientos.id, id));
      } else {
        const [nuevo] = await tx
          .insert(s.entrenamientos)
          .values({
            temporadaId: temporada.id,
            categoria: entrada.categoria,
            fecha: entrada.fecha,
            hora: entrada.hora?.trim() || null,
            nota: entrada.nota?.trim() || null,
          })
          .returning();
        id = nuevo!.id;
      }
      const claveDe = (a: typeof s.asistencias.$inferSelect) =>
        a.jugadorId ? `jugador:${a.jugadorId}` : `staff:${a.staffId}`;
      const esperadas = new Set([...anteriores.map(claveDe), ...lista.map((p) => p.clave)]);
      if (
        [...esperadas].some((clave) => !entrada.marcas.some((m) => m.personaClave === clave)) ||
        entrada.marcas.some((m) => !esperadas.has(m.personaClave))
      )
        throw new Error("La plantilla ha cambiado. Recarga la lista.");
      const avisos: string[] = [];
      for (const original of entrada.marcas) {
        const m = {
          ...original,
          justificado: original.estado === "presente" ? false : original.justificado,
          motivo: original.estado === "presente" ? null : original.motivo?.trim() || null,
        };
        const antes = anteriores.find((a) => claveDe(a) === m.personaClave);
        const [multa] = antes?.multaId
          ? await tx.select().from(s.multas).where(eq(s.multas.id, antes.multaId))
          : [];
        const accion = cambioDe(antes, m, multa);
        let multaId = antes?.multaId ?? null;
        if (accion === "avisar")
          avisos.push(
            `${lista.find((p) => p.clave === m.personaClave)?.nombre ?? m.personaClave}: multa pagada conservada. Revísala a mano en Multas.`,
          );
        else if (accion === "mantener") {
          if (multa?.pagadaEn && multa.nota !== m.motivo)
            avisos.push("Multa pagada conservada. Revisa el motivo a mano en Multas.");
          if (multa && !multa.pagadaEn)
            await tx
              .update(s.multas)
              .set({ nota: m.motivo })
              .where(and(eq(s.multas.id, multa.id), isNull(s.multas.pagadaEn)));
        } else {
          if (multa)
            await tx
              .delete(s.multas)
              .where(and(eq(s.multas.id, multa.id), isNull(s.multas.pagadaEn)));
          multaId = null;
          const nombre = conceptoDe(m);
          if (nombre) {
            const [concepto] = await tx
              .select()
              .from(s.multasConceptos)
              .where(
                and(
                  eq(s.multasConceptos.grupo, "adestramento"),
                  eq(s.multasConceptos.clave, claveNombre(nombre)),
                  eq(s.multasConceptos.activo, true),
                ),
              );
            if (!concepto)
              avisos.push(`${nombre}: concepto ausente o inactivo. Asistencia guardada sin multa.`);
            else {
              const [nueva] = await tx
                .insert(s.multas)
                .values({
                  temporadaId: temporada.id,
                  jugadorId: m.personaClave.startsWith("jugador:") ? m.personaClave.slice(8) : null,
                  staffId: m.personaClave.startsWith("staff:") ? m.personaClave.slice(6) : null,
                  concepto: textoDeConcepto(concepto, 1, []),
                  importeCentimos: importeDeMulta(concepto, 1, m.personaClave.startsWith("staff:")),
                  fecha: entrada.fecha,
                  nota: m.motivo,
                })
                .returning();
              multaId = nueva!.id;
            }
          }
        }
        const valores = { estado: m.estado, justificado: m.justificado, motivo: m.motivo, multaId };
        if (antes)
          await tx.update(s.asistencias).set(valores).where(eq(s.asistencias.id, antes.id));
        else
          await tx.insert(s.asistencias).values({
            ...valores,
            entrenamientoId: id!,
            jugadorId: m.personaClave.startsWith("jugador:") ? m.personaClave.slice(8) : null,
            staffId: m.personaClave.startsWith("staff:") ? m.personaClave.slice(6) : null,
          });
      }
      return { id: id!, avisos };
    });
  });
}
export async function borrarAdestramento(id: string) {
  return capturar("No se pudo borrar el entrenamiento.", async () => {
    const { db } = await obtenerDb();
    return db.transaction(async (tx) => {
      const temporada = await activa(tx);
      const [e] = await tx
        .select()
        .from(s.entrenamientos)
        .where(and(eq(s.entrenamientos.id, id), eq(s.entrenamientos.temporadaId, temporada.id)));
      if (!e) throw new Error("Entrenamiento no válido");
      const filas = await tx
        .select({ multa: s.multas })
        .from(s.asistencias)
        .innerJoin(s.multas, eq(s.multas.id, s.asistencias.multaId))
        .where(eq(s.asistencias.entrenamientoId, id));
      const avisos: string[] = [];
      for (const { multa } of filas) {
        if (multa.pagadaEn) avisos.push("Multa pagada conservada. Revísala a mano en Multas.");
        else
          await tx
            .delete(s.multas)
            .where(and(eq(s.multas.id, multa.id), isNull(s.multas.pagadaEn)));
      }
      await tx.delete(s.entrenamientos).where(eq(s.entrenamientos.id, id));
      return { avisos };
    });
  });
}
