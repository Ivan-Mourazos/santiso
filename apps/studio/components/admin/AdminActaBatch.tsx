"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase-browser";
import { saveReviewedActa } from "@/lib/actas/save-acta";
import { fetchSeasons } from "@/lib/supabase-queries";
import type {
  ActaCampoDb,
  ActaEvent,
  ActaEventType,
  ActaMatchDb,
  ActaPlayerDb,
  ActaPlayerRef,
  ParsedActa,
} from "@/lib/actas/types";

interface AdminActaBatchProps {
  showToast: (msg: string, type?: "success" | "error") => void;
}

interface DetectedMeta {
  jornada: number;
  localTeam: string;
  visitorTeam: string;
  categoria: string;
  competicion?: string;
}

type BatchStatus = "pending" | "detecting" | "analyzing" | "saving" | "done" | "review" | "error";

interface BatchItem {
  id: string;
  file: File;
  status: BatchStatus;
  partido?: string;
  competicion?: string;
  issues?: string[];
  error?: string;
  resolvedActa?: ParsedActa;
  match?: ActaMatchDb;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalizeForMatch(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function tokenScore(left: string, right: string) {
  const a = new Set(normalizeForMatch(left).split(" ").filter(Boolean));
  const b = new Set(normalizeForMatch(right).split(" ").filter(Boolean));
  if (a.size === 0 || b.size === 0) return 0;
  let hits = 0;
  for (const t of a) if (b.has(t)) hits++;
  return hits / Math.max(a.size, b.size);
}

function displayPlayer(player: ActaPlayerDb) {
  if (player.apodo?.trim()) return player.apodo.trim();
  const parts = player.nombre.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[1]}` : player.nombre;
}

function makePlayerRefFromDb(player: ActaPlayerDb): ActaPlayerRef {
  return {
    id: crypto.randomUUID(),
    dorsal: player.dorsal?.toString() || "",
    rawName: player.nombre,
    jugadorId: player.id,
    displayName: displayPlayer(player),
  };
}

function makeEvent(): ActaEvent {
  return {
    id: crypto.randomUUID(),
    tipo: "gol",
    minuto: "",
    isRival: false,
    confidence: "media",
  };
}

function jornadaNumber(match: ActaMatchDb) {
  return Number(match.jornada?.numero ?? 0);
}

function resolvePlayerRef(player: ActaPlayerRef, byDorsal: Map<string, ActaPlayerDb>, jugadores: ActaPlayerDb[]): ActaPlayerRef {
  const fromDorsal = byDorsal.get(player.dorsal);
  const fromName = jugadores
    .map((p) => ({ p, score: Math.max(tokenScore(player.rawName, p.nombre), tokenScore(player.rawName, p.apodo || "")) }))
    .sort((a, b) => b.score - a.score)[0];
  const db = fromDorsal || (fromName?.score >= 0.5 ? fromName.p : null);
  if (!db) return player;
  return { ...player, jugadorId: db.id, displayName: displayPlayer(db) };
}

function resolveParsedActa(acta: ParsedActa, jugadores: ActaPlayerDb[]): ParsedActa {
  const byDorsal = new Map(jugadores.filter((p) => p.dorsal !== null).map((p) => [String(p.dorsal), p]));
  const resolve = (p?: ActaPlayerRef) => p ? resolvePlayerRef(p, byDorsal, jugadores) : undefined;
  return {
    ...acta,
    titulares: acta.titulares.map((p) => resolvePlayerRef(p, byDorsal, jugadores)),
    suplentes: acta.suplentes.map((p) => resolvePlayerRef(p, byDorsal, jugadores)),
    eventos: acta.eventos.map((e) => ({ ...e, jugador: resolve(e.jugador), jugadorSale: resolve(e.jugadorSale), jugadorEntra: resolve(e.jugadorEntra) })),
  };
}

function resolveCampo(acta: ParsedActa, campos: ActaCampoDb[]): ParsedActa {
  if (acta.campoId || !acta.campoNombre.trim()) return acta;
  const best = campos
    .map((c) => ({ c, score: Math.max(tokenScore(acta.campoNombre, c.nombre), tokenScore(`${acta.campoNombre} ${acta.campoPoblacion}`, `${c.nombre} ${c.poblacion || ""}`)) }))
    .sort((a, b) => b.score - a.score)[0];
  if (!best || best.score < 0.55) return acta;
  return { ...acta, campoId: best.c.id, campoNombre: best.c.nombre, campoPoblacion: best.c.poblacion || acta.campoPoblacion };
}

function matchLabel(match: ActaMatchDb) {
  return `J${match.jornada?.numero ?? "?"} · ${match.equipo_local?.nombre ?? "Local"} vs ${match.equipo_visitante?.nombre ?? "Visitante"}`;
}

function getIssues(acta: ParsedActa): string[] {
  const issues: string[] = [];
  const unresolvedPlayers = [...acta.titulares, ...acta.suplentes].filter((p) => !p.jugadorId);
  if (unresolvedPlayers.length > 0) issues.push(`${unresolvedPlayers.length} jugador(es) sin enlazar`);
  const unresolvedEvents = acta.eventos.filter((e) => {
    if (e.esPropiaSantiso) return !e.jugador?.jugadorId;
    if (e.isRival) return !e.nombreRival?.trim();
    if (e.esPropia) return false;
    if (e.tipo === "cambio") return !e.jugadorSale?.jugadorId || !e.jugadorEntra?.jugadorId;
    return !e.jugador?.jugadorId;
  });
  if (unresolvedEvents.length > 0) issues.push(`${unresolvedEvents.length} evento(s) sin resolver`);
  const scoreWarning = acta.warnings?.find((w) => w.includes("no coinciden"));
  if (scoreWarning) issues.push(scoreWarning);
  return issues;
}

// ── API calls ────────────────────────────────────────────────────────────────

async function callDetect(file: File): Promise<DetectedMeta | null> {
  const fd = new FormData();
  fd.append("image", file);
  const res = await fetch("/api/admin/acta-detect", { method: "POST", body: fd });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.jornada) return null;
  return data as DetectedMeta;
}

async function callAnalyze(file: File, match: ActaMatchDb, jugadores: ActaPlayerDb[], campos: ActaCampoDb[]): Promise<ParsedActa | null> {
  const fd = new FormData();
  fd.append("image", file);
  fd.append("match", JSON.stringify(match));
  fd.append("jugadores", JSON.stringify(jugadores));
  fd.append("campos", JSON.stringify(campos));
  const res = await fetch("/api/admin/acta-gemini", { method: "POST", body: fd });
  if (!res.ok) return null;
  const payload = await res.json();
  return (payload.acta as ParsedActa) ?? null;
}

// ── Status icon ──────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: BatchStatus }) {
  const spin: React.CSSProperties = {
    display: "inline-block", width: 14, height: 14,
    border: "2px solid #555", borderTopColor: "#facc15",
    borderRadius: "50%", animation: "spin 0.7s linear infinite",
  };
  if (status === "detecting" || status === "analyzing" || status === "saving") return <span style={spin} />;
  if (status === "done") return <span style={{ color: "#4ade80" }}>✓</span>;
  if (status === "review") return <span style={{ color: "#f59e0b" }}>⚠</span>;
  if (status === "error") return <span style={{ color: "#ef4444" }}>✗</span>;
  return <span style={{ color: "#555" }}>–</span>;
}

function statusLabel(status: BatchStatus) {
  if (status === "detecting") return "Detectando...";
  if (status === "analyzing") return "Analizando...";
  if (status === "saving") return "Guardando...";
  if (status === "done") return "Guardado";
  if (status === "review") return "Revisar";
  if (status === "error") return "Error";
  return "Pendiente";
}

// ── Sub-components para el editor de revisión ─────────────────────────────────

function PlayerSelect({ jugadores, value, label, onChange }: {
  jugadores: ActaPlayerDb[];
  value: string;
  label: string;
  onChange: (id: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ width: "100%", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#fff", fontSize: "0.8rem", padding: "0.4rem" }}
    >
      <option value="">{label}</option>
      {jugadores.map((p) => (
        <option key={p.id} value={p.id}>{p.dorsal ?? "?"} - {displayPlayer(p)}</option>
      ))}
    </select>
  );
}

function LineupEditor({ players, jugadores, onChange, onRemove }: {
  players: ActaPlayerRef[];
  jugadores: ActaPlayerDb[];
  onChange: (index: number, playerId: string) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "0.75rem" }}>
      {players.map((player, index) => (
        <div key={player.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.5rem", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 8 }}>
          <span style={{ width: 28, textAlign: "center", fontWeight: 700, color: player.jugadorId ? "#4ade80" : "#f59e0b", fontSize: "0.8rem" }}>{player.dorsal || "?"}</span>
          <span style={{ flex: 1, fontSize: "0.78rem", color: "#888" }}>{player.rawName || "Sin texto"}</span>
          <select
            value={player.jugadorId || ""}
            onChange={(e) => onChange(index, e.target.value)}
            style={{ flex: 2, background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#fff", fontSize: "0.8rem", padding: "0.35rem" }}
          >
            <option value="">Sin enlazar...</option>
            {jugadores.map((p) => (
              <option key={p.id} value={p.id}>{p.dorsal ?? "?"} - {displayPlayer(p)}</option>
            ))}
          </select>
          <button onClick={() => onRemove(index)} style={{ background: "transparent", color: "#555", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "0.3rem 0.5rem", fontSize: "0.75rem", cursor: "pointer" }}>✕</button>
        </div>
      ))}
    </div>
  );
}

function EventEditor({ eventos, jugadores, onUpdate, onSetPlayer, onRemove }: {
  eventos: ActaEvent[];
  jugadores: ActaPlayerDb[];
  onUpdate: (index: number, patch: Partial<ActaEvent>) => void;
  onSetPlayer: (index: number, key: "jugador" | "jugadorSale" | "jugadorEntra", playerId: string) => void;
  onRemove: (index: number) => void;
}) {
  const typeOptions: ActaEventType[] = ["gol", "tarjeta_amarilla", "tarjeta_roja", "cambio"];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
      {eventos.map((event, index) => (
        <div key={event.id} style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 8, padding: "0.75rem" }}>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.6rem", flexWrap: "wrap" }}>
            <input
              value={event.minuto}
              onChange={(e) => onUpdate(index, { minuto: e.target.value })}
              placeholder="Min"
              style={{ width: 46, textAlign: "center", fontWeight: 700, background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#fff", fontSize: "0.8rem", padding: "0.35rem" }}
            />
            <select value={event.tipo} onChange={(e) => onUpdate(index, { tipo: e.target.value as ActaEventType })} style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#fff", fontSize: "0.8rem", padding: "0.35rem" }}>
              {typeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select
              value={event.isRival ? (event.esPropiaSantiso ? "propia_santiso" : "rival") : event.esPropia ? "propia_rival" : "santiso"}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "rival") onUpdate(index, { isRival: true, esPropia: false, esPropiaSantiso: false });
                else if (v === "propia_rival") onUpdate(index, { isRival: false, esPropia: true, esPropiaSantiso: false, jugador: undefined });
                else if (v === "propia_santiso") onUpdate(index, { isRival: true, esPropia: false, esPropiaSantiso: true });
                else onUpdate(index, { isRival: false, esPropia: false, esPropiaSantiso: false });
              }}
              style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#fff", fontSize: "0.8rem", padding: "0.35rem" }}
            >
              <option value="santiso">Santiso</option>
              <option value="rival">Rival</option>
              {event.tipo === "gol" && <option value="propia_rival">Propia (rival)</option>}
              {event.tipo === "gol" && <option value="propia_santiso">Propia (Santiso)</option>}
            </select>
            <button onClick={() => onRemove(index)} style={{ marginLeft: "auto", background: "transparent", color: "#555", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "0.3rem 0.5rem", fontSize: "0.75rem", cursor: "pointer" }}>✕</button>
          </div>
          <div>
            {event.esPropiaSantiso ? (
              <PlayerSelect jugadores={jugadores} value={event.jugador?.jugadorId || ""} label="Jugador Santiso en propia..." onChange={(id) => onSetPlayer(index, "jugador", id)} />
            ) : event.isRival ? (
              <input value={event.nombreRival || ""} onChange={(e) => onUpdate(index, { nombreRival: e.target.value })} placeholder="Nombre jugador rival" style={{ width: "100%", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#fff", fontSize: "0.8rem", padding: "0.35rem" }} />
            ) : event.esPropia ? (
              <input value={event.nombreRival || ""} onChange={(e) => onUpdate(index, { nombreRival: e.target.value })} placeholder="Nombre jugador rival (opcional)" style={{ width: "100%", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#fff", fontSize: "0.8rem", padding: "0.35rem" }} />
            ) : event.tipo === "cambio" ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                <PlayerSelect jugadores={jugadores} value={event.jugadorSale?.jugadorId || ""} label="Sale..." onChange={(id) => onSetPlayer(index, "jugadorSale", id)} />
                <PlayerSelect jugadores={jugadores} value={event.jugadorEntra?.jugadorId || ""} label="Entra..." onChange={(id) => onSetPlayer(index, "jugadorEntra", id)} />
              </div>
            ) : (
              <PlayerSelect jugadores={jugadores} value={event.jugador?.jugadorId || ""} label="Jugador Santiso..." onChange={(id) => onSetPlayer(index, "jugador", id)} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Modal de revisión ─────────────────────────────────────────────────────────

function BatchReviewModal({ item, allMatches, jugadoresByCategoria, campos, onSaved, onCancel }: {
  item: BatchItem;
  allMatches: ActaMatchDb[];
  jugadoresByCategoria: Record<string, ActaPlayerDb[]>;
  campos: ActaCampoDb[];
  onSaved: (id: string) => void;
  onCancel: () => void;
}) {
  const [acta, setActa] = useState<ParsedActa>(item.resolvedActa!);
  const [selectedMatch, setSelectedMatch] = useState<ActaMatchDb>(item.match!);
  const [saving, setSaving] = useState(false);

  const jugadores = jugadoresByCategoria[selectedMatch?.categoria || ""] || [];
  const santisoLocal = selectedMatch?.equipo_local?.nombre?.toLowerCase().includes("santiso") ?? true;
  const santisoName = santisoLocal ? selectedMatch?.equipo_local?.nombre : selectedMatch?.equipo_visitante?.nombre;
  const rivalName = santisoLocal ? selectedMatch?.equipo_visitante?.nombre : selectedMatch?.equipo_local?.nombre;

  function changeMatch(matchId: string) {
    const m = allMatches.find((x) => x.id === matchId);
    if (m) setSelectedMatch(m);
  }

  const unresolvedLineup = [...acta.titulares, ...acta.suplentes].filter((p) => !p.jugadorId);
  const unresolvedEvents = acta.eventos.filter((e) => {
    if (e.esPropiaSantiso) return !e.jugador?.jugadorId;
    if (e.isRival) return !e.nombreRival?.trim();
    if (e.esPropia) return false;
    if (e.tipo === "cambio") return !e.jugadorSale?.jugadorId || !e.jugadorEntra?.jugadorId;
    return !e.jugador?.jugadorId;
  });
  const canSave = !!selectedMatch && unresolvedLineup.length === 0 && unresolvedEvents.length === 0;

  function setPlayerInSection(section: "titulares" | "suplentes", index: number, playerId: string) {
    const db = jugadores.find((p) => p.id === playerId);
    if (!db) return;
    setActa((cur) => {
      const next = [...cur[section]];
      next[index] = makePlayerRefFromDb(db);
      return { ...cur, [section]: next };
    });
  }

  function removeFromSection(section: "titulares" | "suplentes", index: number) {
    setActa((cur) => ({ ...cur, [section]: cur[section].filter((_, i) => i !== index) }));
  }

  function addToSection(section: "titulares" | "suplentes") {
    setActa((cur) => ({ ...cur, [section]: [...cur[section], { id: crypto.randomUUID(), dorsal: "", rawName: "" }] }));
  }

  function updateEvent(index: number, patch: Partial<ActaEvent>) {
    setActa((cur) => {
      const eventos = [...cur.eventos];
      eventos[index] = { ...eventos[index], ...patch };
      return { ...cur, eventos };
    });
  }

  function setEventPlayer(index: number, key: "jugador" | "jugadorSale" | "jugadorEntra", playerId: string) {
    const db = jugadores.find((p) => p.id === playerId);
    updateEvent(index, { [key]: db ? makePlayerRefFromDb(db) : undefined });
  }

  function removeEvent(index: number) {
    setActa((cur) => ({ ...cur, eventos: cur.eventos.filter((_, i) => i !== index) }));
  }

  function addEvent() {
    setActa((cur) => ({ ...cur, eventos: [...cur.eventos, makeEvent()] }));
  }

  function selectCampo(campoId: string) {
    if (!campoId) { setActa((cur) => ({ ...cur, campoId: undefined })); return; }
    const campo = campos.find((c) => c.id === campoId);
    if (!campo) return;
    setActa((cur) => ({ ...cur, campoId: campo.id, campoNombre: campo.nombre, campoPoblacion: campo.poblacion || "" }));
  }

  async function handleSave() {
    if (!selectedMatch || !canSave) return;
    setSaving(true);
    try {
      await saveReviewedActa({ supabase, partidoId: selectedMatch.id, acta });
      onSaved(item.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", backdropFilter: "blur(6px)", zIndex: 9500, display: "flex", flexDirection: "column", overflowY: "auto" }}>
      {/* Header */}
      <div style={{ position: "sticky", top: 0, background: "#0a0a0a", borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "1rem 1.5rem", display: "flex", alignItems: "center", gap: "1rem", zIndex: 10, flexWrap: "wrap" }}>
        <button onClick={onCancel} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem", flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Volver al lote
        </button>

        {/* Selector de partido — agrupado por competición, ordenado por jornada */}
        <div style={{ flex: 1, minWidth: 260 }}>
          <select
            value={selectedMatch?.id || ""}
            onChange={(e) => changeMatch(e.target.value)}
            style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: "0.85rem", padding: "0.5rem 0.75rem", fontWeight: 600 }}
          >
            {(() => {
              const grouped = new Map<string, ActaMatchDb[]>();
              for (const m of allMatches) {
                const key = `${m.categoria} — ${m.jornada?.competicion || m.competicion || "Liga"}`;
                if (!grouped.has(key)) grouped.set(key, []);
                grouped.get(key)!.push(m);
              }
              return [...grouped.entries()]
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([label, matches]) => (
                  <optgroup key={label} label={label}>
                    {matches
                      .slice()
                      .sort((a, b) => jornadaNumber(a) - jornadaNumber(b))
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          J{m.jornada?.numero} · {m.equipo_local?.nombre} vs {m.equipo_visitante?.nombre}
                        </option>
                      ))}
                  </optgroup>
                ));
            })()}
          </select>
        </div>

        {/* Indicador Santiso LOCAL/VISITANTE vs Rival */}
        {selectedMatch && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.78rem", flexShrink: 0 }}>
            <span style={{ color: "#4ade80", fontWeight: 700 }}>Santiso</span>
            <span style={{ color: "#555" }}>como</span>
            <span style={{ color: "#facc15", fontWeight: 700 }}>{santisoLocal ? "LOCAL" : "VISITANTE"}</span>
            <span style={{ color: "#555" }}>vs</span>
            <span style={{ color: "#f87171", fontWeight: 700 }}>{rivalName || "Rival"}</span>
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={!canSave || saving}
          className="btn-primary"
          style={{ opacity: canSave ? 1 : 0.4, minWidth: 120, flexShrink: 0 }}
        >
          {saving ? "Guardando..." : "Confirmar e insertar"}
        </button>
      </div>

      {/* Issues */}
      {(unresolvedLineup.length > 0 || unresolvedEvents.length > 0) && (
        <div style={{ margin: "1rem 1.5rem 0", padding: "0.75rem 1rem", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 8, fontSize: "0.8rem", color: "#f59e0b", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          {unresolvedLineup.length > 0 && <span>⚠ {unresolvedLineup.length} jugador(es) sin enlazar</span>}
          {unresolvedEvents.length > 0 && <span>⚠ {unresolvedEvents.length} evento(s) sin resolver</span>}
        </div>
      )}

      {/* Body */}
      <div style={{ padding: "1.5rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>

        {/* Datos partido */}
        <div style={{ gridColumn: "1 / -1" }}>
          <div className="card glass" style={{ padding: "1rem" }}>
            <h4 style={{ marginBottom: "0.75rem", fontSize: "0.8rem", color: "#888", textTransform: "uppercase", letterSpacing: "1px" }}>Datos del partido</h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "0.75rem" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.78rem", color: "#888" }}>
                Goles {santisoLocal ? "local (Santiso)" : "local (Rival)"}
                <input value={acta.marcadorLocal} onChange={(e) => setActa((c) => ({ ...c, marcadorLocal: e.target.value }))} style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#fff", fontSize: "0.85rem", padding: "0.4rem", fontWeight: 700 }} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.78rem", color: "#888" }}>
                Goles {santisoLocal ? "visitante (Rival)" : "visitante (Santiso)"}
                <input value={acta.marcadorVisitante} onChange={(e) => setActa((c) => ({ ...c, marcadorVisitante: e.target.value }))} style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#fff", fontSize: "0.85rem", padding: "0.4rem", fontWeight: 700 }} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.78rem", color: "#888" }}>
                Campo
                <select value={acta.campoId || ""} onChange={(e) => selectCampo(e.target.value)} style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#fff", fontSize: "0.8rem", padding: "0.4rem" }}>
                  <option value="">Nuevo / detectado</option>
                  {campos.map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.poblacion ? ` (${c.poblacion})` : ""}</option>)}
                </select>
              </label>
            </div>
            {/* Nombre de campo si no vinculado */}
            {!acta.campoId && acta.campoNombre && (
              <div style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "#666" }}>
                Campo detectado: <span style={{ color: "#aaa" }}>{acta.campoNombre}{acta.campoPoblacion ? `, ${acta.campoPoblacion}` : ""}</span>
              </div>
            )}
          </div>
        </div>

        {/* Titulares */}
        <div className="card glass" style={{ padding: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <h4 style={{ fontSize: "0.8rem", color: "#888", textTransform: "uppercase", letterSpacing: "1px" }}>Titulares <span style={{ color: "#4ade80" }}>(Santiso)</span></h4>
            <button onClick={() => addToSection("titulares")} className="btn-secondary" style={{ fontSize: "0.72rem", padding: "0.3rem 0.6rem" }}>+ Añadir</button>
          </div>
          <LineupEditor players={acta.titulares} jugadores={jugadores} onChange={(i, id) => setPlayerInSection("titulares", i, id)} onRemove={(i) => removeFromSection("titulares", i)} />
        </div>

        {/* Suplentes */}
        <div className="card glass" style={{ padding: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <h4 style={{ fontSize: "0.8rem", color: "#888", textTransform: "uppercase", letterSpacing: "1px" }}>Suplentes <span style={{ color: "#4ade80" }}>(Santiso)</span></h4>
            <button onClick={() => addToSection("suplentes")} className="btn-secondary" style={{ fontSize: "0.72rem", padding: "0.3rem 0.6rem" }}>+ Añadir</button>
          </div>
          <LineupEditor players={acta.suplentes} jugadores={jugadores} onChange={(i, id) => setPlayerInSection("suplentes", i, id)} onRemove={(i) => removeFromSection("suplentes", i)} />
        </div>

        {/* Eventos */}
        <div className="card glass" style={{ padding: "1rem", gridColumn: "1 / -1" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <h4 style={{ fontSize: "0.8rem", color: "#888", textTransform: "uppercase", letterSpacing: "1px" }}>Eventos</h4>
            <button onClick={addEvent} className="btn-secondary" style={{ fontSize: "0.72rem", padding: "0.3rem 0.6rem" }}>+ Añadir</button>
          </div>
          {/* Leyenda de equipo */}
          <div style={{ fontSize: "0.72rem", color: "#555", marginBottom: "0.75rem", display: "flex", gap: "1rem" }}>
            <span><span style={{ color: "#4ade80" }}>●</span> Santiso = {santisoName || "Santiso"}</span>
            <span><span style={{ color: "#f87171" }}>●</span> Rival = {rivalName || "Rival"}</span>
          </div>
          <EventEditor eventos={acta.eventos} jugadores={jugadores} onUpdate={updateEvent} onSetPlayer={setEventPlayer} onRemove={removeEvent} />
        </div>

        {/* Warnings */}
        {acta.warnings && acta.warnings.length > 0 && (
          <div style={{ gridColumn: "1 / -1", fontSize: "0.78rem", color: "#f59e0b" }}>
            {acta.warnings.map((w, i) => <div key={i} style={{ marginBottom: "0.25rem" }}>⚠ {w}</div>)}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ── Component principal ───────────────────────────────────────────────────────

export default function AdminActaBatch({ showToast }: AdminActaBatchProps) {
  const [allMatches, setAllMatches] = useState<ActaMatchDb[]>([]);
  const [jugadoresByCategoria, setJugadoresByCategoria] = useState<Record<string, ActaPlayerDb[]>>({});
  const [campos, setCampos] = useState<ActaCampoDb[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [items, setItems] = useState<BatchItem[]>([]);
  const [running, setRunning] = useState(false);
  const abortRef = useRef(false);
  const [reviewingItem, setReviewingItem] = useState<BatchItem | null>(null);

  useEffect(() => {
    (async () => {
      setLoadingData(true);
      const { active } = await fetchSeasons();

      const [matchesRes, jugadoresRes, camposRes] = await Promise.all([
        supabase
          .from("partidos_liga")
          .select("id, categoria, competicion, competicion_id, estado, fecha, goles_local, goles_visitante, campo_id, equipo_local_id, equipo_visitante_id, equipo_local:equipo_local_id(nombre), equipo_visitante:equipo_visitante_id(nombre), jornada:jornada_id(numero, competicion, competicion_id, temporada_id), campo:campo_id(nombre, poblacion)")
          .order("fecha", { ascending: false }),
        supabase.from("jugadores").select("id, dorsal, nombre, apodo, categoria").order("dorsal", { ascending: true }),
        supabase.from("campos_futbol").select("id, nombre, poblacion"),
      ]);

      if (matchesRes.data) {
        const santiso = (matchesRes.data as ActaMatchDb[]).filter((m) => {
          const local = m.equipo_local?.nombre?.toLowerCase() || "";
          const visitante = m.equipo_visitante?.nombre?.toLowerCase() || "";
          const sameSeason = active?.id ? m.jornada?.temporada_id === active.id : true;
          return (local.includes("santiso") || visitante.includes("santiso")) && sameSeason;
        });
        setAllMatches(santiso);
      }

      if (jugadoresRes.data) {
        const bycat: Record<string, ActaPlayerDb[]> = {};
        for (const j of jugadoresRes.data as ActaPlayerDb[]) {
          (bycat[j.categoria] = bycat[j.categoria] || []).push(j);
        }
        setJugadoresByCategoria(bycat);
      }

      if (camposRes.data) setCampos(camposRes.data as ActaCampoDb[]);
      setLoadingData(false);
    })();
  }, []);

  function onFilesSelected(files: FileList | null) {
    if (!files) return;
    const newItems: BatchItem[] = Array.from(files).map((f) => ({
      id: crypto.randomUUID(),
      file: f,
      status: "pending",
    }));
    setItems((prev) => [...prev, ...newItems]);
  }

  function updateItem(id: string, patch: Partial<BatchItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  async function processAll() {
    // Items con resolvedActa ya están esperando revisión manual — no reintentar
    const pending = items.filter((it) =>
      it.status === "pending" ||
      it.status === "error" ||
      (it.status === "review" && !it.resolvedActa),
    );
    if (!pending.length) return;
    setRunning(true);
    abortRef.current = false;

    let savedCount = 0;
    let reviewCount = 0;
    let errorCount = 0;

    for (const item of pending) {
      if (abortRef.current) break;

      // 1. Detect
      updateItem(item.id, { status: "detecting" });
      const meta = await callDetect(item.file);
      if (!meta) {
        updateItem(item.id, { status: "error", error: "No se pudo detectar el partido" });
        errorCount++;
        continue;
      }

      // 2. Find match — primero filtrar por categoria+jornada, luego elegir
      //    el mejor por similitud de nombre de equipo rival detectado.
      const candidates = allMatches.filter(
        (m) => m.categoria === meta.categoria && String(m.jornada?.numero) === String(meta.jornada),
      );
      const match = (() => {
        if (candidates.length === 0) return null;
        if (candidates.length === 1) return candidates[0];
        // Nombre rival detectado: el que NO es Santiso en meta
        const detectedRival = [meta.localTeam, meta.visitorTeam]
          .find((t) => !t.toLowerCase().includes("santiso")) || "";
        return candidates
          .map((m) => {
            const local = m.equipo_local?.nombre || "";
            const visitante = m.equipo_visitante?.nombre || "";
            const rival = local.toLowerCase().includes("santiso") ? visitante : local;
            return { m, score: tokenScore(detectedRival, rival) };
          })
          .sort((a, b) => b.score - a.score)[0].m;
      })();
      if (!match) {
        updateItem(item.id, {
          status: "review",
          partido: `J${meta.jornada} ${meta.categoria}`,
          competicion: meta.competicion,
          issues: [`Partido no encontrado en BD (J${meta.jornada} ${meta.categoria})`],
        });
        reviewCount++;
        continue;
      }

      const jugadores = jugadoresByCategoria[match.categoria] || [];

      // 3. Analyze
      updateItem(item.id, { status: "analyzing", partido: matchLabel(match), competicion: meta.competicion });
      const parsed = await callAnalyze(item.file, match, jugadores, campos);
      if (!parsed) {
        updateItem(item.id, { status: "error", partido: matchLabel(match), error: "Gemini no devolvió datos" });
        errorCount++;
        continue;
      }

      // 4. Resolve
      const resolved = resolveCampo(resolveParsedActa(parsed, jugadores), campos);

      // 5. Check issues — si los hay, guardar acta resuelta para revisión manual
      const issues = getIssues(resolved);
      if (issues.length > 0) {
        updateItem(item.id, {
          status: "review",
          partido: matchLabel(match),
          competicion: meta.competicion,
          issues,
          resolvedActa: resolved,
          match,
        });
        reviewCount++;
        continue;
      }

      // 6. Save
      updateItem(item.id, { status: "saving" });
      try {
        await saveReviewedActa({ supabase, partidoId: match.id, acta: resolved });
        updateItem(item.id, { status: "done", partido: matchLabel(match) });
        savedCount++;
      } catch (err) {
        updateItem(item.id, {
          status: "error",
          partido: matchLabel(match),
          error: err instanceof Error ? err.message : "Error al guardar",
        });
        errorCount++;
      }
    }

    setRunning(false);
    const parts = [`${savedCount} guardada(s)`];
    if (reviewCount > 0) parts.push(`${reviewCount} para revisar`);
    if (errorCount > 0) parts.push(`${errorCount} con error`);
    showToast(
      `Lote completado: ${parts.join(", ")}`,
      reviewCount > 0 || errorCount > 0 ? "error" : "success",
    );
  }

  const pendingCount = items.filter((it) =>
    it.status === "pending" ||
    it.status === "error" ||
    (it.status === "review" && !it.resolvedActa),
  ).length;

  return (
    <>
      <div className="card glass">
        <div className="acta-header">
          <div>
            <h3>Importar actas en lote</h3>
            <p>
              Sube varios PDFs de una vez. Se detecta y analiza cada uno automáticamente.
              Las actas con problemas se marcan para revisión — puedes corregirlas sin salir.
            </p>
          </div>
        </div>

        {loadingData ? null : (
          <>
            {/* Drop zone */}
            <label
              htmlFor="batch-file-input"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); onFilesSelected(e.dataTransfer.files); }}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: "0.5rem", padding: "2rem", border: "2px dashed rgba(255,255,255,0.12)",
                borderRadius: "12px", background: "rgba(255,255,255,0.02)", cursor: "pointer", marginBottom: "1.5rem",
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.5 }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span style={{ fontSize: "0.85rem", color: "#666", fontWeight: 600 }}>
                Arrastra los PDFs aquí o haz clic — múltiples a la vez
              </span>
              <input id="batch-file-input" type="file" accept="application/pdf,image/*" multiple onChange={(e) => onFilesSelected(e.target.files)} style={{ display: "none" }} />
            </label>

            {/* Table */}
            {items.length > 0 && (
              <div style={{ marginBottom: "1.5rem", overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                      <th style={{ textAlign: "left", padding: "0.5rem 0.75rem", color: "#555", fontWeight: 700 }}>Archivo</th>
                      <th style={{ textAlign: "left", padding: "0.5rem 0.75rem", color: "#555", fontWeight: 700 }}>Partido</th>
                      <th style={{ textAlign: "center", padding: "0.5rem 0.75rem", color: "#555", fontWeight: 700 }}>Estado</th>
                      <th style={{ textAlign: "left", padding: "0.5rem 0.75rem", color: "#555", fontWeight: 700 }}>Info</th>
                      <th style={{ padding: "0.5rem 0.75rem" }} />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <td style={{ padding: "0.5rem 0.75rem", color: "#aaa", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.file.name}
                        </td>
                        <td style={{ padding: "0.5rem 0.75rem" }}>
                          <span style={{ color: "#ccc", display: "block" }}>{item.partido ?? "—"}</span>
                          {item.competicion && <span style={{ color: "#666", fontSize: "0.72rem", display: "block", marginTop: "0.1rem" }}>{item.competicion}</span>}
                        </td>
                        <td style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>
                          <StatusIcon status={item.status} />
                          <span style={{ marginLeft: "0.4rem", color: "#888" }}>{statusLabel(item.status)}</span>
                        </td>
                        <td style={{ padding: "0.5rem 0.75rem", color: "#f59e0b", fontSize: "0.75rem" }}>
                          {item.issues?.join(" · ") || item.error || ""}
                        </td>
                        <td style={{ padding: "0.5rem 0.75rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
                          {item.status === "review" && item.resolvedActa && (
                            <button
                              onClick={() => setReviewingItem(item)}
                              style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", color: "#f59e0b", borderRadius: 6, padding: "0.3rem 0.7rem", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer" }}
                            >
                              Revisar
                            </button>
                          )}
                          <button
                            onClick={() => setItems((prev) => prev.filter((it) => it.id !== item.id))}
                            disabled={running}
                            style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: "0.8rem" }}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
              <button
                className="btn-primary"
                onClick={processAll}
                disabled={running || pendingCount === 0 || loadingData}
              >
                {running ? "Procesando..." : `Procesar ${pendingCount} acta(s)`}
              </button>
              {running && (
                <button
                  onClick={() => { abortRef.current = true; }}
                  style={{ background: "none", border: "1px solid #555", color: "#888", padding: "0.6rem 1rem", borderRadius: "8px", cursor: "pointer", fontSize: "0.8rem" }}
                >
                  Detener
                </button>
              )}
              {items.length > 0 && !running && (
                <button
                  onClick={() => setItems([])}
                  style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: "0.8rem", textDecoration: "underline" }}
                >
                  Limpiar lista
                </button>
              )}
            </div>
          </>
        )}

        <style jsx>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>

      {/* Modal de revisión */}
      {reviewingItem && (
        <BatchReviewModal
          item={reviewingItem}
          allMatches={allMatches}
          jugadoresByCategoria={jugadoresByCategoria}
          campos={campos}
          onSaved={(id) => {
            updateItem(id, { status: "done", resolvedActa: undefined, issues: undefined });
            showToast("Acta guardada correctamente");
            setReviewingItem(null);
          }}
          onCancel={() => setReviewingItem(null)}
        />
      )}
    </>
  );
}
