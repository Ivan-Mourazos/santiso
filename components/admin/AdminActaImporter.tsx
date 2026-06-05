"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase-browser";
import BusyBanner from "./BusyBanner";
import {
  competitionsForCategory,
  pickDefaultCompetitionId,
  type CompetenciaRow,
} from "@/lib/competition";
import { fetchCompeticiones, fetchSeasons } from "@/lib/supabase-queries";
import { parseFutgalActaText } from "@/lib/actas/futgal-parser";
import { saveReviewedActa } from "@/lib/actas/save-acta";
import type {
  ActaCampoDb,
  ActaCategoria,
  ActaEvent,
  ActaEventType,
  ActaMatchDb,
  ActaPlayerDb,
  ActaPlayerRef,
  ParsedActa,
} from "@/lib/actas/types";

interface AdminActaImporterProps {
  showToast: (msg: string, type?: "success" | "error") => void;
  showConfirm: (msg: string, onConfirm: () => void) => void;
}

const CATEGORIES: ActaCategoria[] = ["Senior", "Femenino", "Veteranos"];

interface DetectedActaMeta {
  jornada: number;
  localTeam: string;
  visitorTeam: string;
  categoria: string;
  competicion: string;
  fecha: string;
}

function displayPlayer(player: ActaPlayerDb) {
  if (player.apodo?.trim()) return player.apodo.trim();
  const parts = player.nombre.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[1]}` : player.nombre;
}

function emptyActa(): ParsedActa {
  return {
    campoId: undefined,
    marcadorLocal: "0",
    marcadorVisitante: "0",
    campoNombre: "",
    campoPoblacion: "",
    titulares: [],
    suplentes: [],
    eventos: [],
    warnings: [],
    rawText: "",
  };
}

function normalizeForMatch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenScore(left: string, right: string) {
  const leftTokens = new Set(normalizeForMatch(left).split(" ").filter(Boolean));
  const rightTokens = new Set(normalizeForMatch(right).split(" ").filter(Boolean));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

  let hits = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) hits += 1;
  }
  return hits / Math.max(leftTokens.size, rightTokens.size);
}

function resolvePlayerRef(
  player: ActaPlayerRef,
  jugadoresByDorsal: Map<string, ActaPlayerDb>,
  jugadores: ActaPlayerDb[],
): ActaPlayerRef {
  const byDorsal = jugadoresByDorsal.get(player.dorsal);
  const byName = jugadores
    .map((dbPlayer) => ({
      dbPlayer,
      score: Math.max(
        tokenScore(player.rawName, dbPlayer.nombre),
        tokenScore(player.rawName, dbPlayer.apodo || ""),
      ),
    }))
    .sort((a, b) => b.score - a.score)[0];
  const dbPlayer = byDorsal || (byName?.score >= 0.5 ? byName.dbPlayer : null);
  if (!dbPlayer) return player;

  return {
    ...player,
    jugadorId: dbPlayer.id,
    displayName: displayPlayer(dbPlayer),
  };
}

function resolveParsedActa(acta: ParsedActa, jugadores: ActaPlayerDb[]) {
  const jugadoresByDorsal = new Map(
    jugadores
      .filter((player) => player.dorsal !== null)
      .map((player) => [String(player.dorsal), player]),
  );

  const resolve = (player?: ActaPlayerRef) =>
    player ? resolvePlayerRef(player, jugadoresByDorsal, jugadores) : undefined;

  return {
    ...acta,
    titulares: acta.titulares.map((player) =>
      resolvePlayerRef(player, jugadoresByDorsal, jugadores),
    ),
    suplentes: acta.suplentes.map((player) =>
      resolvePlayerRef(player, jugadoresByDorsal, jugadores),
    ),
    eventos: acta.eventos.map((event) => ({
      ...event,
      jugador: resolve(event.jugador),
      jugadorSale: resolve(event.jugadorSale),
      jugadorEntra: resolve(event.jugadorEntra),
    })),
  };
}

function resolveCampo(acta: ParsedActa, campos: ActaCampoDb[]) {
  if (acta.campoId || !acta.campoNombre.trim()) return acta;

  const best = campos
    .map((campo) => ({
      campo,
      score: Math.max(
        tokenScore(acta.campoNombre, campo.nombre),
        tokenScore(`${acta.campoNombre} ${acta.campoPoblacion}`, `${campo.nombre} ${campo.poblacion || ""}`),
      ),
    }))
    .sort((a, b) => b.score - a.score)[0];

  if (!best || best.score < 0.55) return acta;

  return {
    ...acta,
    campoId: best.campo.id,
    campoNombre: best.campo.nombre,
    campoPoblacion: best.campo.poblacion || acta.campoPoblacion,
  };
}

async function preprocessImage(file: File) {
  if (file.type === "application/pdf") return file;
  const imageUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = imageUrl;
    });

    const scale = Math.max(1, Math.min(2.5, 1800 / image.width));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return file;

    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      const boosted = gray > 175 ? 255 : gray < 90 ? 0 : gray * 0.75;
      data[i] = boosted;
      data[i + 1] = boosted;
      data[i + 2] = boosted;
    }

    ctx.putImageData(imageData, 0, 0);

    return await new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => resolve(blob || file), "image/png");
    });
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

function isSantisoLocal(match?: ActaMatchDb | null) {
  return Boolean(match?.equipo_local?.nombre?.toLowerCase().includes("santiso"));
}

function matchLabel(match: ActaMatchDb) {
  return `J${match.jornada?.numero || "?"} - ${match.equipo_local?.nombre || "Local"} vs ${match.equipo_visitante?.nombre || "Visitante"}`;
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
    confidence: "baja",
  };
}

function readableGeminiError(payload: { error?: string; detail?: unknown }) {
  const detail =
    typeof payload.detail === "string"
      ? payload.detail
      : payload.detail
        ? JSON.stringify(payload.detail)
        : "";
  if (!detail) return payload.error || "Gemini no pudo analizar el acta.";
  return `${payload.error || "Gemini no pudo analizar el acta."}: ${detail.slice(0, 700)}`;
}

export default function AdminActaImporter({
  showToast,
  showConfirm,
}: AdminActaImporterProps) {
  const [categoria, setCategoria] = useState<ActaCategoria>("Veteranos");
  const [competicionesCatalog, setCompeticionesCatalog] = useState<
    CompetenciaRow[]
  >([]);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState("");
  const [matches, setMatches] = useState<ActaMatchDb[]>([]);
  const [jugadores, setJugadores] = useState<ActaPlayerDb[]>([]);
  const [campos, setCampos] = useState<ActaCampoDb[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [acta, setActa] = useState<ParsedActa>(() => emptyActa());
  const [busy, setBusy] = useState(false);
  const [busyText, setBusyText] = useState("Cargando datos...");
  const [progress, setProgress] = useState<number | undefined>(undefined);
  const [detectedMeta, setDetectedMeta] = useState<DetectedActaMeta | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);

  const selectedMatch = matches.find((match) => match.id === selectedMatchId);
  const santisoLocal = isSantisoLocal(selectedMatch);

  const competitionsInCategory = useMemo(
    () => competitionsForCategory(competicionesCatalog, categoria),
    [competicionesCatalog, categoria],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await fetchCompeticiones();
      if (!cancelled) setCompeticionesCatalog(list);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (competicionesCatalog.length === 0) return;
    const def = pickDefaultCompetitionId(competicionesCatalog, categoria);
    setSelectedCompetitionId((prev) => {
      const opts = competitionsForCategory(competicionesCatalog, categoria);
      if (prev && opts.some((o) => o.id === prev)) return prev;
      return def;
    });
  }, [categoria, competicionesCatalog]);

  useEffect(() => {
    if (!selectedCompetitionId) return;
    fetchBaseData();
  }, [categoria, selectedCompetitionId]);

  useEffect(() => {
    if (!detectedMeta || !matches.length) return;
    const found = matches.find(
      (m) => String(m.jornada?.numero) === String(detectedMeta.jornada),
    );
    if (found) setSelectedMatchId(found.id);
  }, [matches, detectedMeta]);

  async function fetchBaseData() {
    setBusy(true);
    setBusyText("Cargando partidos y plantilla...");
    const { active } = await fetchSeasons();

    const [playersResult, matchesResult, camposResult] = await Promise.all([
      supabase
        .from("jugadores")
        .select("id, dorsal, nombre, apodo, categoria")
        .eq("categoria", categoria)
        .order("dorsal", { ascending: true }),
      supabase
        .from("partidos_liga")
        .select(
          "id, categoria, competicion, competicion_id, estado, fecha, goles_local, goles_visitante, campo_id, equipo_local_id, equipo_visitante_id, equipo_local:equipo_local_id(nombre), equipo_visitante:equipo_visitante_id(nombre), jornada:jornada_id(numero, competicion, competicion_id, temporada_id), campo:campo_id(nombre, poblacion)",
        )
        .eq("categoria", categoria)
        .order("fecha", { ascending: false }),
      supabase
        .from("campos_futbol")
        .select("id, nombre, poblacion")
        .order("nombre", { ascending: true }),
    ]);

    if (playersResult.data) setJugadores(playersResult.data as ActaPlayerDb[]);
    if (camposResult.data) setCampos(camposResult.data as ActaCampoDb[]);

    if (matchesResult.data) {
      const data = (matchesResult.data as ActaMatchDb[]).filter((match) => {
        const local = match.equipo_local?.nombre?.toLowerCase() || "";
        const visitante = match.equipo_visitante?.nombre?.toLowerCase() || "";
        const isSantiso = local.includes("santiso") || visitante.includes("santiso");
        const sameSeason = active?.id ? match.jornada?.temporada_id === active.id : true;
        const sameCompetition =
          !selectedCompetitionId ||
          match.competicion_id === selectedCompetitionId ||
          match.jornada?.competicion_id === selectedCompetitionId ||
          match.jornada?.competicion_id === null;
        return isSantiso && sameSeason && sameCompetition;
      });
      setMatches(data);
      setSelectedMatchId((current) =>
        data.some((match) => match.id === current) ? current : data[0]?.id || "",
      );
    }

    setBusy(false);
  }

  async function detectMatch(f: File) {
    setIsDetecting(true);
    setDetectedMeta(null);
    try {
      const formData = new FormData();
      formData.append("image", f);
      const res = await fetch("/api/admin/acta-detect", { method: "POST", body: formData });
      if (!res.ok) return;
      const data = (await res.json()) as DetectedActaMeta;
      if (!data.jornada) return;
      setDetectedMeta(data);
      if (data.categoria && CATEGORIES.includes(data.categoria as ActaCategoria)) {
        setCategoria(data.categoria as ActaCategoria);
      }
    } catch {
      // silent — user selects manually
    } finally {
      setIsDetecting(false);
    }
  }

  async function analyzeImage() {
    if (!file || !selectedMatch) {
      showToast("Selecciona partido y captura antes de analizar.", "error");
      return;
    }

    setBusy(true);
    setProgress(undefined);
    setBusyText("Analizando acta con Gemini...");

    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("match", JSON.stringify(selectedMatch));
      formData.append("jugadores", JSON.stringify(jugadores));
      formData.append("campos", JSON.stringify(campos));

      const response = await fetch("/api/admin/acta-gemini", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(readableGeminiError(payload));
      }

      const parsed = payload.acta as ParsedActa;
      setOcrText(JSON.stringify(payload.raw || parsed, null, 2));
      setActa(resolveCampo(resolveParsedActa(parsed, jugadores), campos));
      showToast("Acta analizada con Gemini. Revisa antes de insertar.");
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Error con Gemini";
      showToast(message, "error");
    } finally {
      setBusy(false);
      setProgress(undefined);
    }
  }

  async function analyzeWithLocalOcr() {
    if (!file || !selectedMatch) {
      showToast("Selecciona partido y captura antes de analizar.", "error");
      return;
    }

    setBusy(true);
    setProgress(0);
    setBusyText("Leyendo captura con OCR local...");

    try {
      const Tesseract = (await import("tesseract.js")).default;
      const imageForOcr = await preprocessImage(file);
      const result = await Tesseract.recognize(imageForOcr, "spa", {
        logger: (message) => {
          if (message.status === "recognizing text") {
            setProgress(Math.round(message.progress * 100));
          }
        },
      });
      const text = result.data.text;
      setOcrText(text);
      const parsed = parseFutgalActaText(text, santisoLocal);
      setActa(resolveCampo(resolveParsedActa(parsed, jugadores), campos));
      showToast("Acta analizada. Revisa antes de insertar.");
    } catch (error) {
      console.error(error);
      showToast("No se pudo leer la captura con OCR.", "error");
    } finally {
      setBusy(false);
      setProgress(undefined);
    }
  }

  function reparseText() {
    if (!selectedMatch) return;
    const parsed = parseFutgalActaText(ocrText, santisoLocal);
    setActa(resolveCampo(resolveParsedActa(parsed, jugadores), campos));
  }

  function selectCampo(campoId: string) {
    if (!campoId) {
      setActa((current) => ({ ...current, campoId: undefined }));
      return;
    }

    const campo = campos.find((item) => item.id === campoId);
    if (!campo) return;
    setActa((current) => ({
      ...current,
      campoId: campo.id,
      campoNombre: campo.nombre,
      campoPoblacion: campo.poblacion || "",
    }));
  }

  function setPlayerFromDb(
    section: "titulares" | "suplentes",
    index: number,
    playerId: string,
  ) {
    const dbPlayer = jugadores.find((player) => player.id === playerId);
    if (!dbPlayer) return;

    setActa((current) => {
      const next = [...current[section]];
      next[index] = makePlayerRefFromDb(dbPlayer);
      return { ...current, [section]: next };
    });
  }

  function updateEvent(index: number, patch: Partial<ActaEvent>) {
    setActa((current) => {
      const eventos = [...current.eventos];
      eventos[index] = { ...eventos[index], ...patch };
      return { ...current, eventos };
    });
  }

  function setEventPlayer(
    index: number,
    key: "jugador" | "jugadorSale" | "jugadorEntra",
    playerId: string,
  ) {
    const dbPlayer = jugadores.find((player) => player.id === playerId);
    updateEvent(index, { [key]: dbPlayer ? makePlayerRefFromDb(dbPlayer) : undefined });
  }

  function addLineupPlayer(section: "titulares" | "suplentes") {
    setActa((current) => ({
      ...current,
      [section]: [
        ...current[section],
        { id: crypto.randomUUID(), dorsal: "", rawName: "" },
      ],
    }));
  }

  function removeLineupPlayer(section: "titulares" | "suplentes", index: number) {
    setActa((current) => ({
      ...current,
      [section]: current[section].filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  function addEvent() {
    setActa((current) => ({ ...current, eventos: [...current.eventos, makeEvent()] }));
  }

  function removeEvent(index: number) {
    setActa((current) => ({
      ...current,
      eventos: current.eventos.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  const unresolvedLineup = [...acta.titulares, ...acta.suplentes].filter(
    (player) => !player.jugadorId,
  );
  const unresolvedEvents = acta.eventos.filter((event) => {
    if (event.esPropiaSantiso) return !event.jugador?.jugadorId; // requiere jugador Santiso
    if (event.isRival) return !event.nombreRival?.trim();
    if (event.esPropia) return false; // propia del rival — sin jugador Santiso requerido
    if (event.tipo === "cambio") {
      return !event.jugadorSale?.jugadorId || !event.jugadorEntra?.jugadorId;
    }
    return !event.jugador?.jugadorId;
  });
  const canSave = Boolean(selectedMatchId) && unresolvedLineup.length === 0 && unresolvedEvents.length === 0;

  async function saveActa() {
    if (!selectedMatchId || !canSave) return;

    setBusy(true);
    setBusyText("Insertando datos revisados...");
    try {
      await saveReviewedActa({ supabase, partidoId: selectedMatchId, acta });
      showToast("Acta insertada correctamente");
      await fetchBaseData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      showToast(message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card glass">
      <BusyBanner show={busy} text={busyText} progress={progress} />

      <div className="acta-header">
        <div>
          <h3>Importar acta con OCR</h3>
          <p>
            Sube una captura, revisa datos detectados y confirma. No modifica
            nombres ni motes de jugadores.
          </p>
        </div>
      </div>

      <div className="acta-grid">
        <div className="input-group">
          <label>Categoría</label>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value as ActaCategoria)}>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div className="input-group">
          <label>Competición</label>
          <select value={selectedCompetitionId} onChange={(e) => setSelectedCompetitionId(e.target.value)}>
            {competitionsInCategory.map((item) => (
              <option key={item.id} value={item.id}>{item.nombre}</option>
            ))}
          </select>
        </div>

        <div className="input-group wide">
          <label>Partido</label>
          <select value={selectedMatchId} onChange={(e) => setSelectedMatchId(e.target.value)}>
            <option value="">Selecciona partido...</option>
            {matches.map((match) => (
              <option key={match.id} value={match.id}>
                {matchLabel(match)}
              </option>
            ))}
          </select>
        </div>

        <div className="input-group wide">
          <label>Captura del acta</label>
          <label
            htmlFor="acta-file-input"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) { setFile(f); detectMatch(f); }
            }}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              padding: "1.5rem",
              border: file ? "2px solid rgba(250,204,21,0.4)" : "2px dashed rgba(255,255,255,0.12)",
              borderRadius: "12px",
              background: file ? "rgba(250,204,21,0.04)" : "rgba(255,255,255,0.02)",
              cursor: "pointer",
              transition: "all 0.2s",
              textAlign: "center",
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.5 }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <span style={{ fontSize: "0.85rem", color: file ? "#facc15" : "#666", fontWeight: 600 }}>
              {file ? file.name : "Arrastra la captura aquí o haz clic"}
            </span>
            {file && (
              <span style={{ fontSize: "0.72rem", color: "#555" }}>
                {(file.size / 1024).toFixed(0)} KB
              </span>
            )}
            <input
              id="acta-file-input"
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                setFile(f);
                if (f) detectMatch(f);
                else setDetectedMeta(null);
              }}
              style={{ display: "none" }}
            />
          </label>
          {isDetecting && (
            <p style={{ fontSize: "0.78rem", color: "#888", margin: "0.4rem 0 0" }}>
              Detectando partido...
            </p>
          )}
          {!isDetecting && detectedMeta && (
            <p style={{
              fontSize: "0.78rem",
              margin: "0.4rem 0 0",
              color: selectedMatchId ? "#4ade80" : "#f59e0b",
            }}>
              {selectedMatchId
                ? `✓ J${detectedMeta.jornada} · ${detectedMeta.localTeam} vs ${detectedMeta.visitorTeam}`
                : `⚠ J${detectedMeta.jornada} detectada — selecciona partido manualmente`}
            </p>
          )}
        </div>
      </div>

      <div className="analyze-actions">
        <button className="btn-primary analyze-btn" onClick={analyzeImage} disabled={busy || !file || !selectedMatchId}>
          Analizar con Gemini
        </button>
      </div>
      <div style={{ textAlign: "center", marginTop: "0.5rem" }}>
        <button
          onClick={analyzeWithLocalOcr}
          disabled={busy || !file || !selectedMatchId || file.type === "application/pdf"}
          style={{
            background: "none",
            border: "none",
            color: busy || !file || !selectedMatchId || file.type === "application/pdf" ? "#333" : "#555",
            fontSize: "0.78rem",
            cursor: busy || !file || !selectedMatchId || file.type === "application/pdf" ? "not-allowed" : "pointer",
            textDecoration: "underline",
            padding: "0.3rem 0.5rem",
          }}
        >
          Usar OCR local (fallback)
        </button>
      </div>

      {acta.rawText && (
        <div className="review-wrapper">
          <div className="review-col">
            <section className="review-card">
              <h4>Datos del partido</h4>
              <div className="mini-grid">
                <label>
                  Goles local
                  <input
                    value={acta.marcadorLocal}
                    onChange={(e) => setActa((current) => ({ ...current, marcadorLocal: e.target.value }))}
                  />
                </label>
                <label>
                  Goles visitante
                  <input
                    value={acta.marcadorVisitante}
                    onChange={(e) => setActa((current) => ({ ...current, marcadorVisitante: e.target.value }))}
                  />
                </label>
                <label>
                  Campo
                  <select
                    value={acta.campoId || ""}
                    onChange={(e) => selectCampo(e.target.value)}
                  >
                    <option value="">Crear nuevo / texto detectado</option>
                    {campos.map((campo) => (
                      <option key={campo.id} value={campo.id}>
                        {campo.nombre}{campo.poblacion ? ` (${campo.poblacion})` : ""}
                      </option>
                    ))}
                  </select>
                  <input
                    value={acta.campoNombre}
                    disabled={Boolean(acta.campoId)}
                    onChange={(e) => setActa((current) => ({ ...current, campoNombre: e.target.value }))}
                  />
                </label>
                <label>
                  Población
                  <input
                    value={acta.campoPoblacion}
                    disabled={Boolean(acta.campoId)}
                    onChange={(e) => setActa((current) => ({ ...current, campoPoblacion: e.target.value }))}
                  />
                </label>
              </div>
            </section>

            <section className="review-card">
              <h4>Suplentes</h4>
              <LineupEditor
                players={acta.suplentes}
                jugadores={jugadores}
                onChange={(index, playerId) => setPlayerFromDb("suplentes", index, playerId)}
                onRemove={(index) => removeLineupPlayer("suplentes", index)}
              />
              <button className="btn-secondary" onClick={() => addLineupPlayer("suplentes")}>Añadir suplente</button>
            </section>
          </div>

          <div className="review-col">
            <section className="review-card">
              <h4>Titulares</h4>
              <LineupEditor
                players={acta.titulares}
                jugadores={jugadores}
                onChange={(index, playerId) => setPlayerFromDb("titulares", index, playerId)}
                onRemove={(index) => removeLineupPlayer("titulares", index)}
              />
              <button className="btn-secondary" onClick={() => addLineupPlayer("titulares")}>Añadir titular</button>
            </section>
          </div>

          <section className="review-card wide-review">
            <div className="card-title-row">
              <h4>Eventos</h4>
              <button className="btn-secondary" onClick={addEvent}>Añadir evento</button>
            </div>
            <EventEditor
              eventos={acta.eventos}
              jugadores={jugadores}
              onUpdate={updateEvent}
              onSetPlayer={setEventPlayer}
              onRemove={removeEvent}
            />
          </section>

          <section className="review-card wide-review">
            <div className="card-title-row">
              <h4>Texto OCR</h4>
              <button className="btn-secondary" onClick={reparseText}>Reprocesar texto</button>
            </div>
            <textarea value={ocrText} onChange={(e) => setOcrText(e.target.value)} rows={8} />
          </section>
        </div>
      )}

      {(acta.warnings.length > 0 || unresolvedLineup.length > 0 || unresolvedEvents.length > 0) && (
        <div className="warnings">
          {[...acta.warnings, `${unresolvedLineup.length} jugadores sin enlazar`, `${unresolvedEvents.length} eventos sin resolver`]
            .filter((warning) => !warning.startsWith("0 "))
            .map((warning, idx) => <p key={`${warning}-${idx}`}>{warning}</p>)}
        </div>
      )}

      {acta.rawText && (
        <button
          className="btn-primary save-btn"
          disabled={!canSave || busy}
          onClick={() => showConfirm("Se borrarán e insertarán de nuevo los datos de este partido. ¿Continuar?", saveActa)}
        >
          Confirmar e insertar en BD
        </button>
      )}

      <style jsx>{`
        .acta-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .acta-header h3 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 600;
          color: #facc15;
        }
        .acta-header p {
          color: #a1a1aa;
          margin: 0.5rem 0 0;
          font-size: 0.85rem;
        }
        .acta-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1.25rem;
        }
        .wide {
          grid-column: span 2;
        }
        .input-group label {
          display: block;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #a1a1aa;
          margin-bottom: 0.5rem;
        }
        .input-group select, .input-group input {
          width: 100%;
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 0.75rem;
          color: #fff;
          font-size: 0.9rem;
          transition: border-color 0.2s;
        }
        .input-group select:focus, .input-group input:focus {
          outline: none;
          border-color: rgba(250, 204, 21, 0.5);
        }
        .analyze-actions {
          margin-top: 1.5rem;
        }
        .review-wrapper {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1.25rem;
          margin-top: 2.5rem;
          align-items: start;
        }
        .review-col {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }
        .review-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          padding: 1.25rem;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        }
        .review-card h4 {
          margin: 0 0 1rem 0;
          font-size: 0.9rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #facc15;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          padding-bottom: 0.5rem;
        }
        .wide-review {
          grid-column: span 2;
        }
        .mini-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1rem;
        }
        .mini-grid label {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          color: #a1a1aa;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
        }
        .mini-grid input, .mini-grid select {
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          padding: 0.6rem;
          color: #fff;
          font-size: 0.85rem;
          transition: border-color 0.2s;
        }
        .mini-grid input:focus, .mini-grid select:focus {
          outline: none;
          border-color: rgba(250, 204, 21, 0.4);
        }
        .card-title-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          padding-bottom: 0.5rem;
        }
        .card-title-row h4 {
          border-bottom: none;
          margin: 0;
          padding: 0;
        }
        textarea {
          width: 100%;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: #d4d4d8;
          padding: 1rem;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 0.8rem;
          resize: vertical;
          line-height: 1.5;
        }
        textarea:focus {
          outline: none;
          border-color: rgba(250, 204, 21, 0.4);
        }
        .warnings {
          margin-top: 1.5rem;
          padding: 1rem;
          border-radius: 8px;
          border-left: 4px solid #facc15;
          background: rgba(250, 204, 21, 0.1);
          color: #fef08a;
          font-size: 0.85rem;
        }
        .warnings p {
          margin: 0.3rem 0;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .warnings p::before {
          content: "•";
        }
        @media (max-width: 780px) {
          .acta-grid, .review-wrapper, .mini-grid { grid-template-columns: 1fr; }
          .wide, .wide-review { grid-column: auto; }
        }
      `}</style>
    </div>
  );
}

function LineupEditor({
  players,
  jugadores,
  onChange,
  onRemove,
}: {
  players: ActaPlayerRef[];
  jugadores: ActaPlayerDb[];
  onChange: (index: number, playerId: string) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="rows">
      {players.map((player, index) => (
        <div key={player.id} className="editor-row">
          <span className={player.jugadorId ? "status ok" : "status"}>{player.dorsal || "?"}</span>
          <span className="ocr-name">{player.rawName || "Sin texto OCR"}</span>
          <select value={player.jugadorId || ""} onChange={(e) => onChange(index, e.target.value)}>
            <option value="">Sin enlazar...</option>
            {jugadores.map((dbPlayer) => (
              <option key={dbPlayer.id} value={dbPlayer.id}>
                {dbPlayer.dorsal ?? "?"} - {displayPlayer(dbPlayer)}
              </option>
            ))}
          </select>
          <button className="row-delete" onClick={() => onRemove(index)}>Quitar</button>
        </div>
      ))}
      <style jsx>{`
        .rows {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }
        .editor-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.5rem;
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 8px;
          transition: background 0.2s;
        }
        .editor-row:hover {
          background: rgba(255, 255, 255, 0.03);
        }
        .ocr-name {
          flex: 1;
          color: #d4d4d8;
          font-size: 0.8rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .editor-row select {
          flex: 1.2;
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          color: #fff;
          font-size: 0.8rem;
          padding: 0.4rem;
        }
        .editor-row select:focus {
          outline: none;
          border-color: rgba(250, 204, 21, 0.4);
        }
        .status {
          width: 30px;
          height: 30px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          font-weight: 700;
          font-size: 0.8rem;
        }
        .status.ok {
          background: rgba(34, 197, 94, 0.15);
          color: #4ade80;
        }
        .row-delete {
          background: transparent;
          color: #a1a1aa;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          padding: 0.4rem 0.6rem;
          font-size: 0.75rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        .row-delete:hover {
          color: #ef4444;
          border-color: rgba(239, 68, 68, 0.3);
          background: rgba(239, 68, 68, 0.05);
        }
      `}</style>
    </div>
  );
}

function EventEditor({
  eventos,
  jugadores,
  onUpdate,
  onSetPlayer,
  onRemove,
}: {
  eventos: ActaEvent[];
  jugadores: ActaPlayerDb[];
  onUpdate: (index: number, patch: Partial<ActaEvent>) => void;
  onSetPlayer: (
    index: number,
    key: "jugador" | "jugadorSale" | "jugadorEntra",
    playerId: string,
  ) => void;
  onRemove: (index: number) => void;
}) {
  const typeOptions: ActaEventType[] = [
    "gol",
    "tarjeta_amarilla",
    "tarjeta_roja",
    "cambio",
  ];

  return (
    <div className="event-list">
      {eventos.map((event, index) => (
        <div key={event.id} className="event-card">
          <div className="event-card-header">
            <div className="event-meta">
              <input
                value={event.minuto}
                onChange={(e) => onUpdate(index, { minuto: e.target.value })}
                placeholder="Min."
                className="minuto-input"
              />
              <select 
                value={event.tipo} 
                onChange={(e) => onUpdate(index, { tipo: e.target.value as ActaEventType })}
                className="tipo-select"
              >
                {typeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
            
            <div className="event-actions">
              <select
                value={event.isRival ? (event.esPropiaSantiso ? "propia_santiso" : "rival") : event.esPropia ? "propia_rival" : "santiso"}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "rival") onUpdate(index, { isRival: true, esPropia: false, esPropiaSantiso: false });
                  else if (v === "propia_rival") onUpdate(index, { isRival: false, esPropia: true, esPropiaSantiso: false, jugador: undefined });
                  else if (v === "propia_santiso") onUpdate(index, { isRival: true, esPropia: false, esPropiaSantiso: true });
                  else onUpdate(index, { isRival: false, esPropia: false, esPropiaSantiso: false });
                }}
                className="equipo-select"
              >
                <option value="santiso">Santiso</option>
                <option value="rival">Rival</option>
                {event.tipo === "gol" && <option value="propia_rival">En propia (rival)</option>}
                {event.tipo === "gol" && <option value="propia_santiso">En propia (Santiso)</option>}
              </select>
              <button className="row-delete" onClick={() => onRemove(index)}>Quitar</button>
            </div>
          </div>

          <div className="event-card-body">
            {event.esPropiaSantiso ? (
              <PlayerSelect
                jugadores={jugadores}
                value={event.jugador?.jugadorId || ""}
                label="Jugador Santiso que marcó en propia..."
                onChange={(playerId) => onSetPlayer(index, "jugador", playerId)}
              />
            ) : event.isRival ? (
              <input
                value={event.nombreRival || ""}
                onChange={(e) => onUpdate(index, { nombreRival: e.target.value })}
                placeholder="Nombre jugador rival"
                className="rival-input"
              />
            ) : event.esPropia ? (
              <input
                value={event.nombreRival || ""}
                onChange={(e) => onUpdate(index, { nombreRival: e.target.value })}
                placeholder="Nombre del jugador rival (opcional)"
                className="rival-input"
              />
            ) : event.tipo === "cambio" ? (
              <div className="cambio-grid">
                <PlayerSelect
                  jugadores={jugadores}
                  value={event.jugadorSale?.jugadorId || ""}
                  label="Sale del campo..."
                  onChange={(playerId) => onSetPlayer(index, "jugadorSale", playerId)}
                />
                <PlayerSelect
                  jugadores={jugadores}
                  value={event.jugadorEntra?.jugadorId || ""}
                  label="Entra al campo..."
                  onChange={(playerId) => onSetPlayer(index, "jugadorEntra", playerId)}
                />
              </div>
            ) : (
              <PlayerSelect
                jugadores={jugadores}
                value={event.jugador?.jugadorId || ""}
                label="Selecciona jugador implicado..."
                onChange={(playerId) => onSetPlayer(index, "jugador", playerId)}
              />
            )}
          </div>
        </div>
      ))}
      <style jsx>{`
        .event-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .event-card {
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 8px;
          padding: 1rem;
          transition: background 0.2s;
        }
        .event-card:hover {
          background: rgba(255, 255, 255, 0.03);
        }
        .event-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          gap: 1rem;
        }
        .event-meta, .event-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .event-card select, .event-card input {
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          color: #fff;
          font-size: 0.8rem;
          padding: 0.4rem;
        }
        .event-card select:focus, .event-card input:focus {
          outline: none;
          border-color: rgba(250, 204, 21, 0.4);
        }
        .minuto-input {
          width: 50px;
          text-align: center;
          font-weight: 700;
        }
        .tipo-select {
          min-width: 130px;
        }
        .equipo-select {
          min-width: 110px;
        }
        .cambio-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
        }
        .rival-input {
          width: 100%;
        }
        .row-delete {
          background: transparent;
          color: #a1a1aa;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          padding: 0.4rem 0.6rem;
          font-size: 0.75rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        .row-delete:hover {
          color: #ef4444;
          border-color: rgba(239, 68, 68, 0.3);
          background: rgba(239, 68, 68, 0.05);
        }
        @media (max-width: 640px) {
          .event-card-header {
            flex-direction: column;
            align-items: stretch;
          }
          .event-meta, .event-actions {
            justify-content: space-between;
          }
          .cambio-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

function PlayerSelect({
  jugadores,
  value,
  label,
  onChange,
}: {
  jugadores: ActaPlayerDb[];
  value: string;
  label: string;
  onChange: (playerId: string) => void;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{label}</option>
      {jugadores.map((player) => (
        <option key={player.id} value={player.id}>
          {player.dorsal ?? "?"} - {displayPlayer(player)}
        </option>
      ))}
    </select>
  );
}
