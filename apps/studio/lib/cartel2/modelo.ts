/**
 * Datos de los carteles del motor nuevo (HTML/CSS → PNG). Lo que dibuja un cartel está aquí, ya
 * resuelto: los componentes no consultan nada y la exportación a PNG recibe exactamente lo mismo
 * que la vista previa. De dónde sale cada dato (el formulario del Estudio) está en `formulario.ts`.
 */

/** Composiciones del cartel de partido; la primera es la de por defecto. */
export const COMPOSICIONES = [
  // Un solo diseño de cartel de partido (Iván, 12/10/2026: «quiero unificar diseños»). Hubo
  // un segundo, «Enfrentados», que acabó siendo casi igual; se retiró.
  { id: "diagonal", nombre: "Diagonal" },
] as const;
export type Composicion = (typeof COMPOSICIONES)[number]["id"];

/** Solo publicación 4:5, a ×2 al exportar (2160 × 2700): lo que Instagram muestra sin recortar. */
export const MEDIDAS = { ancho: 1080, alto: 1350 } as const;
/** Historia de Instagram 9:16, a ×2: alineación, Axenda y partido. */
export const MEDIDAS_HISTORIA = { ancho: 1080, alto: 1920 } as const;
/**
 * Franja de arriba y de abajo que la interfaz de Instagram tapa en una historia (perfil,
 * barra de respuesta): ahí no va nada que haya que leer.
 */
export const MARGEN_HISTORIA = 250;

export const PLANTILLAS = [
  "partido",
  "resultado",
  "cronoloxia",
  "proximos",
  "once",
  "anuncio",
  "clasificacion",
  "alineacion",
  "convocatoria",
  "fichaxe",
  "comunicado",
  "loteria",
] as const;
export type Plantilla = (typeof PLANTILLAS)[number];

/** Tamaño del lienzo de cada plantilla (antes de la exportación a ×2). */
export type FormatoCartel = "publicacion" | "historia";
export function medidasDe(plantilla: Plantilla, formato?: FormatoCartel) {
  return plantilla === "alineacion" ||
    (["partido", "proximos"].includes(plantilla) && formato === "historia")
    ? MEDIDAS_HISTORIA
    : MEDIDAS;
}

export interface EquipoCartel {
  nombre: string;
  escudo: string | null;
  propio: boolean;
  /** `#rrggbb`: sacado del escudo en el navegador; el club usa el amarillo de su equipación. */
  color: string;
  /** Segundo color del equipo, si lo tiene elegido en Equipos: se funde con el primero. */
  color2?: string;
  /** Añadir relieve al escudo. No si ya tiene volumen (el del club, o marcado en Equipos). */
  relieve: boolean;
}

/** Tratamiento de la foto de fondo: la de por defecto es la primera. */
export const ESTILOS_FOTO = [
  { id: "color", nombre: "Color" },
  { id: "byn", nombre: "B/N" },
  { id: "amarillo", nombre: "Amarillo" },
] as const;
export type EstiloFoto = (typeof ESTILOS_FOTO)[number]["id"];

/** Foto de fondo: se recorta alrededor de su foco (`x`, `y` entre 0 y 1). */
export interface FotoCartel {
  zoom?: number;
  url: string;
  x: number;
  y: number;
  estilo: EstiloFoto;
}

/** Lo que llevan todos los carteles: logos institucionales (RFGF, Xunta) y patrocinadores. */
export interface Logos {
  institucionales: string[];
  patrocinadores: string[];
}

/** Cabecera de los carteles de competición. */
export interface Competicion {
  categoria: string;
  competicion: string;
  jornada: string;
}

export interface DatosPartido extends Logos, Competicion {
  local: EquipoCartel;
  visitante: EquipoCartel;
  /** `AAAA-MM-DD` o vacío. */
  fecha: string;
  /** `HH:mm` o vacío. */
  hora: string;
  campo: string;
  localidad?: string;
  contexto?: ContextoDeportivo;
  /** Foto de fondo entera, opcional: casi nunca se usa, pero se puede. */
  foto?: FotoCartel | null;
}

export interface FormaEquipo {
  posicion: number | null;
  /** Orden cronológico: más antiguo a más reciente. */
  racha: ("V" | "E" | "D")[];
}
export interface ContextoDeportivo {
  local: FormaEquipo;
  visitante: FormaEquipo;
}

export interface GolCartel {
  minuto: string;
  jugador: string;
  /** Equipo al que sube el gol al marcador. */
  lado: "local" | "visitante";
  tipo: "gol" | "penalti" | "propia";
}

export interface DatosResultado extends Logos, Competicion {
  local: EquipoCartel;
  visitante: EquipoCartel;
  golesLocal: number;
  golesVisitante: number;
  goles: GolCartel[];
  fecha: string;
  campo: string;
  /** Foto del partido: si la hay, es el fondo del cartel. */
  foto: FotoCartel | null;
}

export const TIPOS_EVENTO = [
  "gol",
  "penalti",
  "propia",
  "amarilla",
  "doble_amarilla",
  "roja",
  "cambio",
] as const;
export type TipoEvento = (typeof TIPOS_EVENTO)[number];

export interface EventoCartel {
  minuto: string;
  tipo: TipoEvento;
  lado: "local" | "visitante";
  jugador: string;
  /** Solo en cambios: quien entra (`jugador` es quien sale). */
  entra: string;
}

export interface DatosCronoloxia extends Logos, Competicion {
  local: EquipoCartel;
  visitante: EquipoCartel;
  golesLocal: number;
  golesVisitante: number;
  eventos: EventoCartel[];
  fecha: string;
  campo: string;
  /** Foto de fondo opcional, como en el resumo. */
  foto?: FotoCartel | null;
}

export interface PartidoProximo {
  categoria: string;
  local: EquipoCartel;
  visitante: EquipoCartel;
  fecha: string;
  hora: string;
  campo: string;
  localidad?: string;
  competicion?: string;
  jornada?: string;
  contexto?: ContextoDeportivo;
}

export interface DatosProximos extends Logos {
  partidos: PartidoProximo[];
}

export interface JugadorOnce {
  dorsal: string;
  nombre: string;
  capitan: boolean;
}

export interface DatosOnce extends Logos, Competicion {
  club: EquipoCartel;
  rival: EquipoCartel | null;
  fecha: string;
  campo: string;
  titulares: JugadorOnce[];
  suplentes: JugadorOnce[];
  /** Foto de un jugador o del equipo, con el encuadre del formulario (0–1 y zoom). */
  foto: { url: string; x: number; y: number; zoom: number } | null;
  /** La foto a la derecha y la lista a la izquierda. */
  invertido: boolean;
  modoFoto?: "retrato" | "fondo";
}

/** Alineación anunciada antes del partido, en formato historia. */
export interface DatosAlineacion extends Logos, Competicion {
  foto?: FotoCartel | null;
  club: EquipoCartel;
  rival: EquipoCartel;
  /** El Santiso juega en casa. */
  local: boolean;
  fecha: string;
  hora: string;
  campo: string;
  titulares: JugadorOnce[];
  suplentes: JugadorOnce[];
}

/** Cartel privado 4:5 para el grupo de WhatsApp. */
export interface DatosConvocatoria extends Omit<DatosAlineacion, "titulares" | "suplentes"> {
  convocados: JugadorOnce[];
  horaQuedada: string;
  lugarQuedada: string;
  equipacion: string;
  nota: string;
}

export const TEMAS_ANUNCIO = {
  celebracion: { etiqueta: "CELEBRACIÓN", acento: "#f5c518" },
  medico: { etiqueta: "PARTE MÉDICO", acento: "#ef4444" },
  fichaje: { etiqueta: "NOVA INCORPORACIÓN", acento: "#60a5fa" },
  despedida: { etiqueta: "COMUNICADO OFICIAL", acento: "#d4d4d8" },
  formal: { etiqueta: "COMUNICADO OFICIAL", acento: "#f5c518" },
} as const;
export type TemaAnuncio = keyof typeof TEMAS_ANUNCIO;

export interface DatosAnuncio extends Logos {
  tema: TemaAnuncio;
  titulo: string;
  texto: string;
  imagenes: string[];
  escudoClub: string | null;
}

/** Fichaje, renovación o vuelta: foto a todo el cartel y solo texto, como los clubs profesionales. */
export const TIPOS_FICHAXE = {
  fichaxe: "NOVA INCORPORACIÓN",
  renovacion: "RENOVACIÓN",
  volta: "VOLVE A CASA",
} as const;
export type TipoFichaxe = keyof typeof TIPOS_FICHAXE;

export interface DatosFichaxe {
  tipo: TipoFichaxe;
  /** Nombre (línea pequeña) y apellido o apodo (línea grande). */
  nombre: string;
  apellido: string;
  /** Demarcación, dorsal, temporada…: una línea corta en amarillo. */
  detalle: string;
  frase: string;
  /** Encuadre de la foto: foco (0–1) y zoom, como en O Noso 11. */
  foto: { url: string; x: number; y: number; zoom: number } | null;
  escudoClub: string | null;
  /** El escudo pequeño arriba; sin él, el cartel lleva solo la foto y el texto. */
  conEscudo: boolean;
}

/** Comunicado serio: sin patrocinadores ni texturas, con fecha y firma. */
export const TIPOS_COMUNICADO = {
  oficial: { etiqueta: "COMUNICADO OFICIAL", acento: "#f5c518" },
  medico: { etiqueta: "PARTE MÉDICO", acento: "#ef4444" },
  loito: { etiqueta: "LOITO", acento: "#a1a1aa" },
} as const;
export type TipoComunicado = keyof typeof TIPOS_COMUNICADO;

export interface DatosComunicado {
  tipo: TipoComunicado;
  titulo: string;
  texto: string;
  /** `AAAA-MM-DD`; vacía, sin fecha. */
  fecha: string;
  firma: string;
  escudoClub: string | null;
}

/** Sorteos en los que juega el club: el de Nadal (22 de decembro) y el do Neno (6 de xaneiro). */
export const SORTEOS_LOTERIA = {
  nadal: { etiqueta: "LOTARÍA DE NADAL", dia: "22 de decembro" },
  neno: { etiqueta: "SORTEO DO NENO", dia: "6 de xaneiro" },
} as const;
export type SorteoLoteria = keyof typeof SORTEOS_LOTERIA;

/** Lotaría del club: número (o dous), papeleta, cánto xoga e onde mercala. Sin logos. */
export interface DatosLoteria {
  sorteo: SorteoLoteria;
  /** Ano do sorteo (o do Neno xa é o seguinte ao da tempada). */
  anio: number;
  /** De 1 a 2 números de cinco cifras. */
  numeros: string[];
  titulo: string;
  /** Importes tal cal se escriben: «5», «2,50». Vacíos, non se pintan. */
  prezo: string;
  xoga: string;
  /** Onde mercala: unha liña por sitio. */
  puntos: string;
  escudoClub: string | null;
}

export interface FilaTabla {
  posicion: number;
  nombre: string;
  escudo: string | null;
  pj: number;
  pg: number;
  pe: number;
  pp: number;
  gf: number;
  gc: number;
  pts: number;
  propio: boolean;
}

export interface RondaCopa {
  nombre: string;
  partidos: {
    local: string;
    visitante: string;
    golesLocal: number | null;
    golesVisitante: number | null;
  }[];
}

export type DatosClasificacion = Logos & {
  categoria: string;
  titulo: string;
  escudoClub: string | null;
} & ({ tipo: "liga"; filas: FilaTabla[] } | { tipo: "copa"; rondas: RondaCopa[] });

export type PeticionCartel =
  | { plantilla: "partido"; composicion: Composicion; formato?: FormatoCartel; datos: DatosPartido }
  | { plantilla: "resultado"; datos: DatosResultado }
  | { plantilla: "cronoloxia"; datos: DatosCronoloxia }
  | { plantilla: "proximos"; formato?: FormatoCartel; datos: DatosProximos }
  | { plantilla: "once"; datos: DatosOnce }
  | { plantilla: "anuncio"; datos: DatosAnuncio }
  | { plantilla: "clasificacion"; datos: DatosClasificacion }
  | { plantilla: "alineacion"; datos: DatosAlineacion }
  | { plantilla: "convocatoria"; datos: DatosConvocatoria }
  | { plantilla: "fichaxe"; datos: DatosFichaxe }
  | { plantilla: "comunicado"; datos: DatosComunicado }
  | { plantilla: "loteria"; datos: DatosLoteria };

const DIAS = ["DOMINGO", "LUNS", "MARTES", "MÉRCORES", "XOVES", "VENRES", "SÁBADO"];
const MESES = ["XAN", "FEB", "MAR", "ABR", "MAI", "XUÑ", "XUL", "AGO", "SET", "OUT", "NOV", "DEC"];

/** «2026-09-27» → { dia: "DOMINGO", numero: "27", mes: "SET" }. En gallego, como los carteles. */
export function fechaCartel(fecha: string): { dia: string; numero: string; mes: string } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (!m) return null;
  const [, a, mes, d] = m;
  // Mediodía UTC: el día de la semana no depende de la zona horaria del equipo que lo abre.
  const dia = new Date(Date.UTC(Number(a), Number(mes) - 1, Number(d), 12)).getUTCDay();
  return { dia: DIAS[dia]!, numero: String(Number(d)), mes: MESES[Number(mes) - 1]! };
}

/** «2026-09-27» → «DOMINGO 27 SET»; vacío si no hay fecha. */
export function fechaCorta(fecha: string) {
  const f = fechaCartel(fecha);
  return f ? `${f.dia} ${f.numero} ${f.mes}` : "";
}

/**
 * Un logo de la media local, recortado a su contenido: se guardan centrados en un cuadrado con
 * margen y, sin recortar, un logo ancho se ve diminuto. Las URL de fuera se dejan tal cual.
 */
export function urlLogo(url: string) {
  return url.startsWith("/media/") ? `${url}?recorte=1` : url;
}

/**
 * Una foto de la media local al ancho del cartel exportado (2160 px, ×2): las de partido se
 * guardan hasta 3000 px y no hace falta mover más. Las URL de fuera (`data:`) se dejan tal cual.
 */
export function urlFoto(url: string) {
  return url.startsWith("/media/") && !url.includes("?") ? `${url}?ancho=2160` : url;
}

/** «Senior» → «SÉNIOR»; en gallego, como el resto de textos del cartel. */
export function categoriaCartel(categoria: string) {
  if (categoria === "Veteranos") return "VETERANOS";
  return "SÉNIOR";
}

/**
 * Cuerpo de letra para que `texto` quepa en una línea de `ancho` px. `em` es el ancho medio de
 * un carácter en mayúsculas de esa fuente, en em (Anton ≈ 0,46; Barlow Condensed 800 ≈ 0,5).
 */
export function cuerpo(texto: string, ancho: number, maximo: number, minimo: number, em: number) {
  const n = Math.max(texto.length, 1);
  return Math.max(minimo, Math.min(maximo, Math.floor(ancho / (n * em))));
}

/**
 * Goles de un lado agrupados por jugador: «Bareto ×2». Sin minutos: el minuto a minuto es de la
 * Cronoloxía; el Resultado es el vistazo rápido. En propia lleva «(p.p.)».
 */
/**
 * Nombre de un jugador como sale en el cartel. Las actas de la federación los dan como
 * «APELLIDOS, NOMBRE»: se deja nombre y primer apellido («FRANCISCO MENDEZ»), que cabe en una
 * línea. Los del Santiso ya llegan cortos (apodo o nombre y apellido).
 */
export function nombreDeCartel(nombre: string) {
  const m = /^([^,]+),\s*(.+)$/.exec(nombre.trim());
  if (!m) return nombre.trim();
  const [apellido] = m[1]!.trim().split(/\s+/);
  const [pila] = m[2]!.trim().split(/\s+/);
  return `${pila} ${apellido}`;
}

export function goleadores(goles: GolCartel[], lado: "local" | "visitante") {
  const porJugador = new Map<string, number>();
  for (const g of goles) {
    if (g.lado !== lado) continue;
    const nombre = (nombreDeCartel(g.jugador) || "Gol") + (g.tipo === "propia" ? " (p.p.)" : "");
    porJugador.set(nombre, (porJugador.get(nombre) ?? 0) + 1);
  }
  return [...porJugador.entries()].map(([nombre, goles]) => ({ nombre, goles }));
}
