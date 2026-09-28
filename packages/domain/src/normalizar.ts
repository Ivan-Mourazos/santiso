/**
 * Textos uniformes para equipos, campos, competiciones y personas: mayúscula inicial, partículas
 * en minúscula, siglas con puntos y sin palabras que repiten la categoría. Las actas y el
 * calendario federativo traen los nombres en MAYÚSCULAS y sin tildes; aquí se dejan como se
 * escriben.
 */

/** Partículas que van en minúscula salvo al principio. */
// Los artículos (A, O, As, Os) no: en gallego abren topónimos y van en mayúscula («As Cancelas»).
const PARTICULAS = new Set(["de", "do", "da", "dos", "das", "del", "y", "e"]);

/** Siglas escritas sin puntos que se reconocen tal cual. */
const SIGLAS: Record<string, string> = {
  ud: "U.D.",
  cd: "C.D.",
  sd: "S.D.",
  cf: "C.F.",
  fc: "F.C.",
  sdc: "S.D.C.",
  scd: "S.C.D.",
  csd: "C.S.D.",
  acud: "A.C.U.D.",
  sr: "S.R.",
  se: "S.E.",
  ad: "A.D.",
  caf: "CAF",
  usc: "USC",
  cfhs: "CFHS",
};

/** Tildes que el texto federativo en mayúsculas pierde. Clave sin tilde → palabra correcta. */
const TILDES: Record<string, string> = {
  balompie: "balompié",
  breogan: "breogán",
  portugues: "portugués",
  boqueixon: "boqueixón",
  bermes: "bermés",
  atletico: "atlético",
  union: "unión",
  arzua: "arzúa",
  lalin: "lalín",
  camballon: "camballón",
  compania: "compañía",
  maria: "maría",
  ramon: "ramón",
  jesus: "jesús",
  pampin: "pampín",
  angel: "ángel",
  rua: "rúa",
};

const sinTildes = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "");

function conTildes(palabra: string) {
  const clave = sinTildes(palabra).toLowerCase();
  // Solo si la palabra venía sin tilde: una tilde escrita a propósito no se toca.
  return palabra.toLowerCase() === clave && TILDES[clave] ? TILDES[clave] : palabra.toLowerCase();
}

const mayuscula = (s: string) => s.charAt(0).toLocaleUpperCase("es") + s.slice(1);

/** «S.D.E», «c.», «S.D.» → letras en mayúscula con punto: «S.D.E.», «C.», «S.D.». */
function siglaConPuntos(token: string) {
  return token
    .replace(/\./g, "")
    .toUpperCase()
    .split("")
    .map((l) => `${l}.`)
    .join("");
}

const esSiglaConPuntos = (t: string) => /^(\p{L}\.)+\p{L}?\.?$/u.test(t) || /^\p{L}\.$/u.test(t);

/** Una palabra suelta, según su posición. */
function palabra(token: string, primera: boolean): string {
  if (!token) return token;
  // Filial entre comillas: «"B"».
  const filial = /^["«“](\p{L})["»”]$/u.exec(token);
  if (filial) return `"${filial[1]!.toUpperCase()}"`;
  if (esSiglaConPuntos(token)) return siglaConPuntos(token);
  const clave = sinTildes(token).toLowerCase().replace(/\.$/, "");
  if (SIGLAS[clave] && token.replace(/\./g, "").length <= 4) return SIGLAS[clave];
  // Ordinales y números: «1ª», «2º», «3».
  if (/^\d/.test(token)) return token.toLowerCase();
  // Palabras con guion interno: «Portugues-Boqueixon».
  if (token.includes("-") && token.length > 1) {
    return token
      .split("-")
      .map((p, i) => palabra(p, primera && i === 0) || p)
      .map((p, i) => (i > 0 ? mayuscula(p) : p))
      .join("-");
  }
  const base = conTildes(token);
  if (!primera && PARTICULAS.has(base)) return base;
  return mayuscula(base);
}

/** Aplica mayúsculas y tildes palabra a palabra, respetando paréntesis, comas y guiones. */
function frase(texto: string): string {
  const limpio = texto
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+-\s*|\s*-\s+/g, " - ")
    .trim();
  const tokens = limpio.split(" ");
  const salida: string[] = [];
  tokens.forEach((t, i) => {
    const previa = salida[salida.length - 1];
    const primera = i === 0 || previa === "-" || previa?.endsWith("(") === true;
    const apertura = t.startsWith("(") ? "(" : "";
    const cierre = t.endsWith(")") ? ")" : "";
    const nucleo = t.slice(apertura.length, t.length - cierre.length);
    const hecha = nucleo === "-" ? "-" : palabra(nucleo, primera || apertura === "(");
    salida.push(`${apertura}${hecha}${cierre}`);
  });
  // Siglas seguidas se juntan: «S.D.E. C.» → «S.D.E.C.».
  return salida.join(" ").replace(/((?:\p{Lu}\.)+) (?=(?:\p{Lu}\.)+(?:\s|$))/gu, "$1");
}

/** ¿Está todo en mayúsculas o todo en minúsculas? Entonces nadie lo escribió a mano. */
function sinCuidar(texto: string) {
  const letras = texto.replace(/[^\p{L}]/gu, "");
  return letras === letras.toUpperCase() || letras === letras.toLowerCase();
}

/**
 * Nombre de equipo. En veteranos quita «Veteranos»/«Veterans»: la categoría ya se ve en todas
 * partes y en los carteles sobraba.
 */
export function normalizarNombreEquipo(nombre: string, categoria: string): string {
  let texto = nombre;
  if (/^vet/i.test(categoria)) {
    const sin = texto
      .replace(/(?<=^|\s|-)(veteranos|veterans|vet\.?)(?=\s|$|-)/giu, " ")
      .replace(/\s+/g, " ")
      .replace(/^[-\s]+|[-\s]+$/g, "")
      .trim();
    // Solo si queda un nombre de verdad: alguna palabra que no sea una sigla.
    const quedaNombre = sin
      .split(/[\s-]+/)
      .some((t) => t.length >= 3 && !esSiglaConPuntos(t) && !SIGLAS[sinTildes(t).toLowerCase()]);
    if (quedaNombre) texto = sin;
  }
  return frase(texto);
}

/**
 * Campo. Si no hay población y el nombre la lleva detrás de un guion, una coma o entre
 * paréntesis al final («A Rega- Pontepedra», «O Vedral ,Abella», «Municipal de Loxo (Touro)»),
 * se separa. «Mpal», «Munic.» y «Campo Municipal» quedan en «Municipal».
 */
export function normalizarCampo(
  nombre: string,
  poblacion: string | null,
): { nombre: string; poblacion: string | null } {
  let n = nombre
    .replace(/^campo\s+municipal\b/iu, "Municipal")
    .replace(/(?<=^|\s)(mpal|munic)\.?(?=\s)/giu, "Municipal")
    .trim();
  let p = poblacion?.trim() || null;
  if (!p) {
    const partes = /^(.+?)\s*(?:-|,)\s*([^-,()]+)$/u.exec(n) ?? /^(.+?)\s*\(([^()]+)\)$/u.exec(n);
    if (partes) {
      n = partes[1]!;
      p = partes[2]!;
    }
  }
  return { nombre: frase(n), poblacion: p ? frase(p) : null };
}

/** Competición: «Gr. 3» → «Grupo 3». */
export function normalizarNombreCompeticion(nombre: string): string {
  const texto = nombre.replace(/\bgr\.\s*(\d+)/giu, "Grupo $1");
  return sinCuidar(texto) ? frase(texto) : texto.replace(/\s+/g, " ").trim();
}

/** Persona: solo se toca si está toda en mayúsculas o en minúsculas; si no, alguien la cuidó. */
export function normalizarNombrePersona(nombre: string): string {
  const texto = nombre.replace(/\s+/g, " ").trim();
  return sinCuidar(texto) ? frase(texto) : texto;
}
