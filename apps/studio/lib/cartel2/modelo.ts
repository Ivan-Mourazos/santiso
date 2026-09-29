/**
 * Datos de los carteles del motor nuevo (HTML/CSS → PNG). Lo que dibuja un cartel está aquí, ya
 * resuelto: los componentes no consultan nada y la exportación a PNG recibe exactamente lo mismo
 * que la vista previa. De dónde sale cada dato (el formulario del Estudio) está en `formulario.ts`.
 */

/** Composiciones del cartel de partido; la primera es la de por defecto. */
export const COMPOSICIONES = [
  { id: "diagonal", nombre: "Diagonal" },
  { id: "enfrentados", nombre: "Enfrentados" },
] as const;
export type Composicion = (typeof COMPOSICIONES)[number]["id"];

/** Solo publicación 4:5, a ×2 al exportar (2160 × 2700): lo que Instagram muestra sin recortar. */
export const MEDIDAS = { ancho: 1080, alto: 1350 } as const;

export const PLANTILLAS = [
  "partido",
  "resultado",
  "cronoloxia",
  "proximos",
  "once",
  "anuncio",
  "clasificacion",
] as const;
export type Plantilla = (typeof PLANTILLAS)[number];

export interface EquipoCartel {
  nombre: string;
  escudo: string | null;
  propio: boolean;
  /** `#rrggbb`: sacado del escudo en el navegador; el club usa el amarillo de su equipación. */
  color: string;
  /** Añadir relieve al escudo. No si ya tiene volumen (el del club, o marcado en Equipos). */
  relieve: boolean;
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
  foto: string | null;
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
}

export interface PartidoProximo {
  categoria: string;
  local: EquipoCartel;
  visitante: EquipoCartel;
  fecha: string;
  hora: string;
  campo: string;
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
  | { plantilla: "partido"; composicion: Composicion; datos: DatosPartido }
  | { plantilla: "resultado"; datos: DatosResultado }
  | { plantilla: "cronoloxia"; datos: DatosCronoloxia }
  | { plantilla: "proximos"; datos: DatosProximos }
  | { plantilla: "once"; datos: DatosOnce }
  | { plantilla: "anuncio"; datos: DatosAnuncio }
  | { plantilla: "clasificacion"; datos: DatosClasificacion };

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

/** «Senior» → «SÉNIOR»; en gallego, como el resto de textos del cartel. */
export function categoriaCartel(categoria: string) {
  if (categoria === "Veteranos") return "VETERANOS";
  if (categoria === "Femenino") return "FEMININO";
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

/** Goles de un lado agrupados por jugador: «Bareto 59', 66'». En propia lleva «(p.p.)». */
export function goleadores(goles: GolCartel[], lado: "local" | "visitante") {
  const porJugador = new Map<string, string[]>();
  for (const g of goles) {
    if (g.lado !== lado) continue;
    const nombre = (g.jugador.trim() || "Gol") + (g.tipo === "propia" ? " (p.p.)" : "");
    const minuto = g.minuto.trim()
      ? `${g.minuto.trim()}'${g.tipo === "penalti" ? " (pen.)" : ""}`
      : "";
    const lista = porJugador.get(nombre) ?? [];
    if (minuto) lista.push(minuto);
    porJugador.set(nombre, lista);
  }
  return [...porJugador.entries()].map(([nombre, minutos]) => ({ nombre, minutos }));
}
