"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase-browser";
import { saveReviewedActa } from "@/lib/actas/save-acta";
import { fetchSeasons } from "@/lib/supabase-queries";
import type {
  ActaCampoDb,
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
}

// ── Helpers (mirrors AdminActaImporter) ──────────────────────────────────────

function normalizeForMatch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
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

function resolvePlayerRef(
  player: ActaPlayerRef,
  byDorsal: Map<string, ActaPlayerDb>,
  jugadores: ActaPlayerDb[],
): ActaPlayerRef {
  const fromDorsal = byDorsal.get(player.dorsal);
  const fromName = jugadores
    .map((p) => ({
      p,
      score: Math.max(
        tokenScore(player.rawName, p.nombre),
        tokenScore(player.rawName, p.apodo || ""),
      ),
    }))
    .sort((a, b) => b.score - a.score)[0];
  const db = fromDorsal || (fromName?.score >= 0.5 ? fromName.p : null);
  if (!db) return player;
  return { ...player, jugadorId: db.id, displayName: displayPlayer(db) };
}

function resolveParsedActa(acta: ParsedActa, jugadores: ActaPlayerDb[]): ParsedActa {
  const byDorsal = new Map(
    jugadores.filter((p) => p.dorsal !== null).map((p) => [String(p.dorsal), p]),
  );
  const resolve = (p?: ActaPlayerRef) =>
    p ? resolvePlayerRef(p, byDorsal, jugadores) : undefined;
  return {
    ...acta,
    titulares: acta.titulares.map((p) => resolvePlayerRef(p, byDorsal, jugadores)),
    suplentes: acta.suplentes.map((p) => resolvePlayerRef(p, byDorsal, jugadores)),
    eventos: acta.eventos.map((e) => ({
      ...e,
      jugador: resolve(e.jugador),
      jugadorSale: resolve(e.jugadorSale),
      jugadorEntra: resolve(e.jugadorEntra),
    })),
  };
}

function resolveCampo(acta: ParsedActa, campos: ActaCampoDb[]): ParsedActa {
  if (acta.campoId || !acta.campoNombre.trim()) return acta;
  const best = campos
    .map((c) => ({
      c,
      score: Math.max(
        tokenScore(acta.campoNombre, c.nombre),
        tokenScore(`${acta.campoNombre} ${acta.campoPoblacion}`, `${c.nombre} ${c.poblacion || ""}`),
      ),
    }))
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
  if (unresolvedPlayers.length > 0)
    issues.push(`${unresolvedPlayers.length} jugador(es) sin enlazar`);

  const unresolvedEvents = acta.eventos.filter((e) => {
    if (e.esPropiaSantiso) return !e.jugador?.jugadorId;
    if (e.isRival) return !e.nombreRival?.trim();
    if (e.esPropia) return false;
    if (e.tipo === "cambio") return !e.jugadorSale?.jugadorId || !e.jugadorEntra?.jugadorId;
    return !e.jugador?.jugadorId;
  });
  if (unresolvedEvents.length > 0)
    issues.push(`${unresolvedEvents.length} evento(s) sin resolver`);

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

async function callAnalyze(
  file: File,
  match: ActaMatchDb,
  jugadores: ActaPlayerDb[],
  campos: ActaCampoDb[],
): Promise<ParsedActa | null> {
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
    display: "inline-block",
    width: 14,
    height: 14,
    border: "2px solid #555",
    borderTopColor: "#facc15",
    borderRadius: "50%",
    animation: "spin 0.7s linear infinite",
  };
  if (status === "detecting" || status === "analyzing" || status === "saving")
    return <span style={spin} />;
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

// ── Component ────────────────────────────────────────────────────────────────

export default function AdminActaBatch({ showToast }: AdminActaBatchProps) {
  const [allMatches, setAllMatches] = useState<ActaMatchDb[]>([]);
  const [jugadoresByCategoria, setJugadoresByCategoria] = useState<Record<string, ActaPlayerDb[]>>({});
  const [campos, setCampos] = useState<ActaCampoDb[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [items, setItems] = useState<BatchItem[]>([]);
  const [running, setRunning] = useState(false);
  const abortRef = useRef(false);

  useEffect(() => {
    (async () => {
      setLoadingData(true);
      const { active } = await fetchSeasons();

      const [matchesRes, jugadoresRes, camposRes] = await Promise.all([
        supabase
          .from("partidos_liga")
          .select(
            "id, categoria, competicion, competicion_id, estado, fecha, goles_local, goles_visitante, campo_id, equipo_local_id, equipo_visitante_id, equipo_local:equipo_local_id(nombre), equipo_visitante:equipo_visitante_id(nombre), jornada:jornada_id(numero, competicion, competicion_id, temporada_id), campo:campo_id(nombre, poblacion)",
          )
          .order("fecha", { ascending: false }),
        supabase
          .from("jugadores")
          .select("id, dorsal, nombre, apodo, categoria")
          .order("dorsal", { ascending: true }),
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
    const pending = items.filter((it) => it.status === "pending" || it.status === "review" || it.status === "error");
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

      // 2. Find match
      const match = allMatches.find(
        (m) =>
          m.categoria === meta.categoria &&
          String(m.jornada?.numero) === String(meta.jornada),
      );
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

      // 5. Check issues
      const issues = getIssues(resolved);
      if (issues.length > 0) {
        updateItem(item.id, { status: "review", partido: matchLabel(match), issues });
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

  const pendingCount = items.filter(
    (it) => it.status === "pending" || it.status === "review" || it.status === "error",
  ).length;

  return (
    <div className="card glass">
      <div className="acta-header">
        <div>
          <h3>Importar actas en lote</h3>
          <p>
            Sube varios PDFs de una vez. Se detecta y analiza cada uno automáticamente.
            Los que no puedan guardarse solos se marcan para revisión individual.
          </p>
        </div>
      </div>

      {loadingData ? (
        <p style={{ color: "#666", textAlign: "center", padding: "2rem" }}>Cargando datos...</p>
      ) : (
        <>
          {/* Drop zone */}
          <label
            htmlFor="batch-file-input"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              onFilesSelected(e.dataTransfer.files);
            }}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              padding: "2rem",
              border: "2px dashed rgba(255,255,255,0.12)",
              borderRadius: "12px",
              background: "rgba(255,255,255,0.02)",
              cursor: "pointer",
              marginBottom: "1.5rem",
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
            <input
              id="batch-file-input"
              type="file"
              accept="application/pdf,image/*"
              multiple
              onChange={(e) => onFilesSelected(e.target.files)}
              style={{ display: "none" }}
            />
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
                    <tr
                      key={item.id}
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                    >
                      <td style={{ padding: "0.5rem 0.75rem", color: "#aaa", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.file.name}
                      </td>
                      <td style={{ padding: "0.5rem 0.75rem" }}>
                        <span style={{ color: "#ccc", display: "block" }}>{item.partido ?? "—"}</span>
                        {item.competicion && (
                          <span style={{ color: "#666", fontSize: "0.72rem", display: "block", marginTop: "0.1rem" }}>
                            {item.competicion}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>
                        <StatusIcon status={item.status} />
                        <span style={{ marginLeft: "0.4rem", color: "#888" }}>{statusLabel(item.status)}</span>
                      </td>
                      <td style={{ padding: "0.5rem 0.75rem", color: "#f59e0b", fontSize: "0.75rem" }}>
                        {item.issues?.join(" · ") || item.error || ""}
                      </td>
                      <td style={{ padding: "0.5rem 0.75rem" }}>
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

          {items.some((it) => it.status === "review") && (
            <p style={{ marginTop: "1rem", fontSize: "0.78rem", color: "#f59e0b" }}>
              ⚠ Los marcados como "Revisar" deben importarse uno a uno desde la pestaña "Importar acta".
            </p>
          )}
        </>
      )}

      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
