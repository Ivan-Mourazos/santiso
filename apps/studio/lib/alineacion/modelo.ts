/**
 * Alineación anunciada antes del partido: lo que se elige en pantalla (móvil) y el cartel en
 * formato historia que sale de ello. Puro: sin base de datos ni navegador.
 */
import type { Posicion } from "@santiso/domain";
import type { JugadorOnce, PeticionCartel } from "@/lib/cartel2/modelo";
import { completar, type Colocacion, type Huecos, type Sistema } from "@/lib/cartel2/tactica";
import type { AvisoJugador } from "@/lib/liga/avisos";

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
  /** Posición en la plantilla de la temporada: decide su hueco en el dibujo táctico. */
  posicion: Posicion | null;
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
  /** Sanciones y apercibidos de la liga para el partido elegido. */
  avisos: AvisoJugador[];
  /** Dónde va cada titular en el campo, si ya se guardó. */
  colocacion: Colocacion | null;
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

/** Sistema con el que se dibuja un once sin colocación guardada. */
export const SISTEMA_POR_DEFECTO: Sistema = "4-4-2";

/**
 * Dónde va cada titular en el campo: lo guardado si lo hay (quitando a quien ya no es titular)
 * y los que falten colocados por su posición en la plantilla.
 */
export function colocacionDeAlineacion(
  jugadores: JugadorAlineacion[],
  alineacion: Alineacion,
  guardada: Colocacion | null,
): Colocacion {
  const porId = new Map(jugadores.map((j) => [j.id, j]));
  const titulares = ordenarPorDorsal(alineacion.titulares, jugadores).map((id) => ({
    id,
    posicion: porId.get(id)?.posicion ?? null,
  }));
  const sistema = guardada?.sistema ?? SISTEMA_POR_DEFECTO;
  return { sistema, huecos: completar(sistema, guardada?.huecos ?? [], titulares) };
}

/** Lo común de los carteles de antes del partido: logos, competición, los dos equipos y cuándo. */
export function cabeceraDePartido(
  categoria: string,
  partido: PartidoAlineacion,
  recursos: RecursosAlineacion,
) {
  const [fecha = "", hora = ""] = (partido.fecha ?? "").split("T");
  return {
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
  };
}

/** Jugadores del cartel por dorsal (sin dorsal, al final), con apodo y capitán. */
export function listaDeCartel(
  ids: string[],
  jugadores: JugadorAlineacion[],
  capitanId: string | null,
): JugadorOnce[] {
  const porId = new Map(jugadores.map((j) => [j.id, j]));
  return ordenarPorDorsal(ids, jugadores).flatMap((id) => {
    const j = porId.get(id);
    return j
      ? [
          {
            dorsal: j.dorsal === null ? "" : String(j.dorsal),
            nombre: nombreDeCartel(j),
            capitan: capitanId === id,
          },
        ]
      : [];
  });
}

/** El cartel del once inicial: el campo táctico en formato historia (9:16). */
export function peticionDeAlineacion(
  categoria: string,
  partido: PartidoAlineacion,
  jugadores: JugadorAlineacion[],
  alineacion: Alineacion,
  recursos: RecursosAlineacion,
  colocacion: Colocacion | null = null,
): PeticionCartel {
  const { sistema, huecos } = colocacionDeAlineacion(jugadores, alineacion, colocacion);
  return {
    plantilla: "campo",
    formato: "historia",
    datos: {
      ...cabeceraDePartido(categoria, partido, recursos),
      momento: "previa",
      golesClub: null,
      golesRival: null,
      sistema,
      huecos: huecos.map((id, i) => {
        const [j] = id ? listaDeCartel([id], jugadores, alineacion.capitanId) : [];
        return j ? { ...j, portero: i === 0 } : null;
      }),
      suplentes: listaDeCartel(alineacion.suplentes, jugadores, alineacion.capitanId),
    },
  };
}

/**
 * La alineación que resulta de tocar el campo: los titulares son los que están en él (en el
 * orden de los huecos); quien sale pasa el primero al banco y deja de ser capitán; quien entra
 * desde el banco (o desde fuera) deja de ser suplente.
 */
export function aplicarColocacion(alineacion: Alineacion, huecos: Huecos): Alineacion {
  const enCampo = [...new Set(huecos.filter((id): id is string => id !== null))];
  const salen = alineacion.titulares.filter((id) => !enCampo.includes(id));
  const suplentes = [...salen, ...alineacion.suplentes.filter((id) => !enCampo.includes(id))];
  return {
    titulares: enCampo,
    suplentes: suplentes.slice(0, MAX_SUPLENTES),
    capitanId:
      alineacion.capitanId && enCampo.includes(alineacion.capitanId) ? alineacion.capitanId : null,
  };
}

/**
 * Un toque en el banquillo: quien no es titular entra o sale de los suplentes (como mucho
 * `MAX_SUPLENTES`). A los titulares no les afecta: salen del once desde el campo.
 */
export function alternarSuplente(alineacion: Alineacion, jugadorId: string): Alineacion {
  if (alineacion.titulares.includes(jugadorId)) return alineacion;
  if (alineacion.suplentes.includes(jugadorId))
    return { ...alineacion, suplentes: alineacion.suplentes.filter((id) => id !== jugadorId) };
  if (alineacion.suplentes.length >= MAX_SUPLENTES) return alineacion;
  return { ...alineacion, suplentes: [...alineacion.suplentes, jugadorId] };
}
