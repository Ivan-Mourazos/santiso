/**
 * components/admin/cartel/FormNoso11.tsx
 * Form panel for the "O Noso 11" template.
 */

import React from "react";
import type { FormState } from "./types";
import { SectionLabel, CategorySelector, MatchSelector, Toggle } from "./Common";
import type { SelectorMatch } from "./Common";
import type { Player } from "@/lib/cartel-draw";

interface CartelPlayerOption {
  id: string;
  nombre?: string | null;
  apodo?: string | null;
  dorsal?: number | null;
  categoria?: string | null;
}

interface Props {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  jugadores: CartelPlayerOption[];
  jugFileName: string;
  handleJugadorFile: (file: File) => void;
  updatePlayer: (list: "titulares" | "suplentes", i: number, patch: Partial<Player>) => void;
  swapPlayers?: (list: "titulares" | "suplentes", a: number, b: number) => void;
  dbMatches: SelectorMatch[];
  loadMatchFromDb: (m: SelectorMatch) => void;
  tipo: string;
}

export const FormNoso11: React.FC<Props> = ({
  form, set, jugadores, jugFileName, handleJugadorFile, updatePlayer, swapPlayers, dbMatches, loadMatchFromDb, tipo
}) => {
  const getDisplayName = (j: CartelPlayerOption | undefined) => {
    if (!j) return "";
    if (j.apodo) return j.apodo;
    if (!j.nombre) return "";
    const parts = j.nombre.split(" ");
    return parts.length > 1 ? `${parts[0]} ${parts[1]}` : j.nombre;
  };

  const jugadoresCategoria = jugadores.filter(j => j.categoria === form.categoria);

  const handleChangeJugadorText = (list: "titulares" | "suplentes", i: number, val: string) => {
    const matched = jugadoresCategoria.find(j => getDisplayName(j).toLowerCase() === val.toLowerCase());
    if (matched) {
      updatePlayer(list, i, { nome: val, dorsal: matched.dorsal?.toString() || "" });
    } else {
      updatePlayer(list, i, { nome: val });
    }
  };

  return (
    <>
      <MatchSelector dbMatches={dbMatches} onSelect={loadMatchFromDb} categoria={form.categoria} competicionId={form.competicion_id} tipo={tipo} santisoOnly />
      <CategorySelector value={form.categoria} onChange={(v: string) => set("categoria", v)} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
        <div className="input-group"><label>Fecha</label>
          <input type="date" value={form.fecha} onChange={e => set("fecha", e.target.value)} />
        </div>
        <div className="input-group"><label>Estadio</label>
          <input type="text" placeholder="Estadio Municipal de Santiso"
            value={form.estadio} onChange={e => set("estadio", e.target.value)} />
        </div>
      </div>

      <div className="input-group" style={{ marginBottom: "1.2rem" }}>
        <label>Disposición del cartel (Simetría)</label>
        <div style={{ display: "flex", gap: "0.6rem" }}>
          <Toggle 
            label="← Estándar (Foto Izq)" 
            active={!form.noso11Flip} 
            onClick={() => set("noso11Flip", false)} 
          />
          <Toggle 
            label="Invertido (Foto Der) →" 
            active={!!form.noso11Flip} 
            onClick={() => set("noso11Flip", true)} 
          />
        </div>
      </div>

      <div className="input-group" style={{ marginBottom: "1.2rem" }}>
        <label>Foto jugador destacado (izquierda del cartel)</label>
        <label className="file-input-label">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
          </svg>
          {jugFileName || "Subir foto del jugador"}
          <input type="file" className="hidden-input" accept="image/*"
            onChange={e => { if (e.target.files?.[0]) handleJugadorFile(e.target.files[0]); }} />
        </label>
      </div>

      <div className="input-group" style={{ marginBottom: "1.2rem", background: "rgba(255,255,255,0.03)", padding: "1rem", borderRadius: "10px", border: "1px solid var(--border)" }}>
        <label style={{ color: "var(--primary)", fontSize: "0.75rem", marginBottom: "1rem", display: "block" }}>🎯 Ajustes de encuadre avanzados</label>
        
        {/* Horizontal */}
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ fontSize: "0.7rem", opacity: 0.8, marginBottom: "0.4rem", display: "block" }}>Desplazamiento Horizontal</label>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <span style={{ fontSize: "0.65rem", color: "#666" }}>Izq</span>
            <input type="range" min="0" max="1" step="0.01" 
                   value={form.jugadorXOffset} 
                   onChange={e => set("jugadorXOffset", parseFloat(e.target.value))}
                   style={{ flex: 1, accentColor: "var(--primary)" }} />
            <span style={{ fontSize: "0.65rem", color: "#666" }}>Der</span>
          </div>
        </div>

        {/* Vertical */}
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ fontSize: "0.7rem", opacity: 0.8, marginBottom: "0.4rem", display: "block" }}>Desplazamiento Vertical</label>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <span style={{ fontSize: "0.65rem", color: "#666" }}>Arriba</span>
            <input type="range" min="0" max="1" step="0.01" 
                   value={form.jugadorYOffset} 
                   onChange={e => set("jugadorYOffset", parseFloat(e.target.value))}
                   style={{ flex: 1, accentColor: "var(--primary)" }} />
            <span style={{ fontSize: "0.65rem", color: "#666" }}>Abajo</span>
          </div>
        </div>

        {/* Zoom */}
        <div>
          <label style={{ fontSize: "0.7rem", opacity: 0.8, marginBottom: "0.4rem", display: "block" }}>Zoom / Escala</label>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <span style={{ fontSize: "0.65rem", color: "#666" }}>Alejar (0.5x)</span>
            <input type="range" min="0.5" max="4" step="0.01" 
                   value={form.jugadorZoom} 
                   onChange={e => set("jugadorZoom", parseFloat(e.target.value))}
                   style={{ flex: 1, accentColor: "var(--primary)" }} />
            <span style={{ fontSize: "0.65rem", color: "#666" }}>Acercar (4x)</span>
          </div>
        </div>
      </div>

      <datalist id="jugadores-categoria-list">
        {jugadoresCategoria.map(j => (
          <option key={j.id} value={getDisplayName(j)}>
            #{j.dorsal || "-"} {j.nombre}
          </option>
        ))}
      </datalist>

      <SectionLabel>Titulares (11)</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        {form.titulares.map((p, i) => (
          <div key={p.id} style={{ display: "grid", gridTemplateColumns: "55px 1fr auto auto", gap: "0.5rem", alignItems: "center" }}>
            <input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="#" value={p.dorsal}
              onChange={e => updatePlayer("titulares", i, { dorsal: e.target.value })}
              style={{ textAlign: "center" }} />
            <input 
              type="text"
              list="jugadores-categoria-list"
              placeholder="Nombre del jugador..."
              value={p.nome}
              onChange={e => handleChangeJugadorText("titulares", i, e.target.value)}
              style={{ padding: "0.4rem", borderRadius: "0.4rem", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", color: "#fff", width: "100%" }}
            />
            <button title="Capitán" onClick={() => updatePlayer("titulares", i, { eCapitan: !p.eCapitan })}
              style={{ background: p.eCapitan ? "#4aa8d8" : "rgba(255,255,255,0.04)",
                       border: "1px solid var(--border)", padding: "0.4rem", borderRadius: "0.4rem", cursor: "pointer" }}>
              C
            </button>
            <div style={{ display: "flex", gap: "2px" }}>
              <button 
                type="button" 
                title="Subir" 
                disabled={i === 0} 
                onClick={() => swapPlayers?.("titulares", i, i - 1)}
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", padding: "0.2rem 0.4rem", borderRadius: "0.3rem", cursor: i === 0 ? "default" : "pointer", opacity: i === 0 ? 0.3 : 1 }}
              >
                ▲
              </button>
              <button 
                type="button" 
                title="Bajar" 
                disabled={i === form.titulares.length - 1} 
                onClick={() => swapPlayers?.("titulares", i, i + 1)}
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", padding: "0.2rem 0.4rem", borderRadius: "0.3rem", cursor: i === form.titulares.length - 1 ? "default" : "pointer", opacity: i === form.titulares.length - 1 ? 0.3 : 1 }}
              >
                ▼
              </button>
            </div>
          </div>
        ))}
      </div>

      <SectionLabel>Suplentes</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        {form.suplentes.map((p, i) => (
          <div key={p.id} style={{ display: "grid", gridTemplateColumns: "55px 1fr auto", gap: "0.5rem", alignItems: "center" }}>
            <input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="#" value={p.dorsal}
              onChange={e => updatePlayer("suplentes", i, { dorsal: e.target.value })}
              style={{ textAlign: "center" }} />
            <input 
              type="text"
              list="jugadores-categoria-list"
              placeholder="Nombre del jugador..."
              value={p.nome}
              onChange={e => handleChangeJugadorText("suplentes", i, e.target.value)}
              style={{ padding: "0.4rem", borderRadius: "0.4rem", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", color: "#fff", width: "100%" }}
            />
            <div style={{ display: "flex", gap: "2px" }}>
              <button 
                type="button" 
                title="Subir" 
                disabled={i === 0} 
                onClick={() => swapPlayers?.("suplentes", i, i - 1)}
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", padding: "0.2rem 0.4rem", borderRadius: "0.3rem", cursor: i === 0 ? "default" : "pointer", opacity: i === 0 ? 0.3 : 1 }}
              >
                ▲
              </button>
              <button 
                type="button" 
                title="Bajar" 
                disabled={i === form.suplentes.length - 1} 
                onClick={() => swapPlayers?.("suplentes", i, i + 1)}
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", padding: "0.2rem 0.4rem", borderRadius: "0.3rem", cursor: i === form.suplentes.length - 1 ? "default" : "pointer", opacity: i === form.suplentes.length - 1 ? 0.3 : 1 }}
              >
                ▼
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};
