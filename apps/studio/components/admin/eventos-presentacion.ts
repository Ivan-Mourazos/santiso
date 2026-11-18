import type { TipoEvento } from "@santiso/domain";

export const ICONO: Record<TipoEvento, string> = {
  gol: "⚽",
  tarjeta_amarilla: "🟨",
  tarjeta_roja: "🟥",
  cambio: "🔁",
};

export const NOMBRE_TIPO: Record<TipoEvento, string> = {
  gol: "Gol",
  tarjeta_amarilla: "Amarilla",
  tarjeta_roja: "Roja",
  cambio: "Cambio",
};
