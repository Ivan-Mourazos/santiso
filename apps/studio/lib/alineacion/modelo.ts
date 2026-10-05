/**
 * Alineación anunciada antes del partido: lo que se elige en pantalla (móvil) y el cartel en
 * formato historia que sale de ello. Puro: sin base de datos ni navegador.
 */
import type { JugadorOnce, PeticionCartel } from "@/lib/cartel2/modelo";

export const TITULARES = 11;
export const MAX_SUPLENTES = 12;

export interface PartidoAlineacion {
  id: string;
  competicion: string;
  jornada: number;
  /** Hora de pared `AAAA-MM-DDTHH:mm`, o `null` si aún no tiene. */
  fecha: string | null;
  campo: string | null;
  santisoLocal: boolean;
  santiso: { nombre: string; escudoUrl: string | null; escudo3d: boolean };
  rival: { nombre: string; escudoUrl: string | null; escudo3d: boolean; color: string | null };
  /** Ya jugado: la alineación se puede ver, pero no cambiar. */
  finalizado: boolean;
}

export interface JugadorAlineacion {
  id: string;
  nombre: string;
  apodo: string | null;
  dorsal: number | null;
  fotoUrl: string | null;
  /** Primer capitán de la plantilla: el que se propone al elegirlo de titular. */
  capitan: boolean;
}

/** Lo elegido, en el orden en que sale en el cartel. */
export interface Alineacion {
  titulares: string[];
  suplentes: string[];
  capitanId: string | null;
}

export interface PantallaAlineacion {
  partidos: PartidoAlineacion[];
  partidoId: string | null;
  jugadores: JugadorAlineacion[];
  alineacion: Alineacion;
}

export const ALINEACION_VACIA: Alineacion = { titulares: [], suplentes: [], capitanId: null };

export type Papel = "titular" | "suplente" | "fuera";

export function papelDe(alineacion: Alineacion, jugadorId: string): Papel {
  if (alineacion.titulares.includes(jugadorId)) return "titular";
  if (alineacion.suplentes.includes(jugadorId)) return "suplente";
  return "fuera";
}

/**
 * Un toque sobre un jugador: fuera → titular → suplente → fuera. Con los once titulares ya
 * elegidos, quien está fuera pasa directamente a suplente. Si sale el capitán, deja de serlo.
 */
export function alternar(alineacion: Alineacion, jugadorId: string): Alineacion {
  const papel = papelDe(alineacion, jugadorId);
  const sin = {
    titulares: alineacion.titulares.filter((id) => id !== jugadorId),
    suplentes: alineacion.suplentes.filter((id) => id !== jugadorId),
  };
  if (papel === "fuera" && alineacion.titulares.length < TITULARES) {
    return { ...alineacion, titulares: [...sin.titulares, jugadorId] };
  }
  if (papel === "fuera" || papel === "titular") {
    const capitanId = alineacion.capitanId === jugadorId ? null : alineacion.capitanId;
    if (sin.suplentes.length >= MAX_SUPLENTES) return { ...sin, capitanId };
    return { ...sin, suplentes: [...sin.suplentes, jugadorId], capitanId };
  }
  return { ...sin, capitanId: alineacion.capitanId };
}

/** Marca o desmarca al capitán; solo puede serlo un titular. */
export function conCapitan(alineacion: Alineacion, jugadorId: string): Alineacion {
  if (!alineacion.titulares.includes(jugadorId)) return alineacion;
  return { ...alineacion, capitanId: alineacion.capitanId === jugadorId ? null : jugadorId };
}

/** `null` si se puede guardar; si no, el motivo. */
export function errorDeAlineacion(alineacion: Alineacion): string | null {
  const todos = [...alineacion.titulares, ...alineacion.suplentes];
  if (new Set(todos).size !== todos.length) return "Hay un jugador repetido.";
  if (alineacion.titulares.length > TITULARES) return `Como mucho ${TITULARES} titulares.`;
  if (alineacion.suplentes.length > MAX_SUPLENTES) return `Como mucho ${MAX_SUPLENTES} suplentes.`;
  if (alineacion.capitanId && !alineacion.titulares.includes(alineacion.capitanId)) {
    return "El capitán tiene que ser titular.";
  }
  return null;
}

/** Nombre del cartel: el apodo si lo tiene; si no, el nombre. */
export const nombreDeCartel = (j: Pick<JugadorAlineacion, "nombre" | "apodo">) =>
  j.apodo?.trim() || j.nombre;

/** Titulares por dorsal (sin dorsal, al final); el orden de la lista del cartel. */
export function ordenarPorDorsal(ids: string[], jugadores: JugadorAlineacion[]): string[] {
  const dorsal = new Map(jugadores.map((j) => [j.id, j.dorsal ?? 999]));
  return [...ids].sort((a, b) => (dorsal.get(a) ?? 999) - (dorsal.get(b) ?? 999));
}

export interface RecursosAlineacion {
  institucionales: string[];
  patrocinadores: string[];
  /** Color del rival si no lo tiene puesto en Equipos (sacado del escudo o el de reserva). */
  colorRival: string;
}

/** El cartel en formato historia de una alineación. */
export function peticionDeAlineacion(
  categoria: string,
  partido: PartidoAlineacion,
  jugadores: JugadorAlineacion[],
  alineacion: Alineacion,
  recursos: RecursosAlineacion,
): PeticionCartel {
  const porId = new Map(jugadores.map((j) => [j.id, j]));
  const aCartel = (id: string): JugadorOnce | null => {
    const j = porId.get(id);
    if (!j) return null;
    return {
      dorsal: j.dorsal === null ? "" : String(j.dorsal),
      nombre: nombreDeCartel(j),
      capitan: alineacion.capitanId === id,
    };
  };
  const lista = (ids: string[]) =>
    ordenarPorDorsal(ids, jugadores)
      .map(aCartel)
      .filter((j): j is JugadorOnce => j !== null);
  const [fecha = "", hora = ""] = (partido.fecha ?? "").split("T");
  return {
    plantilla: "alineacion",
    datos: {
      institucionales: recursos.institucionales,
      patrocinadores: recursos.patrocinadores,
      categoria,
      competicion: partido.competicion,
      jornada: String(partido.jornada),
      club: {
        nombre: categoria === "Veteranos" ? "UD Santiso FC Solaina" : "UD Santiso FC",
        escudo: partido.santiso.escudoUrl,
        propio: true,
        color: "#f5c518",
        relieve: !partido.santiso.escudo3d,
      },
      rival: {
        nombre: partido.rival.nombre,
        escudo: partido.rival.escudoUrl,
        propio: false,
        color: partido.rival.color ?? recursos.colorRival,
        relieve: !partido.rival.escudo3d,
      },
      local: partido.santisoLocal,
      fecha,
      hora: hora.slice(0, 5),
      campo: partido.campo ?? "",
      titulares: lista(alineacion.titulares),
      suplentes: lista(alineacion.suplentes),
    },
  };
}
