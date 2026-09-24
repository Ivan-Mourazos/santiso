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

const RE_PARTIDO = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2})(?:[:.hH](\d{2}))?\s*[hH]?)?$/;

/**
 * Fecha y hora de un partido tal como se guarda: hora de pared `AAAA-MM-DDTHH:mm`, o solo
 * `AAAA-MM-DD` si aún no se sabe la hora. Nunca con zona ni segundos: la hora que se escribe es
 * la que se lee, haya o no cambio de hora entre medias. Admite horas como «7:00», «19.00»,
 * «19h» o «19:00 h». Vacío → `null`. Lo que no entiende lanza error: mejor no guardar que
 * guardar otra hora.
 */
export function fechaHoraDePartido(valor: string): string | null {
  const texto = valor.trim();
  if (!texto) return null;
  const m = RE_PARTIDO.exec(texto);
  if (!m) throw new Error(`Fecha u hora no válida: "${texto}". Usa 2026-11-08T17:00.`);
  const [, a, mes, d, h, min] = m;
  const dia = new Date(Date.UTC(Number(a), Number(mes) - 1, Number(d)));
  if (dia.getUTCMonth() !== Number(mes) - 1 || dia.getUTCDate() !== Number(d)) {
    throw new Error(`Fecha no válida: "${texto}".`);
  }
  const fecha = `${a}-${mes}-${d}`;
  if (h === undefined) return fecha;
  const hora = Number(h);
  const minutos = Number(min ?? "0");
  if (hora > 23 || minutos > 59) throw new Error(`Hora no válida: "${texto}".`);
  return `${fecha}T${String(hora).padStart(2, "0")}:${String(minutos).padStart(2, "0")}`;
}
