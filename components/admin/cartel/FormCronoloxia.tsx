/**
 * components/admin/cartel/FormCronoloxia.tsx
 * Form panel for the "Cronoloxía" template.
 */

import React from "react";
import type { FormState } from "./types";
import { RivalSelector } from "./FormPartido";
import { CategorySelector, MatchSelector } from "./Common";
import type { CronEvent } from "@/lib/cartel-draw";

interface Props {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  equipos: { id: string; nombre: string; escudo_url: string }[];
  jugadores: any[];
  handleRivalSelect: (nombre: string) => void;
  handleRivalFile: (file: File) => void;
  addEvent: () => void;
  updateEvent: (i: number, patch: Partial<CronEvent>) => void;
  removeEvent: (id: string) => void;
  dbMatches: any[];
  loadMatchFromDb: (m: any) => void;
}

export const FormCronoloxia: React.FC<Props> = ({
  form, set, equipos, jugadores, handleRivalSelect, handleRivalFile,
  addEvent, updateEvent, removeEvent, dbMatches, loadMatchFromDb
}) => {
  const getDisplayName = (j: any) => {
    if (j.apodo) return j.apodo;
    const parts = j.nombre.split(" ");
    return parts.length > 1 ? `${parts[0]} ${parts[1]}` : j.nombre;
  };

  const jugadoresCategoria = jugadores.filter(j => j.categoria === form.categoria);

  return (
    <>
      <MatchSelector dbMatches={dbMatches} onSelect={loadMatchFromDb} categoria={form.categoria} />
      <CategorySelector value={form.categoria} onChange={(v: string) => set("categoria", v)} />
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
        categoria={form.categoria}
        handleRivalSelect={handleRivalSelect}
        handleRivalFile={handleRivalFile}
      />

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
          <div key={ev.id} style={{ display: "grid", gridTemplateColumns: "55px 100px 140px 1fr auto", gap: "0.5rem", alignItems: "center" }}>
            <input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="Min'"
              value={ev.minuto} onChange={e => updateEvent(i, { minuto: e.target.value })}
              style={{ textAlign: "center", padding: "0.4rem" }} />
            <select 
              value={ev.equipo} 
              onChange={e => updateEvent(i, { equipo: e.target.value as CronEvent["equipo"], jugador: "" })}
              style={{ padding: "0.4rem", borderRadius: "0.4rem", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", color: "#fff" }}
            >
              <option value="local">Santiso</option>
              <option value="rival">Rival</option>
            </select>
            <select 
              value={ev.tipo} 
              onChange={e => updateEvent(i, { tipo: e.target.value as CronEvent["tipo"], jugadorEntra: "" })}
              style={{ padding: "0.4rem", borderRadius: "0.4rem", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", color: "#fff" }}
            >
              <option value="gol">⚽ Gol</option>
              <option value="penalti">🥅 Penalti</option>
              <option value="propia">🔴 Gol en Propia</option>
              <option value="amarela">🟨 Amarela</option>
              <option value="doble_amarela">🟨🟨 Doble Amarela</option>
              <option value="vermella">🟥 Vermella</option>
              <option value="cambio">🔄 Cambio</option>
            </select>
            
            <div style={{ display: "flex", gap: "0.3rem", flex: 1 }}>
              {ev.tipo === "cambio" ? (
                <>
                  {ev.equipo === "local" ? (
                    <>
                      <select 
                        title="Sale"
                        value={jugadores.find(j => getDisplayName(j) === ev.jugador)?.id || ""}
                        onChange={e => {
                          const jug = jugadores.find(j => j.id === e.target.value);
                          updateEvent(i, { jugador: jug ? getDisplayName(jug) : "" });
                        }}
                        style={{ flex: 1, padding: "0.4rem", borderRadius: "0.4rem", background: "rgba(255,255,255,0.04)", border: "1px solid #e55", color: "#fff", fontSize: "0.75rem" }}
                      >
                        <option value="">Sale...</option>
                        {jugadoresCategoria.map(j => (
                          <option key={j.id} value={j.id}>{getDisplayName(j)}</option>
                        ))}
                      </select>
                      <select 
                        title="Entra"
                        value={jugadores.find(j => getDisplayName(j) === ev.jugadorEntra)?.id || ""}
                        onChange={e => {
                          const jug = jugadores.find(j => j.id === e.target.value);
                          updateEvent(i, { jugadorEntra: jug ? getDisplayName(jug) : "" });
                        }}
                        style={{ flex: 1, padding: "0.4rem", borderRadius: "0.4rem", background: "rgba(255,255,255,0.04)", border: "1px solid #22c55e", color: "#fff", fontSize: "0.75rem" }}
                      >
                        <option value="">Entra...</option>
                        {jugadoresCategoria.map(j => (
                          <option key={j.id} value={j.id}>{getDisplayName(j)}</option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <>
                      <input type="text" placeholder="Sale..." value={ev.jugador}
                        onChange={e => updateEvent(i, { jugador: e.target.value })}
                        style={{ flex: 1, padding: "0.4rem", fontSize: "0.75rem", border: "1px solid #e55" }} />
                      <input type="text" placeholder="Entra..." value={ev.jugadorEntra}
                        onChange={e => updateEvent(i, { jugadorEntra: e.target.value })}
                        style={{ flex: 1, padding: "0.4rem", fontSize: "0.75rem", border: "1px solid #22c55e" }} />
                    </>
                  )}
                </>
              ) : (
                <>
                  {ev.equipo === "local" ? (
                    <select 
                      value={jugadores.find(j => getDisplayName(j) === ev.jugador)?.id || ""}
                      onChange={e => {
                        const jug = jugadores.find(j => j.id === e.target.value);
                        updateEvent(i, { jugador: jug ? getDisplayName(jug) : "" });
                      }}
                      style={{ flex: 1, padding: "0.4rem", borderRadius: "0.4rem", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", color: "#fff" }}
                    >
                      <option value="">Jugador...</option>
                      {jugadoresCategoria.map(j => (
                        <option key={j.id} value={j.id}>{getDisplayName(j)} (#{j.dorsal})</option>
                      ))}
                    </select>
                  ) : (
                    <input type="text" placeholder="Jugador Rival" value={ev.jugador}
                      onChange={e => updateEvent(i, { jugador: e.target.value })}
                      style={{ flex: 1, padding: "0.4rem" }} />
                  )}
                </>
              )}
            </div>

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
