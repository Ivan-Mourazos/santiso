const RE_FECHA_HORA = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/;
const RE_FECHA = /^(\d{4}-\d{2}-\d{2})/;

/** "2026-09-27T17:00:00+00:00" → "2026-09-27T17:00". Hora de pared tal cual se guardó, sin convertir zona. */
export function aFechaHoraLiteral(valor: string): string {
  const [, fecha, hora] = RE_FECHA_HORA.exec(valor) ?? [];
  if (!fecha || !hora) throw new Error(`Fecha-hora inválida: "${valor}"`);
  return `${fecha}T${hora}`;
}

/** "2025-10-26T00:00:00+00:00" o "2025-10-26" → "2025-10-26". */
export function aFechaLiteral(valor: string): string {
  const [, fecha] = RE_FECHA.exec(valor) ?? [];
  if (!fecha) throw new Error(`Fecha inválida: "${valor}"`);
  return fecha;
}

/** Instante con zona → ISO UTC con milisegundos ("2026-04-20T19:34:47.623Z"). */
export function aInstanteIso(valor: string): string {
  const instante = new Date(valor);
  if (Number.isNaN(instante.getTime())) throw new Error(`Instante inválido: "${valor}"`);
  return instante.toISOString();
}
