import { parecido } from "@/lib/importar/emparejar";

/** Lo que hace falta de una fila para comparar: de la oficial o de la del Studio. */
export interface FilaComparable {
  equipo: string;
  puntos: number;
  jugados: number;
  golesFavor: number;
  golesContra: number;
}

/** Cómo queda la clasificación del Studio frente a la oficial de la federación. */
export interface ComparacionClasificacion {
  /** La jornada hasta la que llega la oficial. */
  jornada: number;
  /** ISO de cuándo se comparó. */
  comparadaEn: string;
  /** Lo que no coincide, una frase por equipo. Vacío si todo cuadra. */
  diferencias: string[];
  /** Equipos a los que el comité ha quitado puntos, según la federación. */
  sanciones: { equipo: string; puntos: number }[];
}

const MINIMO_PARECIDO = 0.5;

/**
 * Compara, equipo a equipo, la tabla oficial con la que calcula el Studio. Los equipos se casan
 * por nombre (la federación los escribe en mayúsculas y a veces distinto). Una diferencia de
 * puntos igual a la sanción que publica la federación se cuenta como lo que es: una sanción que
 * el Studio no conoce, no un resultado mal metido.
 */
export function compararClasificacion(
  oficial: readonly (FilaComparable & { sancion: number })[],
  propia: readonly FilaComparable[],
): Pick<ComparacionClasificacion, "diferencias" | "sanciones"> {
  const diferencias: string[] = [];
  const libres = [...propia];
  for (const fila of oficial) {
    const mejor = libres
      .map((candidata) => ({ candidata, puntos: parecido(fila.equipo, candidata.equipo) }))
      .sort((a, b) => b.puntos - a.puntos)[0];
    if (!mejor || mejor.puntos < MINIMO_PARECIDO) {
      diferencias.push(`${fila.equipo}: está en la oficial y no lo encuentro en el Studio.`);
      continue;
    }
    libres.splice(libres.indexOf(mejor.candidata), 1);
    const nuestra = mejor.candidata;
    const motivos: string[] = [];
    if (fila.jugados !== nuestra.jugados) {
      motivos.push(`${fila.jugados} partidos jugados en la oficial y ${nuestra.jugados} aquí`);
    }
    if (fila.puntos !== nuestra.puntos) {
      motivos.push(
        fila.sancion > 0 && nuestra.puntos - fila.puntos === fila.sancion
          ? `la federación le quita ${fila.sancion} puntos de sanción (${fila.puntos} oficiales, ${nuestra.puntos} aquí)`
          : `${fila.puntos} puntos en la oficial y ${nuestra.puntos} aquí`,
      );
    }
    if (fila.golesFavor !== nuestra.golesFavor || fila.golesContra !== nuestra.golesContra) {
      motivos.push(
        `goles ${fila.golesFavor}–${fila.golesContra} en la oficial y ${nuestra.golesFavor}–${nuestra.golesContra} aquí`,
      );
    }
    if (motivos.length) diferencias.push(`${nuestra.equipo}: ${motivos.join("; ")}.`);
  }
  for (const sobra of libres) {
    diferencias.push(`${sobra.equipo}: está en el Studio y no en la oficial.`);
  }
  return {
    diferencias,
    sanciones: oficial
      .filter((fila) => fila.sancion > 0)
      .map((fila) => ({ equipo: fila.equipo, puntos: fila.sancion })),
  };
}
