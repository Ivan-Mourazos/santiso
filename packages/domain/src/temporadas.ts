const RE_TEMPORADA = /^(\d{2}|\d{4})\s*[/-]\s*(\d{2}|\d{4})$/;

/** "25/26" | "2025-2026" | "2025/26" → "2025/26". */
export function normalizarNombreTemporada(valor: string): string {
  const [, textoInicio, textoFin] = RE_TEMPORADA.exec(valor.trim()) ?? [];
  if (!textoInicio || !textoFin) throw new Error(`Nombre de temporada inválido: "${valor}"`);
  const inicio = textoInicio.length === 2 ? 2000 + Number(textoInicio) : Number(textoInicio);
  const fin =
    textoFin.length === 2 ? Math.floor(inicio / 100) * 100 + Number(textoFin) : Number(textoFin);
  if (fin !== inicio + 1) throw new Error(`Temporada no consecutiva: "${valor}"`);
  return `${inicio}/${String(fin).slice(-2)}`;
}

/**
 * La temporada que tocaría crear después de las que ya hay: la siguiente a la más reciente.
 * Sin ninguna, la que empieza el año de `hoy` (o el anterior, antes de julio: la temporada de
 * fútbol arranca en verano). Los nombres que no se entienden se ignoran.
 */
export function siguienteTemporada(nombres: readonly string[], hoy = new Date()): string {
  let ultimo = -1;
  for (const nombre of nombres) {
    try {
      const inicio = Number(normalizarNombreTemporada(nombre).slice(0, 4));
      if (inicio > ultimo) ultimo = inicio;
    } catch {
      // Un nombre raro no impide proponer la siguiente.
    }
  }
  const inicio = ultimo >= 0 ? ultimo + 1 : hoy.getFullYear() - (hoy.getMonth() < 6 ? 1 : 0);
  return `${inicio}/${String(inicio + 1).slice(-2)}`;
}
