/**
 * Multas internas del club: catálogo, importe de cada multa y resumen del bote. Puro. Los
 * importes van siempre en céntimos (enteros): nada de decimales flotantes con dinero.
 */

export const GRUPOS_MULTA = ["adestramento", "partido"] as const;
export type GrupoMulta = (typeof GRUPOS_MULTA)[number];
export const NOMBRE_GRUPO: Record<GrupoMulta, string> = {
  adestramento: "Adestramentos",
  partido: "Partidos",
};

export interface ConceptoMulta {
  id: string;
  nombre: string;
  grupo: GrupoMulta;
  importeCentimos: number;
  /** Se cobra por unidad («1 € por prenda»). */
  porUnidad: boolean;
  /** Lo que se puede marcar en un concepto por unidad; vacío = se pide la cantidad. */
  opciones: string[];
  activo: boolean;
}

/** A quién se puede multar: plantilla y cuerpo técnico de la temporada. */
export interface PersonaMulta {
  /** `jugador:<id>` o `staff:<id>`: una sola clave para listas y selectores. */
  clave: string;
  tipo: "jugador" | "staff";
  id: string;
  nombre: string;
  /** «Senior · 7», «Veteranos · Entrenador»… */
  detalle: string;
  /** Cuerpo técnico: paga el doble. */
  adestrador: boolean;
}

export interface Multa {
  id: string;
  persona: string;
  /** Clave de la persona (ver `PersonaMulta.clave`). */
  personaClave: string;
  concepto: string;
  importeCentimos: number;
  fecha: string;
  nota: string | null;
  pagadaEn: string | null;
}

export interface PantallaMultas {
  temporada: { id: string; nombre: string } | null;
  conceptos: ConceptoMulta[];
  personas: PersonaMulta[];
  multas: Multa[];
}

/**
 * Normas del club (cartel del vestuario, octubre de 2026), en gallego como están escritas.
 * Se cargan la primera vez que se abre Multas; después se editan en pantalla.
 */
/** Lo que hay que traer a un partido: las dos equipaciones y el peto. */
const PRENDAS = ["Pantalón 1ª", "Pantalón 2ª", "Medias 1ª", "Medias 2ª", "Peto", "Espinilleiras"];
const CAMISETAS = ["Camiseta 1ª", "Camiseta 2ª"];

const fijo = (grupo: GrupoMulta, nombre: string, importeCentimos: number) => ({
  grupo,
  nombre,
  importeCentimos,
  porUnidad: false,
  opciones: [] as string[],
});

export const CONCEPTOS_DEL_CLUB: Omit<ConceptoMulta, "id" | "activo">[] = [
  fijo("adestramento", "Chegar tarde (inxustificado)", 50),
  fijo("adestramento", "Non asistencia (inxustificada)", 100),
  fijo("partido", "Chegar tarde (xustificado)", 50),
  fijo("partido", "Chegar tarde (inxustificado)", 150),
  fijo("partido", "Non asistir (xustificado)", 150),
  fijo("partido", "Non asistir (inxustificado)", 500),
  fijo("partido", "Vir en mal estado", 300),
  {
    grupo: "partido",
    nombre: "Non traer material",
    importeCentimos: 100,
    porUnidad: true,
    opciones: PRENDAS,
  },
  {
    grupo: "partido",
    nombre: "Non traer a camiseta",
    importeCentimos: 500,
    porUnidad: true,
    opciones: CAMISETAS,
  },
  fijo("partido", "Tarxeta amarela (protesta, etc.)", 300),
  fijo("partido", "Tarxeta vermella (protesta)", 600),
  fijo("partido", "Tarxeta vermella (agresión)", 1000),
  fijo("partido", "Non ir no bus", 2000),
];

/** «Os adestradores pagan o dobre». */
export const FACTOR_ADESTRADOR = 2;

/**
 * Importe de una multa: el del concepto, por las unidades si se cobra por unidad, y el doble
 * si es para alguien del cuerpo técnico.
 */
export function importeDeMulta(
  concepto: Pick<ConceptoMulta, "importeCentimos" | "porUnidad">,
  unidades: number,
  adestrador: boolean,
): number {
  const cantidad = concepto.porUnidad ? Math.max(1, Math.floor(unidades) || 1) : 1;
  return concepto.importeCentimos * cantidad * (adestrador ? FACTOR_ADESTRADOR : 1);
}

/**
 * Unidades que se cobran: las opciones marcadas si el concepto las tiene; si no, la cantidad
 * escrita. Sin nada marcado ni escrito, una.
 */
export function unidadesDe(
  concepto: Pick<ConceptoMulta, "porUnidad" | "opciones">,
  unidades: number,
  elegidas: string[],
): number {
  if (!concepto.porUnidad) return 1;
  if (concepto.opciones.length > 0 && elegidas.length > 0) return elegidas.length;
  return Math.max(1, Math.floor(unidades) || 1);
}

/** «a, b ,, a» → ["a", "b"]: la lista de opciones tal como se escribe en Normas. */
export function opcionesDeTexto(texto: string): string[] {
  return [...new Set(texto.split(",").map((o) => o.trim()).filter(Boolean))];
}

/** Texto que se guarda en la multa: el concepto y, si procede, lo marcado o las unidades. */
export function textoDeConcepto(
  concepto: Pick<ConceptoMulta, "nombre" | "porUnidad">,
  unidades: number,
  elegidas: string[] = [],
): string {
  if (concepto.porUnidad && elegidas.length > 0) return `${concepto.nombre}: ${elegidas.join(", ")}`;
  const cantidad = Math.max(1, Math.floor(unidades) || 1);
  return concepto.porUnidad && cantidad > 1 ? `${concepto.nombre} ×${cantidad}` : concepto.nombre;
}

/** 150 → «1,50 €». */
export function euros(centimos: number): string {
  const signo = centimos < 0 ? "-" : "";
  const abs = Math.abs(centimos);
  return `${signo}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")} €`;
}

/** «1,5», «1.50», «3 €» → céntimos; `null` si no es un importe positivo. */
export function centimosDe(texto: string): number | null {
  const limpio = texto.replace(/€/g, "").trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(limpio)) return null;
  const centimos = Math.round(Number(limpio) * 100);
  return centimos > 0 ? centimos : null;
}

export interface ResumenPersona {
  personaClave: string;
  persona: string;
  multas: number;
  pendienteCentimos: number;
  pagadoCentimos: number;
}

export interface ResumenMultas {
  /** Lo ya cobrado: el bote. */
  boteCentimos: number;
  pendienteCentimos: number;
  /** Quien más debe primero; a igual deuda, por nombre. */
  personas: ResumenPersona[];
}

export function resumirMultas(multas: Multa[]): ResumenMultas {
  const porPersona = new Map<string, ResumenPersona>();
  for (const m of multas) {
    const fila = porPersona.get(m.personaClave) ?? {
      personaClave: m.personaClave,
      persona: m.persona,
      multas: 0,
      pendienteCentimos: 0,
      pagadoCentimos: 0,
    };
    fila.multas++;
    if (m.pagadaEn) fila.pagadoCentimos += m.importeCentimos;
    else fila.pendienteCentimos += m.importeCentimos;
    porPersona.set(m.personaClave, fila);
  }
  const personas = [...porPersona.values()].sort(
    (a, b) => b.pendienteCentimos - a.pendienteCentimos || a.persona.localeCompare(b.persona, "es"),
  );
  return {
    boteCentimos: personas.reduce((n, p) => n + p.pagadoCentimos, 0),
    pendienteCentimos: personas.reduce((n, p) => n + p.pendienteCentimos, 0),
    personas,
  };
}

const DIA = /^\d{4}-\d{2}-\d{2}$/;
export const esDia = (texto: string) => DIA.test(texto) && !Number.isNaN(Date.parse(texto));
