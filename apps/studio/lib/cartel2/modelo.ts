/**
 * Datos del cartel nuevo (motor HTML/CSS). Lo que dibuja un cartel está aquí, ya resuelto: el
 * componente no consulta nada y la exportación a PNG recibe exactamente lo mismo que la vista previa.
 */

export const COMPOSICIONES = [
  { id: "diagonal", nombre: "Diagonal" },
  { id: "enfrentados", nombre: "Enfrentados" },
  { id: "gigante", nombre: "Escudo gigante" },
] as const;
export type Composicion = (typeof COMPOSICIONES)[number]["id"];

export const FORMATOS = [
  { id: "4:5", nombre: "Publicación 4:5", ancho: 1080, alto: 1350 },
  { id: "9:16", nombre: "Historia 9:16", ancho: 1080, alto: 1920 },
] as const;
export type Formato = (typeof FORMATOS)[number]["id"];

export interface EquipoCartel {
  nombre: string;
  escudo: string | null;
  propio: boolean;
  /** `#rrggbb`: sacado del escudo en el navegador; si no, el de la categoría. */
  color: string;
}

export interface DatosPartido {
  categoria: string;
  competicion: string;
  jornada: string;
  local: EquipoCartel;
  visitante: EquipoCartel;
  /** `AAAA-MM-DD` o vacío. */
  fecha: string;
  /** `HH:mm` o vacío. */
  hora: string;
  campo: string;
  patrocinadores: string[];
  /** RFGF y Xunta: van en todos los carteles, aparte de los patrocinadores. */
  institucionales: string[];
}

export interface PeticionCartel {
  plantilla: "partido";
  composicion: Composicion;
  formato: Formato;
  datos: DatosPartido;
}

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

/** «Senior» → «SÉNIOR»; en gallego, como el resto de textos del cartel. */
export function categoriaCartel(categoria: string) {
  if (categoria === "Veteranos") return "VETERANOS";
  if (categoria === "Femenino") return "FEMININO";
  return "SÉNIOR";
}

/** Lo que el formulario actual de «Cartel de partido» sabe, en el modelo nuevo. */
export function datosDeFormulario(
  form: {
    categoria: string;
    competicion: string;
    jornada: string;
    rivalNombre: string;
    rivalEscudoUrl: string;
    fecha: string;
    hora: string;
    lugar: string;
    santisoSide: "left" | "right";
  },
  recursos: {
    escudoClub: string;
    nombreClub: string;
    patrocinadores: string[];
    institucionales: string[];
  },
  colores: { club: string; rival: string },
): DatosPartido {
  const santiso: EquipoCartel = {
    nombre: recursos.nombreClub,
    escudo: recursos.escudoClub || null,
    propio: true,
    color: colores.club,
  };
  const rival: EquipoCartel = {
    nombre: form.rivalNombre.trim() || "Rival",
    escudo: form.rivalEscudoUrl || null,
    propio: false,
    color: colores.rival,
  };
  const santisoLocal = form.santisoSide === "left";
  return {
    categoria: form.categoria,
    competicion: form.competicion,
    jornada: form.jornada,
    local: santisoLocal ? santiso : rival,
    visitante: santisoLocal ? rival : santiso,
    fecha: form.fecha,
    hora: form.hora,
    campo: form.lugar,
    patrocinadores: recursos.patrocinadores,
    institucionales: recursos.institucionales,
  };
}
