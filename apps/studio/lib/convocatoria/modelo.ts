import {
  nombreDeCartel,
  ordenarPorDorsal,
  peticionDeAlineacion,
  type JugadorAlineacion,
  type PartidoAlineacion,
  type RecursosAlineacion,
} from "@/lib/alineacion/modelo";
import { fechaCorta, type PeticionCartel } from "@/lib/cartel2/modelo";
import type { AvisoJugador } from "@/lib/liga/avisos";

export interface Convocatoria {
  jugadores: string[];
  horaQuedada: string;
  lugarQuedada: string;
  equipacion: string;
  nota: string;
}
export interface PantallaConvocatoria {
  partidos: PartidoAlineacion[];
  partidoId: string | null;
  jugadores: JugadorAlineacion[];
  convocatoria: Convocatoria;
  guardada: boolean;
  migracionPendiente: boolean;
  /** Sanciones y apercibidos de la liga para el partido elegido. */
  avisos: AvisoJugador[];
}
export function convocatoriaInicial(ids: string[]): Convocatoria {
  return {
    jugadores: ids.slice(0, 16),
    horaQuedada: "",
    lugarQuedada: "",
    equipacion: "",
    nota: "",
  };
}
/** Situaciones de la liga que dejan al jugador fuera del próximo partido. */
const NO_PUEDEN_JUGAR = new Set(["sancionado", "expulsado"]);

/**
 * Convocatoria que se propone cuando el partido aún no tiene una guardada: los 16 primeros de la
 * plantilla sin los sancionados ni los expulsados, y la quedada y la equipación de la anterior de
 * la categoría (la nota es de cada partido: empieza en blanco).
 */
export function convocatoriaPropuesta(
  ids: string[],
  avisos: readonly Pick<AvisoJugador, "jugadorId" | "situacion">[],
  anterior: Convocatoria | null,
): Convocatoria {
  const fuera = new Set(
    avisos.flatMap((a) => (a.jugadorId && NO_PUEDEN_JUGAR.has(a.situacion) ? [a.jugadorId] : [])),
  );
  return {
    ...convocatoriaInicial(ids.filter((id) => !fuera.has(id))),
    horaQuedada: anterior?.horaQuedada ?? "",
    lugarQuedada: anterior?.lugarQuedada ?? "",
    equipacion: anterior?.equipacion ?? "",
  };
}
export function errorDeConvocatoria(c: Convocatoria): string | null {
  if (!c || !Array.isArray(c.jugadores) || c.jugadores.some((id) => typeof id !== "string" || !id))
    return "Selección de jugadores inválida.";
  if (!c.jugadores.length) return "Selecciona al menos un convocado.";
  if (new Set(c.jugadores).size !== c.jugadores.length) return "Hay un jugador repetido.";
  if (c.jugadores.length > 22)
    return "Selecciona como máximo 22 convocados; una lista mayor necesita dos láminas.";
  if (
    typeof c.horaQuedada !== "string" ||
    (c.horaQuedada && !/^([01]\d|2[0-3]):[0-5]\d$/.test(c.horaQuedada))
  )
    return "La hora de quedada no es válida.";
  for (const [texto, max] of [
    [c.lugarQuedada, 200],
    [c.equipacion, 120],
    [c.nota, 400],
  ] as const) {
    if (typeof texto !== "string" || texto.length > max)
      return `Texto inválido: máximo ${max} caracteres.`;
  }
  return null;
}
export function peticionDeConvocatoria(
  categoria: string,
  partido: PartidoAlineacion,
  jugadores: JugadorAlineacion[],
  c: Convocatoria,
  recursos: RecursosAlineacion,
): PeticionCartel {
  const base = peticionDeAlineacion(
    categoria,
    partido,
    jugadores,
    { titulares: c.jugadores, suplentes: [], capitanId: null },
    recursos,
  );
  if (base.plantilla !== "alineacion") throw new Error("Plantilla inesperada");
  const { titulares, suplentes: _suplentes, ...datos } = base.datos;
  return {
    plantilla: "convocatoria",
    datos: {
      ...datos,
      convocados: titulares,
      horaQuedada: c.horaQuedada,
      lugarQuedada: c.lugarQuedada.trim(),
      equipacion: c.equipacion.trim(),
      nota: c.nota.trim(),
    },
  };
}
export function textoWhatsApp(
  partido: PartidoAlineacion,
  jugadores: JugadorAlineacion[],
  c: Convocatoria,
): string {
  const [fecha = "", hora = ""] = (partido.fecha ?? "").split("T");
  const equipos = partido.santisoLocal
    ? [partido.santiso.nombre, partido.rival.nombre]
    : [partido.rival.nombre, partido.santiso.nombre];
  const porId = new Map(jugadores.map((j) => [j.id, j]));
  return [
    "*CONVOCATORIA*",
    equipos.join(" – "),
    `${partido.competicion} · Xornada ${partido.jornada}`,
    [fechaCorta(fecha), hora].filter(Boolean).join(" · "),
    partido.campo ?? "",
    c.horaQuedada || c.lugarQuedada
      ? `Quedada: ${[c.horaQuedada, c.lugarQuedada].filter(Boolean).join(" · ")}`
      : "",
    c.equipacion ? `Equipación: ${c.equipacion}` : "",
    c.nota,
    "",
    ...ordenarPorDorsal(c.jugadores, jugadores).flatMap((id) => {
      const j = porId.get(id);
      return j ? [`${j.dorsal === null ? "" : `${j.dorsal} · `}${nombreDeCartel(j)}`] : [];
    }),
  ]
    .filter((linea, i) => linea || i === 8)
    .join("\n");
}
