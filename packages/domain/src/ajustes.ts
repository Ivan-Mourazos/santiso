import { z } from "zod";

export const ORDENES_LOGOS = ["xunta_izquierda", "rfgf_izquierda"] as const;

const claveMedia = z.string().min(1);

/** Ajustes globales: clave → esquema de su valor JSON. */
export const AJUSTES = {
  "club.escudo": claveMedia,
  "cartel.logo_xunta": claveMedia,
  "cartel.logo_rfgf": claveMedia,
  "cartel.orden_logos": z.enum(ORDENES_LOGOS),
} as const;

export type ClaveAjuste = keyof typeof AJUSTES;
export type ValorAjuste<K extends ClaveAjuste> = z.infer<(typeof AJUSTES)[K]>;

export function esClaveAjuste(valor: string): valor is ClaveAjuste {
  return Object.hasOwn(AJUSTES, valor);
}

export function validarAjuste<K extends ClaveAjuste>(clave: K, valor: unknown): ValorAjuste<K> {
  // TS no correlaciona la clave genérica con su esquema concreto; el parse garantiza la forma.
  return AJUSTES[clave].parse(valor) as ValorAjuste<K>;
}
