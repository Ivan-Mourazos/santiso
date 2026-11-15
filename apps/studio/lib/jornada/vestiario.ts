import {
  estadoPaso,
  PASOS_DESPUES,
  type CartelGuardado,
  type PasoCartel,
} from "@/lib/cartel2/pasos";
import type { PartidoDeLaSemana } from "@/lib/server/consultas/jornada";

/** Carteles guardados de un partido, por paso. */
export type CartelesDelPartido = Partial<Record<PasoCartel, CartelGuardado[]>>;

/** Hora de pared local, igual que las fechas guardadas en el calendario. */
export function momentoLocal(ahora = new Date()) {
  const n = (v: number) => String(v).padStart(2, "0");
  return `${ahora.getFullYear()}-${n(ahora.getMonth() + 1)}-${n(ahora.getDate())}T${n(ahora.getHours())}:${n(ahora.getMinutes())}`;
}

/** Veteranos no hace convocatoria ni once: solo el Senior prepara el partido así. */
export function preparaConvocatoria(categoria: string) {
  return categoria !== "Veteranos";
}

export function tieneResultado(p: PartidoDeLaSemana) {
  return p.golesSantiso !== null && p.golesRival !== null;
}

/**
 * El marcador como se escribe en el fútbol: goles del local, goles del visitante, y delante lo
 * que significó para el Santiso. «3–8 Santiso / rival» se leía al revés tras perder 8–3 fuera.
 */
export function marcador(p: PartidoDeLaSemana) {
  if (p.golesSantiso === null || p.golesRival === null) return null;
  const cifras = p.santisoLocal
    ? `${p.golesSantiso}–${p.golesRival}`
    : `${p.golesRival}–${p.golesSantiso}`;
  const desenlace =
    p.golesSantiso > p.golesRival ? "Victoria" : p.golesSantiso < p.golesRival ? "Derrota" : "Empate";
  return { cifras, desenlace };
}

/** Pasar la hora de inicio no significa que el partido haya terminado. */
export function trasPartido(p: PartidoDeLaSemana, ahora: string) {
  if (p.estado === "aplazado" || p.estado === "cancelado" || p.estado === "en_juego") return false;
  if (p.estado === "finalizado" || tieneResultado(p)) return true;
  if (!p.fecha?.includes("T")) return false;
  const fin = new Date(p.fecha);
  fin.setMinutes(fin.getMinutes() + 120);
  return !Number.isNaN(fin.getTime()) && momentoLocal(fin) <= ahora;
}

/** Días que el recién jugado sigue en la mesa para cerrarlo, si no tiene aún sus carteles. */
export const DIAS_PARA_CERRAR = 2;

/** El carrusel de después del partido (Resultado y O Noso 11) ya está guardado. */
export function cierreHecho(carteles: CartelesDelPartido) {
  return PASOS_DESPUES.every(
    (paso) => estadoPaso(carteles[paso]) !== "pendiente",
  );
}

/**
 * Si el recién jugado (`diaUltimo`) sigue en la mesa: el mismo día siempre; después, hasta
 * DIAS_PARA_CERRAR días mientras le falten carteles, salvo que hoy se juegue el próximo.
 */
export function sigueEnMesa(
  diaUltimo: string | null | undefined,
  diaProximo: string | null | undefined,
  ahora: string,
  cerrado: boolean,
) {
  const hoy = ahora.slice(0, 10);
  if (!diaUltimo) return false;
  if (diaUltimo.slice(0, 10) === hoy) return true;
  if (cerrado || diaProximo?.slice(0, 10) === hoy) return false;
  const dias = Math.round((Date.parse(hoy) - Date.parse(diaUltimo.slice(0, 10))) / 86_400_000);
  return dias > 0 && dias <= DIAS_PARA_CERRAR;
}

/**
 * El día del partido se cierra el recién jugado, y sigue hasta dos días más mientras le falten
 * los carteles de después. Luego vuelve a mandar el próximo.
 */
export function partidoEnMesa(
  proximo: PartidoDeLaSemana | null,
  ultimo: PartidoDeLaSemana | null,
  ahora: string,
) {
  if (ultimo && sigueEnMesa(ultimo.fecha, proximo?.fecha, ahora, ultimo.cierreHecho ?? false))
    return ultimo;
  return proximo ?? ultimo;
}
