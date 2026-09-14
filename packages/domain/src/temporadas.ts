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
