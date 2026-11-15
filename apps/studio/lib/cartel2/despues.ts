import type { Player } from "@/lib/cartel/types";
import { completar, depurar, type Colocacion } from "./tactica";

export const claveJugador = (j: Player) => j.jugadorId ?? j.id;

/** La final es una elección explícita; solo la propuesta inicial se completa sola. */
export function onceDespues(
  titulares: Player[],
  suplentes: Player[],
  final: Colocacion | null,
  previa: Colocacion | null,
) {
  const todos = [
    ...new Map(
      [...titulares, ...suplentes].filter((j) => j.nome.trim()).map((j) => [claveJugador(j), j]),
    ).values(),
  ];
  const sistema = final?.sistema ?? previa?.sistema ?? "4-4-2";
  const huecos = final
    ? depurar(final.huecos, todos.map(claveJugador))
    : completar(
        sistema,
        previa?.huecos ?? [],
        titulares
          .filter((j) => j.nome.trim())
          .map((j) => ({ id: claveJugador(j), posicion: j.posicion ?? null })),
      );
  const porId = new Map(todos.map((j) => [claveJugador(j), j]));
  return {
    colocacion: { sistema, huecos },
    titulares: huecos.flatMap((id) => (id && porId.has(id) ? [porId.get(id)!] : [])),
    suplentes: todos.filter((j) => !huecos.includes(claveJugador(j))),
  };
}

export function estadoCarrusel(
  estados: readonly ("pendiente" | "desactualizado" | "hecho")[],
  firmaActual: string,
  firmaGenerada: string,
) {
  if (estados.includes("pendiente")) return "pendiente";
  return estados.includes("desactualizado") || firmaActual !== firmaGenerada
    ? "desactualizado"
    : "hecho";
}

export function archivosActuales<T>(
  descargados: { clave: string; archivos: T[] } | null,
  clave: string,
) {
  return descargados?.clave === clave ? descargados.archivos : null;
}
