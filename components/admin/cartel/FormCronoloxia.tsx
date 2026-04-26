/**
 * components/admin/cartel/FormCronoloxia.tsx
 * Form panel for the "Cronoloxía" template.
 */

import React from "react";
import type { FormState } from "./types";
import { RivalSelector } from "./FormPartido";
import { CategorySelector, MatchSelector } from "./Common";
import type { SelectorMatch } from "./Common";
import type { CronEvent } from "@/lib/cartel-draw";

interface CartelPlayerOption {
  id: string;
  nombre?: string | null;
  apodo?: string | null;
  dorsal?: number | string | null;
  categoria?: string | null;
}

interface Props {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  equipos: { id: string; nombre: string; escudo_url: string }[];
  jugadores: CartelPlayerOption[];
  handleRivalSelect: (nombre: string) => void;
  handleRivalFile: (file: File) => void;
  addEvent: () => void;
  updateEvent: (i: number, patch: Partial<CronEvent>) => void;
  removeEvent: (id: string) => void;
  dbMatches: SelectorMatch[];
  loadMatchFromDb: (m: SelectorMatch) => void;
}

export const FormCronoloxia: React.FC<Props & { tipo: string }> = ({
  form, set, equipos, jugadores, handleRivalSelect, handleRivalFile,
  addEvent, updateEvent, removeEvent, dbMatches, loadMatchFromDb, tipo
}) => {
  const eventControlStyle: React.CSSProperties = {
    width: "100%",
    minHeight: "42px",
    padding: "0.55rem 0.7rem",
    borderRadius: "0.7rem",
    background: "rgba(255,255,255,0.055)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#fff",
    fontFamily: "inherit",
    fontWeight: 750,
    outline: "none",
  };

  const renderTeamToggle = (ev: CronEvent, i: number) => (
    <div
      role="group"
      aria-label="Equipo del evento"
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "0.25rem",
        padding: "0.25rem",
        borderRadius: "0.85rem",
        background: "rgba(255,255,255,0.055)",
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      {(["local", "rival"] as const).map((team) => {
        const active = ev.equipo === team;
        return (
          <button
            key={team}
            type="button"
            onClick={() => updateEvent(i, { equipo: team, jugador: "", jugadorEntra: "" })}
            style={{
              border: "none",
              borderRadius: "0.62rem",
              padding: "0.45rem 0.55rem",
              background: active
                ? team === "local"
                  ? "var(--primary)"
                  : "rgba(255,255,255,0.92)"
                : "transparent",
              color: active ? "#050505" : "rgba(255,255,255,0.62)",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: "0.72rem",
              fontWeight: 900,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              transition: "all 0.18s ease",
            }}
          >
            {team === "local" ? "Santiso" : "Rival"}
          </button>
        );
      })}
    </div>
  );

  const getDisplayName = (j: CartelPlayerOption) => {
    if (!j) return "";
    if (j.apodo) return j.apodo;
    if (!j.nombre) return "";
    const parts = j.nombre.split(" ");
    return parts.length > 1 ? `${parts[0]} ${parts[1]}` : j.nombre;
  };

  const jugadoresCategoria = jugadores.filter(j => j.categoria === form.categoria);

  return (
    <>
      <MatchSelector dbMatches={dbMatches} onSelect={loadMatchFromDb} categoria={form.categoria} tipo={tipo} santisoOnly />
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
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {form.events.map((ev, i) => (
          <div
            key={ev.id}
            style={{
              display: "grid",
              gap: "0.55rem",
              padding: "0.7rem",
              borderRadius: "1rem",
              background: "linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.025))",
              border: "1px solid rgba(255,255,255,0.09)",
              boxShadow: "0 12px 28px rgba(0,0,0,0.18)",
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "58px 1fr 28px", gap: "0.55rem", alignItems: "center" }}>
              <input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="Min'"
                value={ev.minuto} onChange={e => updateEvent(i, { minuto: e.target.value })}
                style={{ ...eventControlStyle, textAlign: "center", padding: "0.45rem", fontSize: "0.95rem" }} />
              {renderTeamToggle(ev, i)}
              <button onClick={() => removeEvent(ev.id)}
                type="button"
                aria-label="Eliminar evento"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.22)", color: "#ef4444", cursor: "pointer", fontSize: "1rem", borderRadius: "0.7rem", minHeight: "42px" }}>
                ×
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "140px minmax(0, 1fr)", gap: "0.55rem", alignItems: "center" }}>
              <select 
                value={ev.tipo} 
                onChange={e => updateEvent(i, { tipo: e.target.value as CronEvent["tipo"], jugadorEntra: "" })}
                style={eventControlStyle}
              >
                <option value="gol">⚽ Gol</option>
                <option value="penalti">🥅 Penalti</option>
                <option value="propia">🔴 Gol en Propia</option>
                <option value="amarela">🟨 Amarela</option>
                <option value="doble_amarela">🟨🟨 Doble Amarela</option>
                <option value="vermella">🟥 Vermella</option>
                <option value="cambio">🔄 Cambio</option>
              </select>
            
            <div style={{ display: "flex", gap: "0.4rem", minWidth: 0 }}>
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
                        style={{ ...eventControlStyle, flex: 1, minWidth: 0, borderColor: "rgba(239,68,68,0.5)", fontSize: "0.78rem" }}
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
                        style={{ ...eventControlStyle, flex: 1, minWidth: 0, borderColor: "rgba(34,197,94,0.55)", fontSize: "0.78rem" }}
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
                        style={{ ...eventControlStyle, flex: 1, minWidth: 0, borderColor: "rgba(239,68,68,0.5)", fontSize: "0.78rem" }} />
                      <input type="text" placeholder="Entra..." value={ev.jugadorEntra}
                        onChange={e => updateEvent(i, { jugadorEntra: e.target.value })}
                        style={{ ...eventControlStyle, flex: 1, minWidth: 0, borderColor: "rgba(34,197,94,0.55)", fontSize: "0.78rem" }} />
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
                      style={{ ...eventControlStyle, flex: 1, minWidth: 0 }}
                    >
                      <option value="">Jugador...</option>
                      {jugadoresCategoria.map(j => (
                        <option key={j.id} value={j.id}>{getDisplayName(j)} (#{j.dorsal})</option>
                      ))}
                    </select>
                  ) : (
                    <input type="text" placeholder="Jugador Rival" value={ev.jugador}
                      onChange={e => updateEvent(i, { jugador: e.target.value })}
                      style={{ ...eventControlStyle, flex: 1, minWidth: 0 }} />
                  )}
                </>
              )}
            </div>
            </div>
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
