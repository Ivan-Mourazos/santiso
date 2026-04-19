/**
 * components/admin/cartel/FormCronoloxia.tsx
 * Form panel for the "Cronoloxía" template.
 */

import React from "react";
import type { FormState } from "./types";
import { RivalSelector } from "./FormPartido";
import type { CronEvent } from "@/lib/cartel-draw";

interface Props {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  equipos: { id: string; nombre: string; escudo_url: string }[];
  handleRivalSelect: (nombre: string) => void;
  handleRivalFile: (file: File) => void;
  addEvent: () => void;
  updateEvent: (i: number, patch: Partial<CronEvent>) => void;
  removeEvent: (id: string) => void;
}

export const FormCronoloxia: React.FC<Props> = ({
  form, set, equipos, handleRivalSelect, handleRivalFile,
  addEvent, updateEvent, removeEvent
}) => {
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
        <div className="input-group"><label>Fecha</label>
          <input type="date" value={form.fecha} onChange={e => set("fecha", e.target.value)} />
        </div>
        <div className="input-group"><label>Estadio</label>
          <input type="text" placeholder="Estadio Municipal de Santiso" value={form.estadio}
            onChange={e => set("estadio", e.target.value)} />
        </div>
      </div>
      
      <RivalSelector
        rivalNombre={form.rivalNombre}
        equipos={equipos}
        handleRivalSelect={handleRivalSelect}
        handleRivalFile={handleRivalFile}
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
        <div className="input-group"><label>Patrocinador Santiso</label>
          <input type="text" placeholder="SOLAINA" value={form.localSponsor} onChange={e => set("localSponsor", e.target.value)} />
        </div>
        <div className="input-group"><label>Patrocinador Rival</label>
          <input type="text" placeholder="HOSPEDAJE J.REY" value={form.rivalSponsor} onChange={e => set("rivalSponsor", e.target.value)} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
        <div className="input-group"><label>Goles Santiso</label>
          <input type="text" inputMode="numeric" pattern="[0-9]*" value={form.golesLocal} onChange={e => set("golesLocal", e.target.value)} />
        </div>
        <div className="input-group"><label>Goles Rival</label>
          <input type="text" inputMode="numeric" pattern="[0-9]*" value={form.golesRival} onChange={e => set("golesRival", e.target.value)} />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "1.4rem 0 0.8rem" }}>
        <p style={{ fontSize: "0.68rem", fontWeight: 800, textTransform: "uppercase",
                    letterSpacing: "1.5px", color: "var(--primary)", margin: 0 }}>
          Eventos del Partido
        </p>
        <button onClick={addEvent}
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)",
                   color: "var(--primary)", padding: "0.3rem 0.7rem", borderRadius: "0.5rem",
                   fontFamily: "inherit", fontWeight: 800, fontSize: "0.75rem", cursor: "pointer" }}>
          + Evento
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        {form.events.map((ev, i) => (
          <div key={ev.id} style={{ display: "grid", gridTemplateColumns: "55px 1fr 1fr 1fr auto", gap: "0.5rem", alignItems: "center" }}>
            <input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="Min'"
              value={ev.minuto} onChange={e => updateEvent(i, { minuto: e.target.value })}
              style={{ textAlign: "center" }} />
            <select value={ev.equipo} onChange={e => updateEvent(i, { equipo: e.target.value as CronEvent["equipo"] })}>
              <option value="local">Santiso</option>
              <option value="rival">Rival</option>
            </select>
            <select value={ev.tipo} onChange={e => updateEvent(i, { tipo: e.target.value as CronEvent["tipo"] })}>
              <option value="gol">⚽ Gol</option>
              <option value="amarela">🟨 Amarela</option>
              <option value="vermella">🟥 Vermella</option>
            </select>
            <input type="text" placeholder="Jugador" value={ev.jugador}
              onChange={e => updateEvent(i, { jugador: e.target.value })} />
            <button onClick={() => removeEvent(ev.id)}
              style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "1rem" }}>
              ✕
            </button>
          </div>
        ))}
        {form.events.length === 0 && (
          <p style={{ color: "#666", fontSize: "0.8rem", textAlign: "center", marginTop: "0.5rem" }}>
            No hay eventos registrados
          </p>
        )}
      </div>
    </>
  );
};
