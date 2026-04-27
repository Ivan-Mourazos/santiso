"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase-browser";
import BusyBanner from "./BusyBanner";
import { getCompetitionsByCategory } from "@/lib/competition";
import { fetchMatchdaysForCompetition, fetchSeasons, fetchTeamsForCompetition, type Team } from "@/lib/supabase-queries";
import type { JornadaGeminiResponse, JornadaMatchExtracted } from "@/app/api/admin/jornada-gemini/route";

interface Props {
  showToast: (msg: string, type?: "success" | "error") => void;
  showConfirm: (msg: string, onConfirm: () => void) => void;
}

type EquipoDB = Team;

interface JornadaDB {
  id: string;
  numero: number;
}

interface CampoDB {
  id: string;
  nombre: string;
  poblacion: string | null;
}

/** Fila editable en la tabla de revisión */
interface ReviewRow {
  key: string;
  extracted: JornadaMatchExtracted;
  /** ID del partido existente en BD si encontrado */
  matchId: string | null;
  localId: string;
  visitanteId: string;
  golesLocal: string;
  golesVisitante: string;
  fecha: string;
  campoId: string;
  /** Texto libre cuando no hay match en BD */
  campoNombre: string;
  campoPoblacion: string;
  selected: boolean;
}

const CATEGORIES = ["Senior", "Femenino", "Veteranos"];

function normalizeTeamName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenScore(a: string, b: string) {
  const ta = new Set(normalizeTeamName(a).split(" ").filter(Boolean));
  const tb = new Set(normalizeTeamName(b).split(" ").filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let hits = 0;
  for (const t of ta) if (tb.has(t)) hits++;
  return hits / Math.max(ta.size, tb.size);
}

function bestMatch(name: string, equipos: EquipoDB[]) {
  if (!name.trim()) return "";
  const sorted = equipos
    .map((e) => ({ e, score: tokenScore(name, e.nombre) }))
    .sort((a, b) => b.score - a.score);
  return sorted[0]?.score >= 0.4 ? sorted[0].e.id : "";
}

function bestCampo(nombre: string, poblacion: string, campos: CampoDB[]) {
  if (!nombre.trim()) return "";
  const sorted = campos
    .map((c) => ({
      c,
      score: Math.max(
        tokenScore(nombre, c.nombre),
        tokenScore(`${nombre} ${poblacion}`, `${c.nombre} ${c.poblacion || ""}`),
      ),
    }))
    .sort((a, b) => b.score - a.score);
  return sorted[0]?.score >= 0.5 ? sorted[0].c.id : "";
}

/** Convierte DD-MM-YYYY o DD/MM/YYYY → YYYY-MM-DD. Pasa ISO sin cambios. */
function normalizeFecha(raw: string): string {
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw; // ya es ISO
  const m = raw.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})(.*)$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}${m[4]}`;
  return raw;
}

export default function AdminJornadaImporter({ showToast, showConfirm }: Props) {
  const [categoria, setCategoria] = useState("Femenino");
  const [competicion, setCompeticion] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [equipos, setEquipos] = useState<EquipoDB[]>([]);
  const [jornadas, setJornadas] = useState<JornadaDB[]>([]);
  const [campos, setCampos] = useState<CampoDB[]>([]);
  const [selectedJornadaId, setSelectedJornadaId] = useState("");

  const [busy, setBusy] = useState(false);
  const [busyText, setBusyText] = useState("Cargando...");

  const [extracted, setExtracted] = useState<JornadaGeminiResponse | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [usedModel, setUsedModel] = useState("");

  const competitions = useMemo(
    () => getCompetitionsByCategory(categoria),
    [categoria],
  );

  useEffect(() => {
    setCompeticion(competitions[0] || "");
  }, [competitions]);

  useEffect(() => {
    fetchBaseData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoria, competicion]);

  async function fetchBaseData() {
    if (!competicion) return;
    setBusy(true);
    setBusyText("Cargando datos...");

    const { active } = await fetchSeasons();
    if (!active) { setBusy(false); return; }

    const [equiposData, jornadasResult, cRes] = await Promise.all([
      fetchTeamsForCompetition(categoria, competicion),
      fetchMatchdaysForCompetition(active.id, categoria, competicion),
      supabase
        .from("campos_futbol")
        .select("id, nombre, poblacion")
        .order("nombre"),
    ]);

    setEquipos(equiposData);
    setJornadas(jornadasResult.data);
    if (jornadasResult.data.length > 0) {
      setSelectedJornadaId((prev) =>
        jornadasResult.data.some((j) => j.id === prev)
          ? prev
          : jornadasResult.data[jornadasResult.data.length - 1].id,
      );
    }
    if (cRes.data) setCampos(cRes.data as CampoDB[]);

    setBusy(false);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null;
    setFile(f);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(f ? URL.createObjectURL(f) : null);
    setExtracted(null);
    setRows([]);
  }

  async function analyzeImage() {
    if (!file) { showToast("Selecciona una imagen primero", "error"); return; }

    setBusy(true);
    setBusyText("Analizando imagen con Gemini...");

    try {
      const fd = new FormData();
      fd.append("image", file);
      fd.append("equipos", JSON.stringify(equipos.map((e) => e.nombre)));

      const res = await fetch("/api/admin/jornada-gemini", {
        method: "POST",
        body: fd,
      });
      const payload = await res.json();

      if (!res.ok) {
        throw new Error(
          `${payload.error || "Error Gemini"}${payload.detail ? `: ${String(payload.detail).slice(0, 400)}` : ""}`,
        );
      }

      const data = payload.data as JornadaGeminiResponse;
      setExtracted(data);
      setUsedModel(payload.model || "");
      buildRows(data);
      showToast(`✓ Analizado con ${payload.model || "Gemini"}. Revisa antes de guardar.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error al analizar", "error");
    } finally {
      setBusy(false);
    }
  }

  function buildRows(data: JornadaGeminiResponse) {
    const newRows: ReviewRow[] = data.partidos.map((p, i) => {
      const localId = bestMatch(p.localNombre, equipos);
      const visitanteId = bestMatch(p.visitanteNombre, equipos);
      const campoId = bestCampo(p.campoNombre || "", p.campoPoblacion || "", campos);
      let fecha = normalizeFecha(p.fecha || "");
      if (fecha && p.hora) fecha = `${fecha}T${p.hora}`;

      return {
        key: `row-${i}`,
        extracted: p,
        matchId: null,
        localId,
        visitanteId,
        golesLocal: p.golesLocal,
        golesVisitante: p.golesVisitante,
        fecha,
        campoId,
        campoNombre: campoId ? "" : (p.campoNombre || ""),
        campoPoblacion: campoId ? "" : (p.campoPoblacion || ""),
        selected: !p.descansa && p.golesLocal !== "" && p.golesVisitante !== "",
      };
    });
    setRows(newRows);
  }

  function patchRow(index: number, patch: Partial<ReviewRow>) {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  async function saveSelected() {
    const toSave = rows.filter(
      (r) => r.selected && !r.extracted.descansa && r.localId && r.visitanteId,
    );

    if (!toSave.length) {
      showToast("No hay filas seleccionadas con datos válidos", "error");
      return;
    }
    if (!selectedJornadaId) {
      showToast("Selecciona una jornada de destino", "error");
      return;
    }

    setBusy(true);
    setBusyText("Guardando partidos en BD...");

    let ok = 0;
    let errors = 0;

    for (const row of toSave) {
      // Buscar si ya existe el partido (local + visitante + jornada)
      const { data: existing } = await supabase
        .from("partidos_liga")
        .select("id")
        .eq("jornada_id", selectedJornadaId)
        .eq("equipo_local_id", row.localId)
        .eq("equipo_visitante_id", row.visitanteId)
        .maybeSingle();

      // Resolver campo: usar existente o crear nuevo
      let resolvedCampoId = row.campoId || null;
      if (!resolvedCampoId && row.campoNombre.trim()) {
        // Buscar primero por nombre exacto (ilike)
        const { data: existing } = await supabase
          .from("campos_futbol")
          .select("id")
          .ilike("nombre", row.campoNombre.trim())
          .limit(1)
          .maybeSingle();
        if (existing?.id) {
          resolvedCampoId = existing.id;
          // Actualizar poblacion si la tenemos
          if (row.campoPoblacion.trim()) {
            await supabase
              .from("campos_futbol")
              .update({ poblacion: row.campoPoblacion.trim() })
              .eq("id", existing.id);
          }
        } else {
          const { data: inserted, error: campoErr } = await supabase
            .from("campos_futbol")
            .insert({ nombre: row.campoNombre.trim(), poblacion: row.campoPoblacion.trim() || null })
            .select("id")
            .single();
          if (campoErr) {
            console.error("Error creando campo:", campoErr.message);
          } else {
            resolvedCampoId = inserted.id;
          }
        }
      }

      const payload = {
        jornada_id: selectedJornadaId,
        categoria,
        competicion,
        equipo_local_id: row.localId,
        equipo_visitante_id: row.visitanteId,
        goles_local: row.golesLocal !== "" ? parseInt(row.golesLocal, 10) : null,
        goles_visitante:
          row.golesVisitante !== "" ? parseInt(row.golesVisitante, 10) : null,
        fecha: normalizeFecha(row.fecha) || null,
        campo_id: resolvedCampoId,
        estado: "finalizado",
      };

      let error;
      if (existing?.id) {
        ({ error } = await supabase
          .from("partidos_liga")
          .update(payload)
          .eq("id", existing.id));
      } else {
        ({ error } = await supabase.from("partidos_liga").insert([payload]));
      }

      if (error) {
        errors++;
        console.error("Supabase error:", error.message, error.details, error.hint);
      }
      else ok++;
    }

    setBusy(false);
    if (errors === 0) {
      showToast(`${ok} partido(s) guardados correctamente`);
      setExtracted(null);
      setRows([]);
      setFile(null);
      if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
    } else {
      showToast(`${ok} guardados, ${errors} errores. Revisa consola.`, "error");
    }
  }

  const selectedCount = rows.filter((r) => r.selected).length;

  return (
    <div className="card glass">
      <BusyBanner show={busy} text={busyText} />

      <div className="ji-header">
        <div>
          <h3>📸 Importar jornada desde imagen</h3>
          <p>
            Sube una captura de resultados RFGF/Futgal → Gemini extrae los datos →
            revisa y guarda los que quieras.
          </p>
        </div>
        {usedModel && (
          <span className="model-badge">⚡ {usedModel}</span>
        )}
      </div>

      {/* CONFIGURACIÓN */}
      <div className="ji-config">
        <div className="input-group">
          <label>Categoría</label>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="input-group">
          <label>Competición</label>
          <select value={competicion} onChange={(e) => setCompeticion(e.target.value)}>
            {competitions.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="input-group">
          <label>Jornada destino</label>
          <select
            value={selectedJornadaId}
            onChange={(e) => setSelectedJornadaId(e.target.value)}
          >
            <option value="">Selecciona jornada...</option>
            {jornadas.map((j) => (
              <option key={j.id} value={j.id}>
                Jornada {j.numero}
              </option>
            ))}
          </select>
        </div>

        <div className="input-group">
          <label>Imagen de jornada</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
          />
        </div>
      </div>

      {/* PREVIEW + ANALIZAR */}
      <div className="ji-analyze-row">
        {previewUrl && (
          <div className="ji-preview">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="Vista previa" />
          </div>
        )}
        <button
          className="btn-primary analyze-btn"
          onClick={analyzeImage}
          disabled={busy || !file}
        >
          🔍 Analizar con Gemini
        </button>
      </div>

      {/* TABLA DE REVISIÓN */}
      {rows.length > 0 && (
        <div className="ji-review">
          <div className="ji-review-header">
            <h4>
              Resultados detectados
              {extracted?.jornada && (
                <span className="jornada-badge">
                  Jornada {extracted.jornada}
                </span>
              )}
            </h4>
            <span className="sel-count">{selectedCount} seleccionado(s)</span>
          </div>

          {extracted?.warnings && extracted.warnings.length > 0 && (
            <div className="ji-warnings">
              {extracted.warnings.map((w, i) => <p key={i}>⚠ {w}</p>)}
            </div>
          )}

          <div className="ji-table-wrap">
            <table className="ji-table">
              <thead>
                <tr>
                  <th>✓</th>
                  <th>Local detectado</th>
                  <th>Local BD</th>
                  <th>Res.</th>
                  <th>Visitante BD</th>
                  <th>Visitante detectado</th>
                  <th>Fecha/Hora</th>
                  <th>Campo</th>
                  <th>Conf.</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr
                    key={row.key}
                    className={`ji-row ${row.extracted.descansa ? "descansa" : ""} ${row.selected ? "selected" : ""}`}
                  >
                    <td>
                      {!row.extracted.descansa && (
                        <input
                          type="checkbox"
                          checked={row.selected}
                          onChange={(e) => patchRow(idx, { selected: e.target.checked })}
                        />
                      )}
                      {row.extracted.descansa && <span className="tag-rest">DESCANSA</span>}
                    </td>

                    <td className="team-detected">{row.extracted.localNombre}</td>

                    <td>
                      {!row.extracted.descansa && (
                        <select
                          value={row.localId}
                          onChange={(e) => patchRow(idx, { localId: e.target.value })}
                          className={row.localId ? "ok" : "warn"}
                        >
                          <option value="">Sin enlazar...</option>
                          {equipos.map((e) => (
                            <option key={e.id} value={e.id}>{e.nombre}</option>
                          ))}
                        </select>
                      )}
                    </td>

                    <td>
                      {!row.extracted.descansa && (
                        <div className="score-inputs">
                          <input
                            type="number"
                            min="0"
                            value={row.golesLocal}
                            onChange={(e) => patchRow(idx, { golesLocal: e.target.value })}
                          />
                          <span>-</span>
                          <input
                            type="number"
                            min="0"
                            value={row.golesVisitante}
                            onChange={(e) => patchRow(idx, { golesVisitante: e.target.value })}
                          />
                        </div>
                      )}
                    </td>

                    <td>
                      {!row.extracted.descansa && (
                        <select
                          value={row.visitanteId}
                          onChange={(e) => patchRow(idx, { visitanteId: e.target.value })}
                          className={row.visitanteId ? "ok" : "warn"}
                        >
                          <option value="">Sin enlazar...</option>
                          {equipos.map((e) => (
                            <option key={e.id} value={e.id}>{e.nombre}</option>
                          ))}
                        </select>
                      )}
                    </td>

                    <td className="team-detected">{row.extracted.visitanteNombre}</td>

                    <td>
                      <input
                        type="text"
                        placeholder="YYYY-MM-DDTHH:MM"
                        value={row.fecha}
                        onChange={(e) => patchRow(idx, { fecha: e.target.value })}
                        className="fecha-input"
                      />
                    </td>

                    <td>
                      <div className="campo-cell">
                        <select
                          value={row.campoId}
                          onChange={(e) => {
                            const id = e.target.value;
                            const found = campos.find((c) => c.id === id);
                            patchRow(idx, {
                              campoId: id,
                              campoNombre: id ? "" : row.campoNombre,
                              campoPoblacion: id ? "" : row.campoPoblacion,
                            });
                            if (found) {
                              patchRow(idx, {
                                campoId: id,
                                campoNombre: "",
                                campoPoblacion: "",
                              });
                            }
                          }}
                        >
                          <option value="">✏️ Nombre libre...</option>
                          {campos.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nombre}{c.poblacion ? ` (${c.poblacion})` : ""}
                            </option>
                          ))}
                        </select>
                        {!row.campoId && (
                          <div className="campo-libre">
                            <input
                              type="text"
                              placeholder="Nombre campo"
                              value={row.campoNombre}
                              onChange={(e) => patchRow(idx, { campoNombre: e.target.value })}
                            />
                            <input
                              type="text"
                              placeholder="Localidad"
                              value={row.campoPoblacion}
                              onChange={(e) => patchRow(idx, { campoPoblacion: e.target.value })}
                            />
                          </div>
                        )}
                      </div>
                    </td>

                    <td>
                      <span className={`conf-badge conf-${row.extracted.confidence}`}>
                        {row.extracted.confidence}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            className="btn-primary save-btn"
            disabled={busy || selectedCount === 0 || !selectedJornadaId}
            onClick={() =>
              showConfirm(
                `¿Guardar ${selectedCount} partido(s) en BD? Los existentes se actualizarán.`,
                saveSelected,
              )
            }
          >
            💾 Guardar {selectedCount} partido(s) seleccionados
          </button>
        </div>
      )}

      <style jsx>{`
        .ji-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        .ji-header h3 { margin: 0; font-size: 1.2rem; }
        .ji-header p { color: #a3a3a3; margin: 0.3rem 0 0; font-size: 0.88rem; }

        .model-badge {
          background: rgba(250, 204, 21, 0.1);
          border: 1px solid rgba(250, 204, 21, 0.3);
          color: var(--primary);
          font-size: 0.72rem;
          font-weight: 800;
          padding: 0.3rem 0.8rem;
          border-radius: 100px;
          white-space: nowrap;
        }

        .ji-config {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .ji-analyze-row {
          display: flex;
          gap: 1.5rem;
          align-items: flex-start;
          margin-bottom: 1.5rem;
        }

        .ji-preview {
          flex: 1;
          max-height: 300px;
          overflow: hidden;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(0,0,0,0.3);
        }
        .ji-preview img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          max-height: 300px;
        }

        .analyze-btn, .save-btn { width: 100%; }

        .ji-review { margin-top: 2rem; }
        .ji-review-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1rem;
        }
        .ji-review-header h4 { margin: 0; display: flex; align-items: center; gap: 0.8rem; }
        .jornada-badge {
          background: rgba(250,204,21,0.15);
          color: var(--primary);
          font-size: 0.72rem;
          font-weight: 800;
          padding: 0.2rem 0.7rem;
          border-radius: 100px;
          border: 1px solid rgba(250,204,21,0.3);
        }
        .sel-count { color: #888; font-size: 0.85rem; margin-left: auto; }

        .ji-warnings {
          margin-bottom: 1rem;
          padding: 0.8rem 1rem;
          border-radius: 10px;
          border: 1px solid rgba(250,204,21,0.25);
          background: rgba(250,204,21,0.07);
          color: #facc15;
          font-size: 0.82rem;
        }
        .ji-warnings p { margin: 0.2rem 0; }

        .ji-table-wrap {
          overflow-x: auto;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.08);
          margin-bottom: 1.5rem;
        }

        .ji-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.82rem;
        }
        .ji-table th {
          background: rgba(255,255,255,0.04);
          color: #888;
          font-weight: 800;
          text-transform: uppercase;
          font-size: 0.72rem;
          letter-spacing: 0.5px;
          padding: 0.7rem 0.8rem;
          text-align: left;
          white-space: nowrap;
        }
        .ji-table td {
          padding: 0.55rem 0.8rem;
          border-top: 1px solid rgba(255,255,255,0.05);
          vertical-align: middle;
        }
        .ji-row.selected td { background: rgba(250,204,21,0.04); }
        .ji-row.descansa td { opacity: 0.5; }

        .team-detected { color: #a3a3a3; font-size: 0.78rem; max-width: 160px; }

        .score-inputs {
          display: flex;
          align-items: center;
          gap: 0.3rem;
        }
        .score-inputs input {
          width: 44px;
          text-align: center;
          padding: 0.3rem;
          border-radius: 6px;
          font-weight: 800;
          font-size: 1rem;
        }
        .score-inputs span { color: #666; }

        .fecha-input { width: 150px; font-size: 0.78rem; }

        .campo-cell { display: flex; flex-direction: column; gap: 0.4rem; min-width: 180px; }
        .campo-libre { display: flex; flex-direction: column; gap: 0.3rem; }
        .campo-libre input { font-size: 0.75rem; padding: 0.3rem 0.5rem; border-radius: 6px; }
        .tag-rest {
          font-size: 0.65rem;
          font-weight: 800;
          color: #a78bfa;
          background: rgba(139,92,246,0.12);
          border: 1px solid rgba(139,92,246,0.3);
          padding: 0.2rem 0.5rem;
          border-radius: 100px;
        }

        select.ok { border-color: rgba(34,197,94,0.4) !important; }
        select.warn { border-color: rgba(250,204,21,0.4) !important; }

        .conf-badge {
          font-size: 0.68rem;
          font-weight: 800;
          padding: 0.2rem 0.6rem;
          border-radius: 100px;
          text-transform: uppercase;
        }
        .conf-alta { background: rgba(34,197,94,0.15); color: #4ade80; border: 1px solid rgba(34,197,94,0.3); }
        .conf-media { background: rgba(250,204,21,0.12); color: #facc15; border: 1px solid rgba(250,204,21,0.3); }
        .conf-baja { background: rgba(239,68,68,0.12); color: #f87171; border: 1px solid rgba(239,68,68,0.3); }

        @media (max-width: 900px) {
          .ji-config { grid-template-columns: 1fr 1fr; }
          .ji-analyze-row { flex-direction: column; }
        }
        @media (max-width: 600px) {
          .ji-config { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
