/** Catálogo de competiciones vive en BD (`competiciones`). Solo helpers de UI aquí. */

export type CompetenciaRow = {
  id: string;
  categoria: string;
  nombre: string;
  orden: number;
  activa?: boolean | null;
  formato?: string | null;
};

export function normalizeCategoryKey(value: string) {
  const normalized = (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (normalized.startsWith("sen")) return "Senior";
  if (normalized.startsWith("fem")) return "Femenino";
  if (normalized.startsWith("vet")) return "Veteranos";
  return "Senior";
}

/** Lista ordenada por `orden`, solo activas. */
export function competitionsForCategory(
  list: CompetenciaRow[],
  categoria: string,
): CompetenciaRow[] {
  const key = normalizeCategoryKey(categoria);
  return [...list]
    .filter((r) => normalizeCategoryKey(r.categoria) === key && r.activa !== false)
    .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, "es"));
}

/** Primera competición por orden (liga regular habitual). */
export function getMainCompetitionId(list: CompetenciaRow[], categoria: string): string {
  return competitionsForCategory(list, categoria)[0]?.id ?? "";
}

/**
 * Competición por defecto en UI pública (Senior: segunda entrada = “copa”; resto primera).
 */
export function pickDefaultCompetitionId(list: CompetenciaRow[], categoria: string): string {
  const rows = competitionsForCategory(list, categoria);
  const key = normalizeCategoryKey(categoria);
  if (key === "Senior" && rows.length > 1) return rows[1]?.id ?? rows[0]?.id ?? "";
  return rows[0]?.id ?? "";
}
