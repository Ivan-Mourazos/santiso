/**
 * components/admin/cartel/Common.tsx
 * Shared UI pieces for the poster generator forms.
 */

import React from "react";
import { getCompetitionQueryLabels } from "@/lib/supabase-queries";

export const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p style={{
    fontSize: "0.68rem", fontWeight: 800, textTransform: "uppercase",
    letterSpacing: "1.5px", color: "var(--primary)", margin: "1.4rem 0 0.8rem",
  }}>
    {children}
  </p>
);

export const CategorySelector: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => (
  <div className="input-group" style={{ marginBottom: "1.5rem" }}>
    <label>Categoría</label>
    <select value={value} onChange={e => onChange(e.target.value)}>
      <option value="Senior">Senior</option>
      <option value="Femenino">Femenino</option>
      <option value="Veteranos">Veteranos</option>
    </select>
  </div>
);

export const Toggle: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
  <button onClick={onClick} style={{
    flex: 1, padding: "0.7rem", borderRadius: "0.5rem",
    border: active ? "none" : "1px solid var(--border)",
    background: active ? "var(--primary)" : "rgba(255,255,255,0.03)",
    color: active ? "#000" : "#fff",
    fontFamily: "inherit", fontWeight: 800, fontSize: "0.82rem", cursor: "pointer",
  }}>
    {label}
  </button>
);

export interface SelectorMatch {
  id: string;
  categoria?: string | null;
  competicion?: string | null;
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
    temporada_id?: string | null;
  } | null;
  campo?: { nombre?: string | null } | null;
}

export const MatchSelector: React.FC<{ 
  dbMatches: SelectorMatch[]; 
  onSelect: (m: SelectorMatch) => void;
  categoria: string;
  competicion?: string;
  tipo: string;
  santisoOnly?: boolean;
}> = ({ dbMatches, onSelect, categoria, competicion, tipo, santisoOnly }) => {
  const labels = competicion ? getCompetitionQueryLabels(categoria, competicion) : [];
  const isSantisoMatch = (m: SelectorMatch) => {
    const local = m.equipo_local?.nombre?.toLowerCase() || "";
    const visitante = m.equipo_visitante?.nombre?.toLowerCase() || "";
    return local.includes("santiso") || visitante.includes("santiso");
  };
  const filtered = dbMatches?.filter(m => {
    const isCat = m.categoria === categoria;
    if (!isCat) return false;
    if (competicion && !labels.includes(m.competicion || "")) return false;
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
    <div style={{ 
      marginBottom: "2rem", 
      padding: "1rem", 
      background: "rgba(250, 204, 21, 0.05)", 
      border: "1px solid rgba(250, 204, 21, 0.2)", 
      borderRadius: "12px" 
    }}>
      <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 800, color: "var(--primary)", marginBottom: "0.5rem", textTransform: "uppercase" }}>
        ⚡ Autocompletar desde la liga
      </label>
      <select 
        onChange={e => {
          const m = filtered.find(x => x.id === e.target.value);
          if (m) onSelect(m);
        }}
        style={{ width: "100%", background: "rgba(0,0,0,0.3)", color: "white", padding: "0.6rem", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.1)" }}
      >
        <option value="">-- Seleccionar partido reciente o próximo --</option>
        {filtered.map(m => (
          <option key={m.id} value={m.id}>
            J{m.jornada?.numero || '?'} - {m.equipo_local?.nombre} vs {m.equipo_visitante?.nombre} ({m.fecha ? new Date(m.fecha).toLocaleDateString() : 'Sin fecha'})
          </option>
        ))}
      </select>
    </div>
  );
};
