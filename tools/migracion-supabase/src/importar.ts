import { type Db, schema as s, type TransaccionDb } from "@santiso/db";
import type { InferInsertModel } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import type { ModeloNuevo } from "./transformar/tipos";

/** 100 filas × ≤ 14 columnas queda muy por debajo del límite de parámetros de SQLite. */
const TAMANO_LOTE = 100;

async function insertar<T extends SQLiteTable>(
  tx: TransaccionDb,
  tabla: T,
  filas: InferInsertModel<T>[],
) {
  for (let i = 0; i < filas.length; i += TAMANO_LOTE) {
    await tx.insert(tabla).values(filas.slice(i, i + TAMANO_LOTE));
  }
}

/** Inserta el modelo completo en una sola transacción, en orden de claves foráneas. */
export async function importarModelo(db: Db, modelo: ModeloNuevo): Promise<void> {
  await db.transaction(async (tx) => {
    await insertar(tx, s.temporadas, modelo.temporadas);
    await insertar(tx, s.competiciones, modelo.competiciones);
    await insertar(tx, s.competicionAlias, modelo.competicionAlias);
    await insertar(tx, s.equipos, modelo.equipos);
    await insertar(tx, s.competicionEquipos, modelo.competicionEquipos);
    await insertar(tx, s.jugadores, modelo.jugadores);
    await insertar(tx, s.staff, modelo.staff);
    await insertar(tx, s.campos, modelo.campos);
    await insertar(tx, s.jornadas, modelo.jornadas);
    await insertar(tx, s.jornadaDescansos, modelo.jornadaDescansos);
    await insertar(tx, s.partidos, modelo.partidos);
    await insertar(tx, s.partidoParticipaciones, modelo.partidoParticipaciones);
    await insertar(tx, s.partidoEventos, modelo.partidoEventos);
    await insertar(tx, s.patrocinadores, modelo.patrocinadores);
    await insertar(tx, s.ajustes, modelo.ajustes);
  });
}
