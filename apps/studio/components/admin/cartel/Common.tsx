/**
 * Piezas compartidas por los formularios del generador de carteles.
 *
 * Desde la 6E usan los componentes de la Fase 3A: así cada etiqueta queda asociada a su campo
 * —antes eran `<label>` sueltos, que el lector de pantalla no ligaba a nada— y los interruptores
 * dicen si están activados.
 */

import React from "react";
import { Button } from "@/components/ui/foundation/Button";
import { Select } from "@/components/ui/foundation/Fields";
import { formatLiteralMatchDate } from "@/lib/match-date-time";
import styles from "./Formularios.module.css";

export const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h4 className={styles.seccion}>{children}</h4>
);

export const CategorySelector: React.FC<{
  value: string;
  onChange: (v: string) => void;
  includeFemenino?: boolean;
}> = ({ value, onChange, includeFemenino = false }) => (
  <div className={styles.campo}>
    <Select label="Categoría" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="Senior">Senior</option>
      {includeFemenino && <option value="Femenino">Femenino</option>}
      <option value="Veteranos">Veteranos</option>
    </Select>
  </div>
);

export const Toggle: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({
  label,
  active,
  onClick,
}) => (
  <Button variant={active ? "primary" : "secondary"} aria-pressed={active} onClick={onClick}>
    {label}
  </Button>
);

export interface SelectorMatch {
  id: string;
  categoria?: string | null;
  competicion_id?: string | null;
  competicion?: string | null;
  competiciones?: { id?: string; nombre?: string } | null;
  estado?: string | null;
  fecha?: string | null;
  lugar?: string | null;
  goles_local?: number | null;
  goles_visitante?: number | null;
  equipo_local?: { nombre?: string | null; escudo_url?: string | null } | null;
  equipo_visitante?: { nombre?: string | null; escudo_url?: string | null } | null;
  jornada?: {
    numero?: number | string | null;
    competicion?: string | null;
    competicion_id?: string | null;
    temporada_id?: string | null;
  } | null;
  campo?: { nombre?: string | null } | null;
}

export const MatchSelector: React.FC<{
  dbMatches: SelectorMatch[];
  onSelect: (m: SelectorMatch) => void;
  categoria: string;
  competicionId?: string;
  tipo: string;
  santisoOnly?: boolean;
}> = ({ dbMatches, onSelect, categoria, competicionId, tipo, santisoOnly }) => {
  const isSantisoMatch = (m: SelectorMatch) => {
    const local = m.equipo_local?.nombre?.toLowerCase() || "";
    const visitante = m.equipo_visitante?.nombre?.toLowerCase() || "";
    return local.includes("santiso") || visitante.includes("santiso");
  };
  const filtered =
    dbMatches?.filter((m) => {
      const isCat = m.categoria === categoria;
      if (!isCat) return false;
      if (competicionId) {
        const mid = m.competicion_id || m.jornada?.competicion_id;
        if (mid && mid !== competicionId) return false;
      }
      if (santisoOnly && !isSantisoMatch(m)) return false;

      // Filtrar por estado según el tipo de cartel
      if (tipo === "partido" || tipo === "proximos") {
        return m.estado === "programado";
      }
      if (tipo === "resumo" || tipo === "cronoloxia" || tipo === "noso11") {
        return m.estado === "finalizado";
      }
      return true;
    }) || [];

  if (filtered.length === 0) return null;

  return (
    <div className={styles.desdeLiga}>
      <Select
        label="Autocompletar desde la liga"
        defaultValue=""
        onChange={(e) => {
          const m = filtered.find((x) => x.id === e.target.value);
          if (m) onSelect(m);
        }}
      >
        <option value="">Seleccionar partido reciente o próximo…</option>
        {filtered.map((m) => (
          <option key={m.id} value={m.id}>
            J{m.jornada?.numero || "?"} - {m.equipo_local?.nombre} vs {m.equipo_visitante?.nombre} (
            {m.fecha ? formatLiteralMatchDate(m.fecha) : "Sin fecha"})
          </option>
        ))}
      </Select>
    </div>
  );
};
