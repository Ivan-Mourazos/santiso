/**
 * Historial deportivo de un jugador. Se guarda como una lista de líneas «25/26: Club» (lo que ya
 * había); aquí se convierte a filas de temporada + club para editarlo sin escribir el formato.
 */
export interface FilaHistorial {
  /** «25/26». Vacía si la línea guardada no llevaba temporada reconocible. */
  temporada: string;
  equipo: string;
}

const LINEA = /^(\d{2}|\d{4})\s*[/-]\s*(\d{2}|\d{4})\s*:\s*(.*)$/u;
const dosCifras = (anio: string) => anio.slice(-2);

/** «2025/26», «2025-2026» o «25/26» → «25/26». `null` si no es una temporada. */
export function normalizarTemporada(texto: string): string | null {
  const m = /^(\d{2}|\d{4})\s*[/-]\s*(\d{2}|\d{4})$/u.exec(texto.trim());
  return m ? `${dosCifras(m[1]!)}/${dosCifras(m[2]!)}` : null;
}

export function filasDeHistorial(texto: string): FilaHistorial[] {
  return texto
    .split(/\r?\n/u)
    .map((linea) => linea.trim())
    .filter(Boolean)
    .map((linea) => {
      const m = LINEA.exec(linea);
      return m
        ? { temporada: `${dosCifras(m[1]!)}/${dosCifras(m[2]!)}`, equipo: m[3]!.trim() }
        : { temporada: "", equipo: linea };
    });
}

/** De vuelta al texto que se guarda. Una fila sin club no se guarda. */
export function textoDeHistorial(filas: readonly FilaHistorial[]): string {
  return filas
    .filter((fila) => fila.equipo.trim())
    .map((fila) =>
      fila.temporada ? `${fila.temporada}: ${fila.equipo.trim()}` : fila.equipo.trim(),
    )
    .join("\n");
}

/** La temporada anterior a «25/26» es «24/25». Sin temporada de partida, `""`. */
export function temporadaAnterior(temporada: string): string {
  const m = /^(\d{2})\/(\d{2})$/u.exec(temporada);
  if (!m) return "";
  const inicio = (Number(m[1]) + 99) % 100;
  return `${String(inicio).padStart(2, "0")}/${m[1]}`;
}

/** La temporada en curso en esa fecha: de julio en adelante empieza la nueva. */
export function temporadaDe(fecha: Date): string {
  const inicio = fecha.getMonth() >= 6 ? fecha.getFullYear() : fecha.getFullYear() - 1;
  return `${String(inicio % 100).padStart(2, "0")}/${String((inicio + 1) % 100).padStart(2, "0")}`;
}

/** Las temporadas que se ofrecen al elegir: de la actual hacia atrás. */
export function temporadasPosibles(hoy: Date, cuantas = 40): string[] {
  const lista = [temporadaDe(hoy)];
  while (lista.length < cuantas) lista.push(temporadaAnterior(lista.at(-1)!));
  return lista;
}

/**
 * La fila que se añade al pulsar «Añadir temporada»: la anterior a la última de la lista y con
 * su mismo club (lo normal es seguir en el mismo). Sin filas, la temporada actual.
 */
export function filaSiguiente(filas: readonly FilaHistorial[], hoy: Date): FilaHistorial {
  const ultima = filas.at(-1);
  if (!ultima) return { temporada: temporadaDe(hoy), equipo: "" };
  return { temporada: temporadaAnterior(ultima.temporada), equipo: ultima.equipo };
}
