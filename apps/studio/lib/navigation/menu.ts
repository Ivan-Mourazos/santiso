/**
 * El menú del Studio, en un solo sitio: la barra de abajo del móvil, la hoja que abre cada
 * pestaña y el lateral de escritorio salen de aquí. Inicio va directo; el resto abre su hoja.
 */
import type { Seccion } from "./contexto";

export interface EntradaMenu {
  seccion: Seccion;
  label: string;
  /** Lo que hay dentro, en pocas palabras, bajo el nombre. */
  detalle?: string;
  /** Trazo SVG (24 × 24) del icono. */
  icono: string;
  /** Parámetros propios de la entrada: la plantilla de un cartel, su tema. */
  extra?: Record<string, string>;
  /** Solo del administrador: los carteles los lleva el delegado, no el cuerpo técnico. */
  admin?: true;
}

export interface GrupoMenu {
  titulo: string;
  entradas: EntradaMenu[];
  /** Ajustes y catálogos: pastillas pequeñas en vez de tarjetas. */
  forma?: "pastillas";
}

export type IdPestana = "inicio" | "liga" | "equipo" | "carteles" | "mas";

export interface PestanaMenu {
  id: IdPestana;
  label: string;
  icono: string;
  /** Sin grupos, la pestaña lleva directa a su sección. */
  grupos?: GrupoMenu[];
}

const I = {
  inicio: "M4 11l8-7 8 7M6 10v9a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-9",
  liga: "M8 4h8v5a4 4 0 0 1-8 0V4ZM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8",
  equipo:
    "M9 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7ZM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.5a3.5 3.5 0 0 1 0 7M21 20c0-2.6-1.6-4.8-4-5.6",
  carteles:
    "M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1ZM4 16l4.5-4.5 3.5 3.5 3-3 5 5M9 9h.01",
  mas: "M5 12h.01M12 12h.01M19 12h.01",
  calendario: "M4 5h16v15H4ZM4 10h16M9 3v4M15 3v4",
  tabla: "M4 6h16M4 12h16M4 18h16M8 4v16",
  balon: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 7l4 3-1.5 5h-5L8 10Z",
  barras: "M5 20V10M12 20V4M19 20v-7",
  lista: "M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01",
  campo: "M3 5h18v14H3ZM12 5v14M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z",
  persona: "M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM4 21c0-4.4 3.6-8 8-8s8 3.6 8 8",
  silbato: "M9 9a5 5 0 1 0 0 10 5 5 0 0 0 0-10ZM13 11l8-4M9 9V5",
  marcador: "M3 5h18v14H3ZM12 5v14M7 10v4M17 10v4",
  reloj: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 7v5l3 2",
  megafono: "M3 11v2a2 2 0 0 0 2 2h2l6 4V5L7 9H5a2 2 0 0 0-2 2ZM17 9a4 4 0 0 1 0 6",
  firma: "M4 20h16M6 16 16 6l2 2L8 18H6Z",
  estrella: "m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z",
  fiesta: "M4 20 9 7l8 8-13 5ZM14 4v2M19 9h2M17.5 5.5 16 7",
  traer: "M12 3v12M7 10l5 5 5-5M5 21h14",
  escudo: "M12 3 4 6v6c0 4.4 3.4 8.2 8 9 4.6-.8 8-4.6 8-9V6Z",
  moneda: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM15 9.5a3.5 3.5 0 1 0 0 5M8 11h5M8 13.5h5",
  directiva:
    "M8 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM16 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM2 20c0-3 2.7-5 6-5s6 2 6 5M14 15.5c.6-.3 1.3-.5 2-.5 3.3 0 6 2 6 5",
  ajustes:
    "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1",
} as const;

function cartel(
  plantilla: string,
  label: string,
  detalle: string,
  icono: string,
  tema?: string,
): EntradaMenu {
  const extra: Record<string, string> = tema ? { plantilla, tema } : { plantilla };
  return { seccion: "carteles", label, detalle, icono, extra, admin: true };
}

export const MENU: readonly PestanaMenu[] = [
  { id: "inicio", label: "Inicio", icono: I.inicio },
  {
    id: "liga",
    label: "Liga",
    icono: I.liga,
    grupos: [
      {
        titulo: "Competición",
        entradas: [
          {
            seccion: "partidos",
            label: "Partidos",
            detalle: "Jornadas y resultados",
            icono: I.calendario,
          },
          { seccion: "clasificacion", label: "Clasificación", detalle: "La tabla", icono: I.tabla },
          {
            seccion: "liga",
            label: "Goleadores y tarjetas",
            detalle: "De la liga",
            icono: I.balon,
          },
          {
            seccion: "estadisticas",
            label: "Estadísticas",
            detalle: "Del equipo",
            icono: I.barras,
          },
          {
            seccion: "archivo",
            label: "Archivo",
            detalle: "Temporadas pasadas",
            icono: I.reloj,
          },
        ],
      },
    ],
  },
  {
    id: "equipo",
    label: "Equipo",
    icono: I.equipo,
    grupos: [
      {
        titulo: "Esta semana",
        entradas: [
          { seccion: "convocatoria", label: "Convocatoria", detalle: "Quién va", icono: I.lista },
          {
            seccion: "alineacion",
            label: "Once inicial",
            detalle: "Titulares y capitán",
            icono: I.campo,
          },
        ],
      },
      {
        titulo: "Plantilla",
        entradas: [
          {
            seccion: "jugadores",
            label: "Jugadores",
            detalle: "Fichas y dorsales",
            icono: I.persona,
          },
          {
            seccion: "tecnicos",
            label: "Cuerpo técnico",
            detalle: "Entrenadores",
            icono: I.silbato,
          },
        ],
      },
    ],
  },
  {
    id: "carteles",
    label: "Carteles",
    icono: I.carteles,
    grupos: [
      {
        titulo: "Después del partido",
        entradas: [
          cartel("resumo", "Resultado", "Marcador y goles", I.marcador),
          cartel("cronoloxia", "Cronoloxía", "Minuto a minuto", I.reloj),
          cartel("noso11", "O Noso 11", "El once del día", I.equipo),
        ],
      },
      {
        titulo: "Antes del partido",
        entradas: [
          cartel("partido", "Cartel de partido", "Día, hora y campo", I.megafono),
          cartel("proximos", "Próximos partidos", "La axenda del fin de semana", I.calendario),
        ],
      },
      {
        titulo: "Club",
        entradas: [
          cartel("clasificacion", "Clasificación", "Cartel de la tabla", I.tabla),
          cartel("fichaxe", "Fichaje", "Altas y renovaciones", I.firma),
          cartel("comunicado", "Comunicado", "Aviso del club", I.estrella),
          cartel("multiusos", "Celebración", "Títulos y fiestas", I.fiesta, "celebracion"),
        ],
      },
    ],
  },
  {
    id: "mas",
    label: "Más",
    icono: I.mas,
    grupos: [
      {
        titulo: "Federación",
        entradas: [
          {
            seccion: "importar",
            label: "Importar",
            detalle: "Actas, jornadas, PDF",
            icono: I.traer,
          },
          {
            seccion: "federacion",
            label: "Federación",
            detalle: "Qué hay traído",
            icono: I.escudo,
          },
          {
            seccion: "calendario",
            label: "Calendario",
            detalle: "Editar jornadas",
            icono: I.calendario,
          },
        ],
      },
      {
        titulo: "Vestuario",
        entradas: [
          { seccion: "multas", label: "Multas", detalle: "Caja del equipo", icono: I.moneda },
          { seccion: "directiva", label: "Directiva", detalle: "Del club", icono: I.directiva },
        ],
      },
      {
        titulo: "Club y ajustes",
        forma: "pastillas",
        entradas: [
          { seccion: "equipos", label: "Equipos", icono: I.escudo },
          { seccion: "patrocinadores", label: "Patrocinadores y logos", icono: I.estrella },
          { seccion: "temporadas", label: "Temporadas", icono: I.calendario },
          { seccion: "ajustes-graficos", label: "Ajustes gráficos", icono: I.ajustes },
          { seccion: "usuarios", label: "Usuarios", icono: I.persona },
          { seccion: "cuenta", label: "Mi cuenta", icono: I.persona },
        ],
      },
    ],
  },
];

/** Secciones sin entrada propia en el menú y la pestaña a la que pertenecen. */
const PESTANA_DE_OCULTA: Partial<Record<Seccion, IdPestana>> = {
  jornada: "liga",
  equipo: "liga",
  jugador: "equipo",
  actas: "mas",
  "importar-jornada": "mas",
};

/** La pestaña que se enciende estando en esa sección. */
export function pestanaDe(seccion: Seccion | undefined): IdPestana {
  if (!seccion || seccion === "inicio") return "inicio";
  for (const pestana of MENU)
    if (pestana.grupos?.some((g) => g.entradas.some((e) => e.seccion === seccion)))
      return pestana.id;
  return PESTANA_DE_OCULTA[seccion] ?? "mas";
}

/** Los grupos de una pestaña con solo las entradas que quien mira puede abrir. */
export function gruposVisibles(
  pestana: PestanaMenu,
  visibles: ReadonlySet<Seccion>,
  tecnico = false,
): GrupoMenu[] {
  return (pestana.grupos ?? [])
    .map((g) => ({
      ...g,
      entradas: g.entradas.filter((e) => visibles.has(e.seccion) && !(tecnico && e.admin)),
    }))
    .filter((g) => g.entradas.length > 0);
}

/** Las pestañas de quien mira: una sin nada que abrir no sale. */
export function pestanasVisibles(visibles: ReadonlySet<Seccion>, tecnico = false) {
  return MENU.filter((p) => !p.grupos || gruposVisibles(p, visibles, tecnico).length > 0);
}
