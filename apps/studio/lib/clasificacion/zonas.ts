/**
 * Zonas de la clasificación tal y como se editan: un tramo de puestos seguidos por zona. Se
 * guardan como `ReglaClasificacion` (lista de puestos) en la competición.
 */
import type { ReglaClasificacion } from "@santiso/domain";

/** Una zona en pantalla: un tramo de puestos seguidos. */
export interface Fila {
  id: string;
  nombre: string;
  desde: string;
  hasta: string;
  color: string;
}

export const aFila = (r: ReglaClasificacion): Fila => ({
  id: r.id,
  nombre: r.nombre,
  desde: String(Math.min(...r.puestos)),
  hasta: String(Math.max(...r.puestos)),
  color: r.color,
});

export const entero = (texto: string) => {
  const n = Number.parseInt(texto, 10);
  return Number.isInteger(n) ? n : NaN;
};

/** Zonas válidas listas para guardar, o el primer error que se enseña. */
export function validarZonas(
  filas: Fila[],
  equipos: number,
): { zonas: ReglaClasificacion[] } | { error: string } {
  const ocupado = new Map<number, string>();
  const zonas: ReglaClasificacion[] = [];
  for (const f of filas) {
    const nombre = f.nombre.trim();
    if (!nombre) return { error: "Cada zona necesita un nombre." };
    const desde = entero(f.desde);
    const hasta = entero(f.hasta);
    if (!(desde >= 1) || !(hasta >= desde)) {
      return { error: `${nombre}: el tramo de puestos no es válido.` };
    }
    if (equipos > 0 && hasta > equipos) {
      return { error: `${nombre}: la tabla solo tiene ${equipos} puestos.` };
    }
    const puestos = Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i);
    for (const p of puestos) {
      const otra = ocupado.get(p);
      if (otra) return { error: `El puesto ${p} está en «${otra}» y en «${nombre}».` };
      ocupado.set(p, nombre);
    }
    zonas.push({ id: f.id, nombre, puestos, color: f.color });
  }
  return { zonas };
}
