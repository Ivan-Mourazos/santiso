import "server-only";
import type { LecturaEstadisticas } from "@santiso/db";
import type { Categoria, EstadisticaJugador } from "@santiso/domain";
import { urlMedia } from "@/lib/media";
import { leerEstadisticasJugadores } from "./estadisticas-jugadores";

type FilaAuditoria = EstadisticaJugador & {
  nombre: string;
  apodo: string | null;
  dorsal: number | null;
  fotoUrl: string | null;
  inscripcionAusente: boolean;
};
const CAMPOS = [
  "nombre",
  "apodo",
  "dorsal",
  "fotoUrl",
  "inscripcionAusente",
  "convocados",
  "titularidades",
  "partidosJugados",
  "goles",
  "golesPropia",
  "amarillas",
  "rojas",
  "golesPenalti",
] as const;

/** Compara por identidad; los mensajes no exponen nombres ni fotos personales. */
export function compararFilasEstadisticas(
  calculadas: readonly FilaAuditoria[],
  esperadas: readonly FilaAuditoria[],
): string[] {
  const errores: string[] = [];
  const pendientes = new Map(esperadas.map((f) => [f.jugadorId, f]));
  const vistos = new Set<string>();
  for (const fila of calculadas) {
    if (vistos.has(fila.jugadorId)) {
      errores.push(`Identidad duplicada: ${fila.jugadorId}`);
      continue;
    }
    vistos.add(fila.jugadorId);
    const original = pendientes.get(fila.jugadorId);
    if (!original) {
      errores.push(`Identidad inesperada: ${fila.jugadorId}`);
      continue;
    }
    for (const campo of CAMPOS) {
      if (fila[campo] !== original[campo])
        errores.push(`Diferencia en ${campo}: ${fila.jugadorId}`);
    }
    pendientes.delete(fila.jugadorId);
  }
  for (const id of pendientes.keys()) errores.push(`Identidad ausente: ${id}`);
  return errores;
}

// Oracle independiente: SQL agregado, sin invocar el cálculo del dominio.
const AMBITO_SQL = `WITH ambito AS (
  SELECT p.id FROM partidos p
  JOIN jornadas j ON j.id = p.jornada_id
  JOIN competiciones c ON c.id = j.competicion_id
  WHERE c.temporada_id = ?1 AND c.categoria = ?2 AND (?3 IS NULL OR c.id = ?3)
)`;
const FILAS_SQL = `${AMBITO_SQL},
pa AS (
  SELECT jugador_id, count(*) convocados, sum(titular) titularidades, sum(jugo) partidosJugados
  FROM partido_participaciones WHERE partido_id IN (SELECT id FROM ambito) GROUP BY jugador_id
),
ea AS (
  SELECT jugador_id,
    sum(tipo = 'gol' AND lado = 'propio' AND propia = 0) goles,
    sum(tipo = 'gol' AND lado = 'rival' AND propia = 1) golesPropia,
    sum(tipo = 'tarjeta_amarilla' AND lado = 'propio') amarillas,
    sum(tipo = 'tarjeta_roja' AND lado = 'propio') rojas
  FROM partido_eventos WHERE partido_id IN (SELECT id FROM ambito) AND jugador_id IS NOT NULL
    AND ((tipo = 'gol' AND ((lado = 'propio' AND propia = 0) OR (lado = 'rival' AND propia = 1)))
      OR (lado = 'propio' AND tipo IN ('tarjeta_amarilla', 'tarjeta_roja')))
  GROUP BY jugador_id
),
plantilla AS (SELECT * FROM jugadores_temporada WHERE temporada_id = ?1 AND categoria = ?2),
ids AS (SELECT jugador_id FROM pa UNION SELECT jugador_id FROM ea UNION SELECT jugador_id FROM plantilla)
SELECT ids.jugador_id jugadorId, j.nombre, j.apodo, jt.dorsal, jt.foto,
  jt.id IS NULL inscripcionAusente,
  coalesce(pa.convocados, 0) convocados, coalesce(pa.titularidades, 0) titularidades,
  coalesce(pa.partidosJugados, 0) partidosJugados, coalesce(ea.goles, 0) goles,
  coalesce(ea.golesPropia, 0) golesPropia, coalesce(ea.amarillas, 0) amarillas, coalesce(ea.rojas, 0) rojas
FROM ids JOIN jugadores j ON j.id = ids.jugador_id
LEFT JOIN plantilla jt ON jt.jugador_id = ids.jugador_id
LEFT JOIN pa ON pa.jugador_id = ids.jugador_id LEFT JOIN ea ON ea.jugador_id = ids.jugador_id`;

export async function auditarEstadisticas(
  lectura: Pick<LecturaEstadisticas, "db" | "ejecutar">,
  ambito: { temporadaId: string; categoria: Categoria; competicionId?: string },
) {
  const calculadas = await leerEstadisticasJugadores(lectura.db, ambito);
  const args = [ambito.temporadaId, ambito.categoria, ambito.competicionId ?? null];
  const sql = await lectura.ejecutar({ sql: FILAS_SQL, args });
  const esperadas: FilaAuditoria[] = sql.rows.map((r) => ({
    jugadorId: String(r.jugadorId),
    nombre: String(r.nombre),
    apodo: r.apodo === null ? null : String(r.apodo),
    dorsal: r.dorsal === null ? null : Number(r.dorsal),
    fotoUrl: r.foto ? urlMedia(String(r.foto)) : null,
    inscripcionAusente: Number(r.inscripcionAusente) === 1,
    convocados: Number(r.convocados),
    titularidades: Number(r.titularidades),
    partidosJugados: Number(r.partidosJugados),
    goles: Number(r.goles),
    golesPropia: Number(r.golesPropia),
    amarillas: Number(r.amarillas),
    rojas: Number(r.rojas),
    golesPenalti: null,
  }));
  const errores = compararFilasEstadisticas(calculadas.filas, esperadas);
  if (calculadas.disponibilidadPenaltis !== false)
    errores.push("Disponibilidad de penaltis incorrecta");
  const balance = await lectura.ejecutar({
    sql: `${AMBITO_SQL}
    SELECT count(*) total, coalesce(sum(propia = 1),0) propiaRival,
      coalesce(sum(propia = 0 AND jugador_id IS NULL),0) sinAutor
    FROM partido_eventos WHERE partido_id IN (SELECT id FROM ambito) AND tipo = 'gol' AND lado = 'propio'`,
    args,
  });
  const b = balance.rows[0];
  if (!b) throw new Error("No se pudo obtener balance SQL");
  const goles = calculadas.filas.reduce((s, f) => s + f.goles, 0);
  const golesPropiaRival = Number(b.propiaRival);
  const golesSinAutor = Number(b.sinAutor);
  if (goles + golesPropiaRival + golesSinAutor !== Number(b.total))
    errores.push("No cuadra balance de goles propios");
  return {
    ambito,
    jugadores: calculadas.filas.length,
    goles,
    golesPropiaRival,
    golesSinAutor,
    sinInscripcion: calculadas.filas.filter((f) => f.inscripcionAusente).length,
    errores,
  };
}
