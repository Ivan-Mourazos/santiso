/**
 * Cola de la libreta para apuntar sin cobertura. Cada cambio se ve al momento en pantalla, se
 * guarda en el almacén del móvil y se envía en cuanto hay red. El servidor aplica por `id`, así
 * que reenviar un lote ya enviado es seguro.
 */
import type { Resultado } from "@/lib/resultado";
import type { EventoDirecto, OperacionDirecto } from "./tipos";

export function claveCola(partidoId: string): string {
  return `santiso:directo:${partidoId}`;
}

const esOperacion = (o: unknown): o is OperacionDirecto => {
  if (!o || typeof o !== "object") return false;
  const x = o as Record<string, unknown>;
  if (x.op === "guardar") return !!x.evento && typeof x.evento === "object";
  if (x.op === "borrar") return typeof x.id === "string";
  if (x.op === "reloj") return !!x.reloj && typeof x.reloj === "object";
  return false;
};

/** La cola guardada en el móvil. Lo que no se entienda se descarta: nunca lanza. */
export function leerCola(
  almacen: Pick<Storage, "getItem">,
  partidoId: string,
): OperacionDirecto[] {
  try {
    const crudo = almacen.getItem(claveCola(partidoId));
    if (!crudo) return [];
    const datos: unknown = JSON.parse(crudo);
    return Array.isArray(datos) ? datos.filter(esOperacion) : [];
  } catch {
    return [];
  }
}

export function escribirCola(
  almacen: Pick<Storage, "setItem" | "removeItem">,
  partidoId: string,
  ops: OperacionDirecto[],
): void {
  if (ops.length === 0) almacen.removeItem(claveCola(partidoId));
  else almacen.setItem(claveCola(partidoId), JSON.stringify(ops));
}

/** Orden de la lista: por parte, minuto (sin minuto al final de su parte) y llegada. */
export function ordenarEventos(eventos: EventoDirecto[]): EventoDirecto[] {
  return eventos
    .map((e, i) => ({ e, i }))
    .sort(
      (a, b) =>
        a.e.parte - b.e.parte ||
        (a.e.minuto ?? Infinity) - (b.e.minuto ?? Infinity) ||
        a.i - b.i,
    )
    .map(({ e }) => e);
}

/** Lo que se ve en pantalla: lo del servidor con la cola pendiente encima. */
export function aplicarLocal(eventos: EventoDirecto[], ops: OperacionDirecto[]): EventoDirecto[] {
  let lista = [...eventos];
  for (const o of ops) {
    if (o.op === "guardar") {
      const i = lista.findIndex((e) => e.id === o.evento.id);
      if (i >= 0) lista[i] = o.evento;
      else lista.push(o.evento);
    } else if (o.op === "borrar") {
      lista = lista.filter((e) => e.id !== o.id);
    }
  }
  return ordenarEventos(lista);
}

/**
 * Quita lo que ya no hace falta enviar: de cada evento, su última operación (un borrado manda
 * aunque el alta no llegara a enviarse); del reloj, el último estado. Respeta el orden.
 */
export function compactar(ops: OperacionDirecto[]): OperacionDirecto[] {
  const ultima = new Map<string, number>();
  ops.forEach((o, i) => {
    const clave = o.op === "reloj" ? "§reloj" : o.op === "guardar" ? o.evento.id : o.id;
    ultima.set(clave, i);
  });
  return ops.filter((o, i) => {
    const clave = o.op === "reloj" ? "§reloj" : o.op === "guardar" ? o.evento.id : o.id;
    return ultima.get(clave) === i;
  });
}

/** Envía la cola en un lote. Si falla o no hay red, no se pierde nada: `enviadas` es 0. */
export async function enviarCola(
  ops: OperacionDirecto[],
  enviar: (ops: OperacionDirecto[]) => Promise<Resultado<null>>,
): Promise<{ enviadas: number; error?: string }> {
  if (ops.length === 0) return { enviadas: 0 };
  try {
    const r = await enviar(ops);
    return r.ok ? { enviadas: ops.length } : { enviadas: 0, error: r.error };
  } catch {
    return { enviadas: 0, error: "Sin conexión" };
  }
}
