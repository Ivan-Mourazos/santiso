/** Medidas de la línea de tiempo del cartel de cronoloxía, aparte para probarlas sin pintar. */
import { nombreDeCartel, type EventoCartel } from "./modelo";

/** Alto útil de cada columna (una por equipo), entre el marcador y el pie, en px. */
const ALTO_COLUMNA = 590;
/** Alto en modo denso: escudos pequeños, sin nombres de equipo, la lista empieza antes. */
const ALTO_DENSO = 700;
/** Ancho de cada columna: (1080 − 2 × 64 − 32) / 2. */
const ANCHO_COLUMNA = 460;

/**
 * Letra y aire de la línea de tiempo: la letra más grande (de 56 a 30 px; 26 en modo denso) con la que caben las
 * dos columnas, contando las líneas que ocupa cada nombre a ese tamaño; lo que sobra se reparte
 * entre las filas para que no quede todo el hueco abajo.
 */
export function medidasLinea(columnas: readonly (readonly EventoCartel[])[]) {
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
