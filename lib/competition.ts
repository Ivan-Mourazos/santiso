import { COMPETICIONS } from "@/components/admin/cartel/types";

export function normalizeCategoryKey(value: string) {
  const normalized = (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (normalized.startsWith("sen")) return "Senior";
  if (normalized.startsWith("fem")) return "Femenino";
  if (normalized.startsWith("vet")) return "Veteranos";
  return "Senior";
}

export function getCompetitionsByCategory(categoria: string) {
  const key = normalizeCategoryKey(categoria);
  return COMPETICIONS[key] ?? ["Liga principal"];
}

/** Primera competición de la categoría (liga regular). Usada para fallback legacy "Liga principal". */
export function getMainCompetitionForCategory(categoria: string) {
  const list = getCompetitionsByCategory(categoria);
  return list[0] ?? "Liga principal";
}

/**
 * Competición seleccionada por defecto en UI pública (partidos / clasificación).
 * Senior: Fase Copa (segunda entrada en COMPETICIONS). Resto: primera entrada.
 */
export function getDefaultUiCompetitionForCategory(categoria: string) {
  const list = getCompetitionsByCategory(categoria);
  const key = normalizeCategoryKey(categoria);
  if (key === "Senior" && list.length > 1) return list[1];
  return list[0] ?? "";
}

/**
 * Etiquetas en BD que deben tratarse como la misma competición que `canonicalCompeticion`
 * (histórico antes de alinear con COMPETICIONS). Usar en .in("competicion", …).
 */
export function getCompeticionLabelsForQuery(categoria: string, canonicalCompeticion: string): string[] {
  const key = normalizeCategoryKey(categoria);
  const out = new Set<string>([canonicalCompeticion]);
  const femMain = COMPETICIONS["Femenino"]?.[0];
  const senMain = COMPETICIONS["Senior"]?.[0];
  const senCopa = COMPETICIONS["Senior"]?.[1];
  const vetMain = COMPETICIONS["Veteranos"]?.[0];
  const vetCopa = COMPETICIONS["Veteranos"]?.[1];

  /** Etiqueta castellana / Futgal distinta a "Da Honra" (galego) en COMPETICIONS */
  const honorDe = ["División de Honor", "Division de Honor", "División De Honor"];

  if (key === "Femenino" && canonicalCompeticion === femMain) {
    out.add("LGF 2ª División");
    out.add("LGF 2a División");
    out.add("LGF 2A División");
  }
  if (key === "Senior" && canonicalCompeticion === senMain) {
    out.add("Terceira Galicia - Santiago - Grupo 4");
    honorDe.forEach((t) => out.add(t));
  }
  if (key === "Senior" && canonicalCompeticion === senCopa) {
    out.add("Fase Grupo Copa");
    honorDe.forEach((t) => out.add(t));
  }
  if (key === "Veteranos" && canonicalCompeticion === vetMain) {
    out.add("Liga principal");
    honorDe.forEach((t) => out.add(t));
    out.add("División da Honra - Veteranos - Santiago");
    out.add("Division Da Honra - Veteranos - Santiago");
    out.add("Division da Honra - Veteranos - Santiago");
    out.add("División Da Honra Veteranos Santiago");
  }
  if (key === "Veteranos" && canonicalCompeticion === vetCopa) {
    out.add("Veteranos Copa");
    out.add("Copa Veteranos - Santiago");
    out.add("Copa Veteranos");
  }
  return [...out];
}
