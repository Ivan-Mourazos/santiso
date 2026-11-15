/** Medidas de la línea de tiempo del cartel de Resultado, aparte para probarlas sin pintar. */
import { nombreDeCartel, type EventoCartel } from "./modelo";

/** Alto útil de la línea de tiempo, entre el marcador y el pie, en px. */
const ALTO_LINEA = 590;
/** Alto en modo denso: escudos pequeños, sin nombres de equipo, la lista empieza antes. */
const ALTO_DENSO = 690;
/** Alto que se come el resumen de amarillas de abajo, cuando lo hay. */
const ALTO_RESUMEN = 130;
/** Separador «DESCANSO» entre las dos partes. */
const ALTO_DESCANSO = 40;
/** Ancho de la línea: 1080 − 2 × 64. Cada fila: lado local · minuto · lado visitante. */
const ANCHO_LINEA = 952;
/** Separación entre cada lado y la pastilla del minuto. */
const HUECO = 16;
/** Con más incidencias, las amarillas salen de la línea y van a un resumen abajo. */
export const MAX_EN_LINEA = 13;

/**
 * Qué va en la línea de tiempo. Hasta `max` incidencias, todas; con más, la línea se queda con
 * goles, rojas, dobles amarillas y cambios, y las amarillas pasan al resumen de cada equipo.
 */
export function filasLinea(eventos: readonly EventoCartel[], max = MAX_EN_LINEA) {
  if (eventos.length <= max)
    return { enLinea: [...eventos], amarillasLocal: [], amarillasVisitante: [] };
  const amarilla = (e: EventoCartel) => e.tipo === "amarilla";
  return {
    enLinea: eventos.filter((e) => !amarilla(e)),
    amarillasLocal: eventos.filter((e) => amarilla(e) && e.lado === "local"),
    amarillasVisitante: eventos.filter((e) => amarilla(e) && e.lado === "visitante"),
  };
}

/**
 * Letra y aire de la línea de tiempo central: la letra más grande (de 56 a 30 px; 26 en modo
 * denso) con la que caben todas las filas, contando las líneas que ocupa cada nombre en su
 * mitad a ese tamaño; lo que sobra se reparte entre las filas. `resumen`: hay amarillas abajo.
 */
export function medidasLinea(eventos: readonly EventoCartel[], resumen: boolean) {
  const minuto = anchoMinuto(eventos);
  const lineasA = (cuerpo: number) => {
    // Mitad de la fila menos la pastilla del minuto; quita icono y separaciones. Letra
    // condensada en mayúsculas: ~0,5 em por carácter, con margen.
    const mitad = (ANCHO_LINEA - (cuerpo * minuto + 24) - 2 * HUECO) / 2;
    const caracteres = Math.max(6, Math.floor((mitad - 52) / (cuerpo * 0.5)));
    const lineas = (texto: string) =>
      Math.max(1, Math.ceil(nombreDeCartel(texto).length / caracteres));
    return eventos.reduce(
      (total, e) =>
        total + (e.tipo === "cambio" ? lineas(e.entra) + lineas(e.jugador) : lineas(e.jugador)),
      0,
    );
  };
  const filas = Math.max(1, eventos.length);
  const altoDe = (cuerpo: number) => lineasA(cuerpo) * cuerpo * 1.3 + filas * 10 + ALTO_DESCANSO;
  // Primero, la letra más grande con la que cada nombre va en una sola línea (cada cambio, en
  // dos); si ni a 36 px caben así, la que quepa en alto aunque algún nombre parta.
  const sinPartir = eventos.reduce((n, e) => n + (e.tipo === "cambio" ? 2 : 1), 0);
  const enUnaLinea = (cuerpo: number) => lineasA(cuerpo) === sinPartir;
  const intentar = (alto: number, minimo: number) => {
    let c = 56;
    while (c > 36 && (altoDe(c) > alto || !enUnaLinea(c))) c -= 2;
    if (enUnaLinea(c) && altoDe(c) <= alto) return c;
    c = 56;
    while (c > minimo && altoDe(c) > alto) c -= 2;
    return altoDe(c) <= alto ? c : null;
  };
  const resta = resumen ? ALTO_RESUMEN : 0;
  // Si ni a 30 px cabe, modo denso: el marcador encoge y la línea gana alto.
  let alto = ALTO_LINEA - resta;
  let cuerpo = intentar(alto, 30);
  const denso = cuerpo === null;
  if (cuerpo === null) {
    alto = ALTO_DENSO - resta;
    cuerpo = intentar(alto, 26) ?? 26;
  }
  const aire = Math.max(4, Math.min(40, Math.floor(((alto - altoDe(cuerpo)) * 0.7) / filas)));
  return { cuerpo, aire, minuto, denso };
}

/** Alto útil de cada columna en el modo de dos columnas. */
const ALTO_COLUMNA = 590;
/** Ancho de cada columna: (1080 − 2 × 64 − 32) / 2. */
const ANCHO_COLUMNA = 460;
/** Con más filas en la línea central, se pasa a una columna por equipo. */
export const MAX_CENTRAL = 16;

/**
 * Modo columnas (muchísimas incidencias): una columna por equipo, como el diseño anterior.
 * Letra y aire de la línea de tiempo: la letra más grande (de 56 a 30 px; 26 en modo denso) con la que caben las
 * dos columnas, contando las líneas que ocupa cada nombre a ese tamaño; lo que sobra se reparte
 * entre las filas para que no quede todo el hueco abajo.
 */
export function medidasColumnas(columnas: readonly (readonly EventoCartel[])[]) {
  const minuto = anchoMinuto(columnas.flat());
  const lineasA = (cuerpo: number, lista: readonly EventoCartel[]) => {
    // Hueco del nombre: la columna menos minuto, icono y separaciones. Letra condensada en
    // mayúsculas: ~0,5 em por carácter, con margen.
    const caracteres = Math.max(
      6,
      Math.floor((ANCHO_COLUMNA - cuerpo * minuto - 52) / (cuerpo * 0.5)),
    );
    const lineas = (texto: string) =>
      Math.max(1, Math.ceil(nombreDeCartel(texto).length / caracteres));
    return lista.reduce(
      (total, e) =>
        total + (e.tipo === "cambio" ? lineas(e.entra) + lineas(e.jugador) : lineas(e.jugador)),
      0,
    );
  };
  const filas = Math.max(1, ...columnas.map((c) => c.length));
  const altoDe = (cuerpo: number) =>
    Math.max(...columnas.map((c) => lineasA(cuerpo, c))) * cuerpo * 1.3 + filas * 10;
  // Primero, la letra más grande con la que cada nombre va en una sola línea (cada cambio, en
  // dos); si ni a 36 px caben así, la que quepa en alto aunque algún nombre parta.
  const enUnaLinea = (cuerpo: number) =>
    columnas.every(
      (c) => lineasA(cuerpo, c) === c.reduce((n, e) => n + (e.tipo === "cambio" ? 2 : 1), 0),
    );
  const intentar = (alto: number, minimo: number) => {
    let c = 56;
    while (c > 36 && (altoDe(c) > alto || !enUnaLinea(c))) c -= 2;
    if (enUnaLinea(c) && altoDe(c) <= alto) return c;
    c = 56;
    while (c > minimo && altoDe(c) > alto) c -= 2;
    return altoDe(c) <= alto ? c : null;
  };
  // Si ni a 30 px cabe, modo denso: el marcador encoge y la lista gana alto.
  let alto = ALTO_COLUMNA;
  let cuerpo = intentar(ALTO_COLUMNA, 30);
  const denso = cuerpo === null;
  if (cuerpo === null) {
    alto = ALTO_DENSO;
    cuerpo = intentar(ALTO_DENSO, 26) ?? 26;
  }
  const aire = Math.max(4, Math.min(48, Math.floor(((alto - altoDe(cuerpo)) * 0.7) / filas)));
  return { cuerpo, aire, minuto, denso };
}

/** Ancho del minuto, en em del cuerpo: más si hay descuento («90+2'»). */
function anchoMinuto(eventos: readonly EventoCartel[]) {
  return eventos.some((e) => e.minuto.includes("+")) ? 2.2 : 1.42;
}

/** Ordena el descuento detrás de su minuto base, sin confundirlo con otra parte. */
export function ordenMinuto(minuto: string) {
  const m = /^(\d+)(?:\s*\+\s*(\d+))?/.exec(minuto);
  return m ? Number(m[1]) + Number(m[2] ?? 0) / 1000 : 999;
}

/** 45+N sigue siendo primera parte; 90+N sigue siendo segunda. */
export function esPrimeraParte(minuto: string) {
  const m = /^(\d+)/.exec(minuto);
  return m !== null && Number(m[1]) <= 45;
}
