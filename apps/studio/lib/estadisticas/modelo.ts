/**
 * Reglas de la pantalla de estadísticas, sin React ni base de datos, para poder probarlas.
 * El cálculo de las estadísticas es de la 7A: aquí solo se ordena, se filtra y se suma lo que
 * ya viene hecho.
 */

export interface FilaEstadistica {
  jugadorId: string;
  nombre: string;
  apodo: string | null;
  dorsal: number | null;
  fotoUrl: string | null;
  inscripcionAusente: boolean;
  convocados: number;
  titularidades: number;
  partidosJugados: number;
  goles: number;
  golesPropia: number;
  amarillas: number;
  rojas: number;
  golesPenalti: null;
}

/** Columnas numéricas por las que se puede ordenar. `jugador` ordena por nombre. */
export const COLUMNAS = [
  "jugador",
  "dorsal",
  "convocados",
  "titularidades",
  "partidosJugados",
  "goles",
  "golesPropia",
  "amarillas",
  "rojas",
] as const;
export type Columna = (typeof COLUMNAS)[number];

export function esColumna(valor: string): valor is Columna {
  return (COLUMNAS as readonly string[]).includes(valor);
}

const sinTildes = (texto: string) =>
  texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Busca por nombre y por apodo: en el vestuario a casi nadie se le llama por el nombre. */
export function filtrarPorTexto(
  filas: readonly FilaEstadistica[],
  texto: string,
): FilaEstadistica[] {
  const aguja = sinTildes(texto);
  if (!aguja) return [...filas];
  return filas.filter(
    (f) => sinTildes(f.nombre).includes(aguja) || sinTildes(f.apodo ?? "").includes(aguja),
  );
}

/**
 * Orden estable: ante empate manda el orden de la consulta (dorsal y nombre), así la tabla no
 * baila al pulsar dos veces la misma columna.
 */
export function ordenarEstadisticas(
  filas: readonly FilaEstadistica[],
  columna: Columna,
  descendente: boolean,
): FilaEstadistica[] {
  const posicion = new Map(filas.map((f, i) => [f.jugadorId, i]));
  const desempate = (a: FilaEstadistica, b: FilaEstadistica) =>
    (posicion.get(a.jugadorId) ?? 0) - (posicion.get(b.jugadorId) ?? 0);

  return [...filas].sort((a, b) => {
    if (columna === "jugador") {
      const comparado = a.nombre.localeCompare(b.nombre, "es");
      return (descendente ? -comparado : comparado) || desempate(a, b);
    }
    if (columna === "dorsal") {
      // Sin dorsal siempre al final, se ordene como se ordene.
      if (a.dorsal === null || b.dorsal === null) {
        if (a.dorsal === b.dorsal) return desempate(a, b);
        return a.dorsal === null ? 1 : -1;
      }
      const comparado = a.dorsal - b.dorsal;
      return (descendente ? -comparado : comparado) || desempate(a, b);
    }
    const comparado = a[columna] - b[columna];
    return (descendente ? -comparado : comparado) || desempate(a, b);
  });
}

export interface TotalesEstadisticas {
  jugadores: number;
  goles: number;
  golesPropia: number;
  amarillas: number;
  rojas: number;
  /** Inscritos que no llegaron a ser convocados. */
  sinConvocatoria: number;
  /** Aparecen en actas de esta temporada sin estar inscritos en ella. */
  sinInscripcion: number;
}

export function totales(filas: readonly FilaEstadistica[]): TotalesEstadisticas {
  return filas.reduce<TotalesEstadisticas>(
    (acumulado, fila) => ({
      jugadores: acumulado.jugadores + 1,
      goles: acumulado.goles + fila.goles,
      golesPropia: acumulado.golesPropia + fila.golesPropia,
      amarillas: acumulado.amarillas + fila.amarillas,
      rojas: acumulado.rojas + fila.rojas,
      sinConvocatoria: acumulado.sinConvocatoria + Number(fila.convocados === 0),
      sinInscripcion: acumulado.sinInscripcion + Number(fila.inscripcionAusente),
    }),
    {
      jugadores: 0,
      goles: 0,
      golesPropia: 0,
      amarillas: 0,
      rojas: 0,
      sinConvocatoria: 0,
      sinInscripcion: 0,
    },
  );
}

/** Nombre corto para la tabla: el apodo si lo hay, que es como se le llama. */
export function nombreVisible(fila: FilaEstadistica): string {
  return fila.apodo?.trim() || fila.nombre;
}
