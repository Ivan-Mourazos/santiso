/**
 * components/admin/cartel/FormNoso11.tsx
 * Form panel for the "O Noso 11" template.
 */

import React from "react";
import type { FormState } from "./types";
import { SectionLabel } from "./Common";
import type { Player } from "@/lib/cartel-draw";

interface Props {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  jugFileName: string;
  handleJugadorFile: (file: File) => void;
  updatePlayer: (list: "titulares" | "suplentes", i: number, patch: Partial<Player>) => void;
}

export const FormNoso11: React.FC<Props> = ({
  form, set, jugFileName, handleJugadorFile, updatePlayer
}) => {
  return (
    <>
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

      <SectionLabel>Titulares (11)</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        {form.titulares.map((p, i) => (
          <div key={p.id} style={{ display: "grid", gridTemplateColumns: "55px 1fr auto", gap: "0.5rem", alignItems: "center" }}>
            <input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="#" value={p.dorsal}
              onChange={e => updatePlayer("titulares", i, { dorsal: e.target.value })}
              style={{ textAlign: "center" }} />
            <input type="text" placeholder={`Jugador ${i + 1}`} value={p.nome}
              onChange={e => updatePlayer("titulares", i, { nome: e.target.value })} />
            <button title="Capitán" onClick={() => updatePlayer("titulares", i, { eCapitan: !p.eCapitan })}
              style={{ background: p.eCapitan ? "#4aa8d8" : "rgba(255,255,255,0.04)",
                       border: "1px solid var(--border)", padding: "0.4rem", borderRadius: "0.4rem", cursor: "pointer" }}>
              C
            </button>
          </div>
        ))}
      </div>

      <SectionLabel>Suplentes</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        {form.suplentes.map((p, i) => (
          <div key={p.id} style={{ display: "grid", gridTemplateColumns: "55px 1fr", gap: "0.5rem", alignItems: "center" }}>
            <input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="#" value={p.dorsal}
              onChange={e => updatePlayer("suplentes", i, { dorsal: e.target.value })}
              style={{ textAlign: "center" }} />
            <input type="text" placeholder="Jugador Suplente" value={p.nome}
              onChange={e => updatePlayer("suplentes", i, { nome: e.target.value })} />
          </div>
        ))}
      </div>
    </>
  );
};
