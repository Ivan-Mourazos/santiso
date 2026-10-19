/**
 * El listado público de clubes de la federación: la exportación «Excel» de futgal.es, que en
 * realidad es una tabla HTML en ISO-8859-1. Sin el filtro por nombre trae todos los clubes de
 * Galicia en una sola respuesta. Aquí se lee y se empareja cada equipo del Studio con su club.
 */

import { claveNombre, normalizarNombreEquipo, normalizarNombrePersona } from "@santiso/domain";

const BASE = "https://www.futgal.es/pnfg/NPcd/NFG_LstClubes_Campos_Excel";

/** Las columnas que se piden: datos del club, equipación y equipos. Nada de contactos ni junta. */
const COLUMNAS: Record<string, string> = {
  cod_primaria: "1000118",
  entra: "1",
  NPcd_File: "1",
  Campo_delegacion_comarca: "1",
  Campo_domicilio: "1",
  Campo_contacto: "0",
  Campo_junta_directiva: "0",
  Campo_baja_bloqueo_administrativo: "0",
  Campo_primera_equipacion: "1",
  Campo_patrocinador: "0",
  Campo_patrocinios: "0",
  Campo_fecha_inicio_patrocinios: "0",
  Campo_fecha_fin_patrocinios: "0",
  Campo_fecha_cancelacion_patrocinios: "0",
  Campo_observaciones_patrocinios: "0",
  Campo_datos_equipos: "1",
  Campo_observaciones: "0",
  Campo_rango_habitantes: "0",
  NPcd_Page: "1",
};

/** La exportación de clubes; con `nombre`, solo los que lo contienen. */
export function urlClubesExcel(nombre?: string): string {
  const consulta = new URLSearchParams(COLUMNAS);
  if (nombre?.trim()) consulta.set("nclub", nombre.trim());
  return `${BASE}?${consulta}`;
}

export interface ClubRfgf {
  codigo: string;
  /** Con las reglas de nombres de equipo. */
  nombre: string;
  clave: string;
  delegacion: string | null;
  comarca: string | null;
  direccion: string | null;
  localidad: string | null;
  provincia: string | null;
  codigoPostal: string | null;
  /** `AAAA-MM-DD`. */
  fechaFundacion: string | null;
  fechaInscripcionFederacion: string | null;
  camiseta: string | null;
  pantalon: string | null;
  medias: string | null;
  numeroEquipos: number | null;
}

const ENTIDADES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  quot: '"',
  lt: "<",
  gt: ">",
  apos: "'",
  aacute: "á",
  eacute: "é",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  ntilde: "ñ",
  uuml: "ü",
  ccedil: "ç",
  ordf: "ª",
  ordm: "º",
};

function texto(html: string): string {
  return html
    .replace(/<[^>]*>/gu, " ")
    .replace(/&#(\d+);/gu, (_, codigo: string) => String.fromCodePoint(Number(codigo)))
    .replace(/&([a-z]+);/giu, (entera, nombre: string) => {
      const letra = ENTIDADES[nombre.toLowerCase()];
      if (!letra) return entera;
      // «&Aacute;» → «Á».
      return nombre[0] === nombre[0]!.toUpperCase() ? letra.toUpperCase() : letra;
    })
    .replace(/[\s ]+/gu, " ")
    .trim();
}

/** Las celdas de una fila. La última de cada fila a veces no se cierra: se corta en la siguiente. */
const celdas = (fila: string) =>
  fila
    .split(/<td[^>]*>/iu)
    .slice(1)
    .map((celda) => texto(celda.replace(/<\/td>[\s\S]*$/iu, "")));

/** «21-08-2014» → «2014-08-21». */
function fecha(valor: string): string | null {
  const m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/u.exec(valor);
  return m ? `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}` : null;
}

/** Vacío, «0» o «-» es que la federación no lo tiene. */
const dato = (valor: string | undefined) => {
  const limpio = (valor ?? "").trim();
  return !limpio || limpio === "0" || limpio === "-" ? null : limpio;
};

/** Textos de lugar: con la regla de «solo si nadie lo cuidó» (todo en mayúsculas o minúsculas). */
const lugar = (valor: string | undefined) => {
  const limpio = dato(valor);
  return limpio ? normalizarNombrePersona(limpio) : null;
};

/**
 * Lee la exportación de clubes. Las columnas se buscan por su cabecera, no por su posición:
 * la federación las quita o las añade según lo que se pida.
 */
export function parsearClubesExcel(html: string): ClubRfgf[] {
  const filas = [...html.matchAll(/<tr[^>]*>([\s\S]*?)(?=<tr[^>]*>|<\/table>|$)/giu)].map((m) =>
    celdas(m[1]!),
  );
  const cabecera = filas.findIndex((f) => f.some((c) => claveNombre(c) === "clave acceso"));
  if (cabecera < 0) throw new Error("No es el listado de clubes de la federación.");
  const columnas = filas[cabecera]!.map(claveNombre);
  const columna = (nombre: string) => columnas.indexOf(nombre);
  const indice = {
    codigo: columna("clave acceso"),
    nombre: columna("nombre"),
    delegacion: columna("delegacion"),
    comarca: columna("comarca"),
    direccion: columna("direccion"),
    localidad: columna("localidad"),
    provincia: columna("provincia"),
    codigoPostal: columna("codigo postal"),
    fundacion: columna("fecha fundacion"),
    inscripcion: columna("fecha inscripcion federacion"),
    camiseta: columna("camiseta"),
    pantalon: columna("pantalon"),
    medias: columna("medias"),
    equipos: columna("numero equipos"),
  };
  if (indice.codigo < 0 || indice.nombre < 0) throw new Error("Faltan columnas en el listado.");
  const clubes: ClubRfgf[] = [];
  const vistos = new Set<string>();
  for (const fila of filas.slice(cabecera + 1)) {
    const valor = (i: number) => (i >= 0 ? fila[i] : undefined);
    const codigo = valor(indice.codigo) ?? "";
    const crudo = dato(valor(indice.nombre));
    if (!/^\d+$/u.test(codigo) || !crudo || vistos.has(codigo)) continue;
    vistos.add(codigo);
    const nombre = normalizarNombreEquipo(crudo.replace(/\s+/gu, " "), "Senior");
    const equipos = dato(valor(indice.equipos));
    clubes.push({
      codigo,
      nombre,
      clave: claveNombre(nombre),
      delegacion: lugar(valor(indice.delegacion)),
      comarca: lugar(valor(indice.comarca)),
      direccion: lugar(valor(indice.direccion)),
      localidad: lugar(valor(indice.localidad)),
      provincia: lugar(valor(indice.provincia)),
      codigoPostal: dato(valor(indice.codigoPostal)),
      fechaFundacion: fecha(valor(indice.fundacion) ?? ""),
      fechaInscripcionFederacion: fecha(valor(indice.inscripcion) ?? ""),
      camiseta: lugar(valor(indice.camiseta)),
      pantalon: lugar(valor(indice.pantalon)),
      medias: lugar(valor(indice.medias)),
      numeroEquipos: equipos && /^\d+$/u.test(equipos) ? Number(equipos) : null,
    });
  }
  return clubes;
}

/** Palabras de la forma jurídica: no distinguen a un club de otro. */
const FORMAS = new Set([
  "club",
  "clube",
  "sociedad",
  "sociedade",
  "deportiva",
  "deportivo",
  "desportiva",
  "desportivo",
  "cultural",
  "recreativa",
  "recreativo",
  "union",
  "unio",
  "futbol",
  "football",
  "balompie",
  "asociacion",
  "agrupacion",
  "atletico",
  "veteranos",
  "veterans",
  "vet",
  "de",
  "del",
  "do",
  "da",
  "dos",
  "das",
  "y",
  "e",
]);

/** Siglas sin puntos que equivalen a esas formas («UD», «SDC»…). */
const SIGLAS = new Set([
  "ud",
  "cd",
  "sd",
  "cf",
  "fc",
  "sdc",
  "scd",
  "csd",
  "acud",
  "sr",
  "se",
  "ad",
  "sad",
  "cdf",
  "ccd",
  "ac",
  "acd",
  "ard",
  "cdr",
  "sdr",
  "sdcr",
  "cdc",
  "ucd",
  "uc",
  "ucf",
  "sdrc",
]);

/** «S.D.C.», «C.S.D», «F.C.»: una sigla escrita con puntos. */
const esSiglaConPuntos = (t: string) => /^(\p{L}\.)+\p{L}?\.?$/u.test(t);

/**
 * Lo que distingue a un club por su nombre: sin forma jurídica, sin siglas y sin la letra de un
 * filial. «S.D.C. Recesende» y «SOCIEDAD DEPORTIVA CULTURAL RECESENDE» → «recesende»; «C.S.D
 * Arzúa "B"» → «arzua»; «U.D. Santiso F.C. Solaina» → «santiso solaina».
 */
export function nucleoDeNombre(nombre: string): string {
  const sinSiglas = nombre
    .split(/\s+/u)
    .filter((t) => !esSiglaConPuntos(t.replace(/^["«“(]+|["»”),]+$/gu, "")))
    .join(" ");
  const palabras = claveNombre(sinSiglas)
    .split(" ")
    .filter((p) => p && !FORMAS.has(p) && !SIGLAS.has(p));
  // La letra suelta del final es un filial: «Arzúa B» es del club de Arzúa.
  if (palabras.length > 1 && palabras.at(-1)!.length === 1) palabras.pop();
  return palabras.join(" ");
}

/** Palabras de la forma jurídica que no cuentan para la sigla (artículos y categoría). */
const SIN_SIGLA = new Set([
  "de",
  "del",
  "do",
  "da",
  "dos",
  "das",
  "y",
  "e",
  "veteranos",
  "veterans",
  "vet",
]);

/**
 * Las letras de la forma jurídica: «A.C.U.D. Camporrapado» y «Asociación Club Unión Deportiva
 * Camporrapado» → «acud»; «U.D. Santiso F.C.» y «Unión Deportiva Santiso F.C.» → «udfc».
 */
export function siglaDeNombre(nombre: string): string {
  let sigla = "";
  for (const crudo of nombre.split(/\s+/u)) {
    const token = crudo.replace(/^["«“(]+|["»”),]+$/gu, "");
    if (esSiglaConPuntos(token)) {
      sigla += claveNombre(token).replace(/ /gu, "");
      continue;
    }
    const palabra = claveNombre(token);
    if (SIGLAS.has(palabra)) sigla += palabra;
    else if (FORMAS.has(palabra) && !SIN_SIGLA.has(palabra)) sigla += palabra[0];
  }
  return sigla;
}

/** Dos siglas casan si una está contenida en la otra («S.D.» en «Club … S.D.»); vacía casa con todo. */
function siglasCasan(a: string, b: string): boolean {
  const contenida = (corta: string, larga: string) => {
    const resto = [...larga];
    for (const letra of corta) {
      const i = resto.indexOf(letra);
      if (i < 0) return false;
      resto.splice(i, 1);
    }
    return true;
  };
  return a.length <= b.length ? contenida(a, b) : contenida(b, a);
}

/** Un club de veteranos lleva la palabra en el nombre («Veteranos Berres»). */
const esDeVeteranos = (nombre: string) =>
  claveNombre(nombre)
    .split(" ")
    .some((p) => p === "veteranos" || p === "veterans" || p === "vet");

export interface EquipoPorEmparejar {
  id: string;
  nombre: string;
  /** Con ella, un equipo senior no se enlaza con un club de veteranos ni al revés. */
  categoria?: string;
}

export interface Emparejamiento {
  /** Un único club con el mismo núcleo de nombre (y sigla compatible). */
  enlazados: { equipoId: string; codigo: string }[];
  /** Hay donde elegir: o varios con el mismo núcleo, o alguno que se le parece. */
  dudosos: { equipoId: string; candidatos: string[] }[];
  sinClub: string[];
}

/** Cuántos parecidos se ofrecen, como mucho, para elegir a mano. */
const MAXIMO_CANDIDATOS = 6;

/**
 * Empareja equipos con clubes. Solo se enlaza cuando no hay duda: entre los clubes con el
 * mismo núcleo de nombre (de veteranos o no, según la categoría del equipo), uno solo con la
 * sigla compatible. Si hay varios, si la sigla no casa (un «C.S.D.» no es un «C.F.S.») o solo
 * hay parecidos (uno contiene al otro), queda para elegir a mano.
 */
export function emparejarClubes(
  equipos: readonly EquipoPorEmparejar[],
  clubes: readonly { codigo: string; nombre: string }[],
): Emparejamiento {
  const fichas = clubes.map((club) => {
    const nucleo = nucleoDeNombre(club.nombre);
    return {
      codigo: club.codigo,
      nucleo,
      sigla: siglaDeNombre(club.nombre),
      veteranos: esDeVeteranos(club.nombre),
      palabras: new Set(nucleo.split(" ").filter(Boolean)),
    };
  });
  const porNucleo = new Map<string, typeof fichas>();
  for (const ficha of fichas)
    if (ficha.nucleo) porNucleo.set(ficha.nucleo, [...(porNucleo.get(ficha.nucleo) ?? []), ficha]);
  const salida: Emparejamiento = { enlazados: [], dudosos: [], sinClub: [] };
  for (const equipo of equipos) {
    const nucleo = nucleoDeNombre(equipo.nombre);
    if (!nucleo) {
      salida.sinClub.push(equipo.id);
      continue;
    }
    let iguales = porNucleo.get(nucleo) ?? [];
    if (equipo.categoria) {
      const veteranos = /^vet/iu.test(equipo.categoria);
      const deSuCategoria = iguales.filter((c) => c.veteranos === veteranos);
      // Un senior nunca va con un club de veteranos; un veterano, si no hay, con el del pueblo.
      if (deSuCategoria.length || !veteranos) iguales = deSuCategoria;
    }
    const sigla = siglaDeNombre(equipo.nombre);
    const casan = iguales.filter((c) => siglasCasan(sigla, c.sigla));
    if (casan.length === 1) {
      salida.enlazados.push({ equipoId: equipo.id, codigo: casan[0]!.codigo });
      continue;
    }
    if (iguales.length) {
      salida.dudosos.push({
        equipoId: equipo.id,
        candidatos: (casan.length ? casan : iguales)
          .slice(0, MAXIMO_CANDIDATOS)
          .map((c) => c.codigo),
      });
      continue;
    }
    const palabras = nucleo.split(" ");
    const contiene = (a: Set<string>, b: readonly string[]) => b.every((p) => a.has(p));
    const parecidos = fichas
      .filter(
        (c) =>
          c.palabras.size > 0 &&
          (contiene(c.palabras, palabras) || [...c.palabras].every((p) => palabras.includes(p))),
      )
      .map((c) => c.codigo);
    if (parecidos.length)
      salida.dudosos.push({
        equipoId: equipo.id,
        candidatos: parecidos.slice(0, MAXIMO_CANDIDATOS),
      });
    else salida.sinClub.push(equipo.id);
  }
  return salida;
}
