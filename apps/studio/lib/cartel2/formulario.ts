/**
 * Del formulario del Estudio (el mismo que usa el motor antiguo) a la petición de cada cartel del
 * motor nuevo. Puro: los colores de los escudos llegan ya calculados en `color`.
 */
import { claveNombre } from "@santiso/domain";
import type {
  CronEvent,
  FilaCartelClasificacion,
  NextMatch,
  Player,
  RondaCartel,
} from "@/lib/cartel/types";
import type { FormState, TemplateId } from "@/components/admin/cartel/types";
import type {
  Composicion,
  EquipoCartel,
  EventoCartel,
  FotoCartel,
  JugadorOnce,
  PeticionCartel,
  TemaAnuncio,
  TipoEvento,
} from "./modelo";
import { TEMAS_ANUNCIO } from "./modelo";

export interface RecursosCartel {
  /** Escudo del equipo del Santiso de cada categoría (el que se edita en Equipos). */
  escudosClub: Record<string, string>;
  patrocinadores: string[];
  institucionales: string[];
  /** URL de los escudos marcados en Equipos como «ya en 3D»: sin relieve en el cartel. */
  escudosEn3d: string[];
  /** Colores elegidos en Equipos, por `claveNombre` del equipo: mandan sobre el del escudo. */
  coloresEquipo: Record<string, string>;
}

export interface OpcionesCartel {
  /** Color `#rrggbb` del escudo de esa URL (o el de reserva si no tiene). */
  color: (url: string | null) => string;
  composicion: Composicion;
  /** Foto de la galería: fondo del cartel de resultado (con estilo) o foto de «O noso 11». */
  foto: FotoCartel | null;
}

/** Amarillo de la equipación: el color del Santiso en todos los carteles. */
export const COLOR_CLUB = "#f5c518";

/** Escudo del Santiso para una categoría: el de su equipo en Equipos; si no tiene, el del Senior. */
export function escudoClubDe(recursos: RecursosCartel, categoria?: string) {
  return (categoria && recursos.escudosClub[categoria]) || recursos.escudosClub.Senior || "";
}

export function nombreClub(categoria: string) {
  return categoria === "Veteranos" ? "UD Santiso FC Solaina" : "UD Santiso FC";
}

const esSantiso = (nombre: string) => claveNombre(nombre).includes("santiso");

function equipos(
  categoria: string,
  rivalNombre: string,
  rivalEscudo: string,
  santisoSide: "left" | "right",
  recursos: RecursosCartel,
  color: OpcionesCartel["color"],
) {
  const escudoClub = escudoClubDe(recursos, categoria);
  const club: EquipoCartel = {
    nombre: nombreClub(categoria),
    escudo: escudoClub || null,
    propio: true,
    color: COLOR_CLUB,
    relieve: !recursos.escudosEn3d.includes(escudoClub),
  };
  const rival: EquipoCartel = {
    nombre: rivalNombre.trim() || "Rival",
    escudo: rivalEscudo || null,
    propio: false,
    color: recursos.coloresEquipo[claveNombre(rivalNombre)] ?? color(rivalEscudo || null),
    relieve: !recursos.escudosEn3d.includes(rivalEscudo),
  };
  const santisoLocal = santisoSide === "left";
  return {
    club,
    rival,
    local: santisoLocal ? club : rival,
    visitante: santisoLocal ? rival : club,
    santisoLocal,
  };
}

const TIPOS: Record<CronEvent["tipo"], TipoEvento> = {
  gol: "gol",
  penalti: "penalti",
  propia: "propia",
  amarela: "amarilla",
  doble_amarela: "doble_amarilla",
  vermella: "roja",
  cambio: "cambio",
};

/** En el formulario, `equipo: "local"` es el Santiso (no el equipo de casa). */
function eventos(lista: CronEvent[], santisoLocal: boolean): EventoCartel[] {
  return lista
    .filter((e) => e.jugador.trim() || e.tipo === "gol" || e.tipo === "propia")
    .map((e) => ({
      minuto: e.minuto.trim(),
      tipo: TIPOS[e.tipo],
      lado: (e.equipo === "local") === santisoLocal ? "local" : "visitante",
      jugador: e.jugador.trim(),
      entra: e.jugadorEntra?.trim() ?? "",
    }));
}

const numero = (texto: string) => {
  const n = Number.parseInt(texto, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

const jugadores = (lista: Player[]): JugadorOnce[] =>
  lista
    .filter((j) => j.nome.trim())
    .map((j) => ({ dorsal: j.dorsal.trim(), nombre: j.nome.trim(), capitan: j.eCapitan }));

/** Petición de cada plantilla a partir del formulario del Estudio. */
export function peticionDeFormulario(
  tipo: TemplateId,
  form: FormState,
  recursos: RecursosCartel,
  opciones: OpcionesCartel,
): PeticionCartel {
  const logos = {
    institucionales: recursos.institucionales,
    patrocinadores: recursos.patrocinadores,
  };
  const cabecera = {
    categoria: form.categoria,
    competicion: form.competicion,
    jornada: form.jornada,
  };
  const partido = equipos(
    form.categoria,
    form.rivalNombre,
    form.rivalEscudoUrl,
    form.santisoSide,
    recursos,
    opciones.color,
  );

  switch (tipo) {
    case "partido":
      return {
        plantilla: "partido",
        composicion: opciones.composicion,
        datos: {
          ...logos,
          ...cabecera,
          local: partido.local,
          visitante: partido.visitante,
          fecha: form.fecha,
          hora: form.hora,
          campo: form.lugar,
        },
      };
    case "resumo": {
      const goles = eventos(form.events, partido.santisoLocal).filter(
        (e) => e.tipo === "gol" || e.tipo === "penalti" || e.tipo === "propia",
      );
      return {
        plantilla: "resultado",
        datos: {
          ...logos,
          ...cabecera,
          local: partido.local,
          visitante: partido.visitante,
          golesLocal: numero(form.golesLocal),
          golesVisitante: numero(form.golesRival),
          goles: goles.map((g) => ({
            minuto: g.minuto,
            jugador: g.jugador,
            lado: g.lado,
            tipo: g.tipo as "gol" | "penalti" | "propia",
          })),
          fecha: form.fecha,
          campo: form.estadio || form.lugar,
          foto: opciones.foto,
        },
      };
    }
    case "cronoloxia":
      return {
        plantilla: "cronoloxia",
        datos: {
          ...logos,
          ...cabecera,
          local: partido.local,
          visitante: partido.visitante,
          golesLocal: numero(form.golesLocal),
          golesVisitante: numero(form.golesRival),
          eventos: eventos(form.events, partido.santisoLocal),
          fecha: form.fecha,
          campo: form.estadio || form.lugar,
        },
      };
    case "proximos":
      return {
        plantilla: "proximos",
        datos: {
          ...logos,
          partidos: form.matches
            .filter((m: NextMatch) => m.rival.trim())
            .slice(0, 2)
            .map((m) => {
              const e = equipos(
                m.categoria,
                m.rival,
                m.rivalEscudoUrl,
                m.santisoSide,
                recursos,
                opciones.color,
              );
              return {
                categoria: m.categoria,
                local: e.local,
                visitante: e.visitante,
                fecha: m.fecha,
                hora: m.hora,
                campo: m.lugar ?? "",
              };
            }),
        },
      };
    case "noso11":
      return {
        plantilla: "once",
        datos: {
          ...logos,
          ...cabecera,
          club: partido.club,
          rival: form.rivalNombre.trim() ? partido.rival : null,
          fecha: form.fecha,
          campo: form.estadio || form.lugar,
          titulares: jugadores(form.titulares),
          suplentes: jugadores(form.suplentes),
          // Una foto elegida de la galería del partido manda sobre la del jugador; se encuadra
          // por su foco y conserva el zoom del formulario.
          foto: opciones.foto
            ? {
                url: opciones.foto.url,
                x: opciones.foto.x,
                y: opciones.foto.y,
                zoom: form.jugadorZoom,
              }
            : form.jugadorFotoUrl
              ? {
                url: form.jugadorFotoUrl,
                x: form.jugadorXOffset,
                y: form.jugadorYOffset,
                  zoom: form.jugadorZoom,
                }
              : null,
          invertido: form.noso11Flip,
        },
      };
    case "multiusos":
      return {
        plantilla: "anuncio",
        datos: {
          ...logos,
          tema: (form.multiusosTema in TEMAS_ANUNCIO
            ? form.multiusosTema
            : "formal") as TemaAnuncio,
          titulo: form.multiusosTitulo.trim(),
          texto: form.multiusosTexto.trim(),
          imagenes: [form.multiusosImg1Url, form.multiusosImg2Url].filter(Boolean),
          escudoClub: escudoClubDe(recursos) || null,
        },
      };
    case "clasificacion": {
      const base = {
        ...logos,
        categoria: form.categoria,
        titulo: form.clasificacionNombre.trim() || form.competicion,
        escudoClub: escudoClubDe(recursos, form.categoria) || null,
      };
      if (form.clasificacionTipo === "copa") {
        const rondas = form.clasificacionData as RondaCartel[];
        return {
          plantilla: "clasificacion",
          datos: {
            ...base,
            tipo: "copa",
            rondas: rondas.map((r) => ({
              nombre: r.nombre,
              partidos: r.partidos.map((p) => ({
                local: p.equipo_local?.nombre ?? "",
                visitante: p.equipo_visitante?.nombre ?? "",
                golesLocal: p.goles_local ?? null,
                golesVisitante: p.goles_visitante ?? null,
              })),
            })),
          },
        };
      }
      const filas = form.clasificacionData as FilaCartelClasificacion[];
      return {
        plantilla: "clasificacion",
        datos: {
          ...base,
          tipo: "liga",
          filas: filas
            .filter((f) => f.nombre.trim())
            .map((f, i) => ({
              posicion: f.posicion ?? i + 1,
              nombre: f.nombre,
              escudo: f.escudo_url ?? null,
              pj: f.pj,
              pg: f.pg,
              pe: f.pe,
              pp: f.pp,
              gf: f.gf,
              gc: f.gc,
              pts: f.pts,
              propio: esSantiso(f.nombre),
            })),
        },
      };
    }
  }
}
