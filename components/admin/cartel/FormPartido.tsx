/**
 * components/admin/cartel/FormPartido.tsx
 * Form panel for the "Cartel de Partido" template.
 */

import React, { useState } from "react";
import { COMPETICIONS, type FormState } from "./types";
import { CategorySelector } from "./Common";
import { getCompetitionQueryLabels } from "@/lib/supabase-queries";

interface Props {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  equipos: { id: string; nombre: string; escudo_url: string }[];
  handleRivalSelect: (nombre: string) => void;
  handleRivalFile: (file: File) => void;
  dbMatches: any[];
  loadMatchFromDb: (m: any) => void;
  campos: { id: string; nombre: string; poblacion: string }[];
}

export const RivalSelector = ({
  rivalNombre,
  equipos,
  categoria,
  handleRivalSelect,
  handleRivalFile,
}: {
  rivalNombre: string;
  equipos: { id: string; nombre: string; escudo_url: string; categoria?: string }[];
  categoria: string;
  handleRivalSelect: (nombre: string) => void;
  handleRivalFile: (file: File) => void;
}) => {
  const filtered = equipos?.filter(eq => {
    const isSantiso = eq.nombre?.toLowerCase().includes("santiso");
    const matchesCat = !eq.categoria || eq.categoria === categoria;
    return !isSantiso && matchesCat;
  }) || [];

  return (
    <>
      <div className="input-group" style={{ marginBottom: "0.6rem" }}>
        <label>Rival (librería)</label>
        <select value={rivalNombre} onChange={e => handleRivalSelect(e.target.value)}>
          <option value="">— Seleccionar —</option>
          {filtered.map(eq => <option key={eq.id} value={eq.nombre}>{eq.nombre}</option>)}
        </select>
      </div>
      <div className="input-group" style={{ marginBottom: "1rem" }}>
        <label>O sube el escudo directamente</label>
        <label className="file-input-label">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
          </svg>
          Subir escudo
          <input type="file" className="hidden-input" accept="image/*"
            onChange={e => { if (e.target.files?.[0]) handleRivalFile(e.target.files[0]); }} />
        </label>
      </div>
    </>
  );
};

export const FormPartido: React.FC<Props & { tipo: string }> = ({ form, set, equipos, handleRivalSelect, handleRivalFile, dbMatches, loadMatchFromDb, campos, tipo }) => {
  const [autoFillMessage, setAutoFillMessage] = useState("");

  function handleLoadNextMatch() {
    setAutoFillMessage("");
    const labels = getCompetitionQueryLabels(form.categoria, form.competicion);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const nextMatch = dbMatches
      .filter((match) => {
        if (!match.fecha) return false;
        if (match.categoria !== form.categoria) return false;
        if (!labels.includes(match.competicion || match.jornada?.competicion || "")) return false;
        if (["finalizado", "cancelado", "aplazado"].includes((match.estado || "").toLowerCase().trim())) return false;

        const localName = match.equipo_local?.nombre?.toLowerCase() || "";
        const visitorName = match.equipo_visitante?.nombre?.toLowerCase() || "";
        if (!localName.includes("santiso") && !visitorName.includes("santiso")) return false;

        const matchDate = new Date(match.fecha);
        if (Number.isNaN(matchDate.getTime())) return false;
        return matchDate.getTime() >= today.getTime();
      })
      .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())[0];

    if (nextMatch) {
      loadMatchFromDb(nextMatch);
      setAutoFillMessage("Partido cargado.");
      return;
    }

    setAutoFillMessage("No encontré próximo partido pendiente para esa categoría y liga.");
  }

  return (
    <>
      {tipo === "partido" && (
        <div style={{ 
          marginBottom: "1.5rem", 
          padding: "1rem", 
          background: "rgba(250, 204, 21, 0.05)", 
          border: "1px dashed rgba(250, 204, 21, 0.4)", 
          borderRadius: "12px" 
        }}>
          <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 800, color: "var(--primary)", marginBottom: "0.6rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            ⚡ Autocompletar desde la liga
          </label>
          <button
            type="button"
            onClick={handleLoadNextMatch}
            style={{
              width: "100%",
              background: "var(--primary)",
              border: "none",
              color: "#000",
              padding: "0.6rem",
              borderRadius: "6px",
              fontWeight: 800,
              cursor: "pointer",
              transition: "all 0.2s"
            }}
          >
            Cargar próximo partido
          </button>
          {autoFillMessage && (
            <p style={{ margin: "0.5rem 0 0", color: "#a3a3a3", fontSize: "0.75rem", fontWeight: 700 }}>
              {autoFillMessage}
            </p>
          )}
        </div>
      )}

      <CategorySelector value={form.categoria} onChange={(v: string) => set("categoria", v)} />
      
      <div className="input-group" style={{ marginBottom: "1rem" }}>
        <label>Competición</label>
        <select value={form.competicion} onChange={e => set("competicion", e.target.value)}>
          <option value="">— Seleccionar —</option>
          {(COMPETICIONS[form.categoria] || []).map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
        <div className="input-group">
          <label>Fecha</label>
          <input type="date" value={form.fecha} onChange={e => set("fecha", e.target.value)} />
        </div>
        <div className="input-group">
          <label>Hora</label>
          <input type="time" value={form.hora} onChange={e => set("hora", e.target.value)} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
        <div className="input-group">
          <label>Nº Xornada</label>
          <input type="text" inputMode="numeric" pattern="[0-9]*" value={form.jornada} onChange={e => set("jornada", e.target.value)} />
        </div>
        <div className="input-group">
          <label>Estadio / Campo</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <select 
              value={campos?.find(c => c.nombre === form.lugar)?.id || ""} 
              onChange={e => {
                const selected = campos?.find(c => c.id === e.target.value);
                if (selected) set("lugar", selected.nombre);
              }}
              style={{ fontSize: '0.82rem', padding: '0.5rem 0.8rem' }}
            >
              <option value="">— Seleccionar estadio —</option>
              {campos?.map(c => (
                <option key={c.id} value={c.id}>{c.nombre} ({c.poblacion || 'S/P'})</option>
              ))}
            </select>
            <input 
              type="text" 
              placeholder="O escribe el nombre manualmente..." 
              value={form.lugar} 
              onChange={e => set("lugar", e.target.value)} 
              style={{ padding: '0.5rem 0.8rem', height: 'auto', fontSize: '0.82rem' }}
            />
          </div>
        </div>
      </div>

      <RivalSelector
        rivalNombre={form.rivalNombre}
        equipos={equipos}
        categoria={form.categoria}
        handleRivalSelect={handleRivalSelect}
        handleRivalFile={handleRivalFile}
      />
    </>
  );
};
