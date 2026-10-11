import type { FormaEquipo } from "./modelo";

/** Contexto leído para un partido real: el adaptador comprueba rival y categoría antes de usarlo. */
export interface PreviaCartel {
  categoria: string;
  rivalNombre: string;
  localidad: string;
  club: FormaEquipo;
  rival: FormaEquipo;
}
