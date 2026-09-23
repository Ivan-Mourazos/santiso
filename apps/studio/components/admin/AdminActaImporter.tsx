"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { cargarPantallaActa, guardarActa } from "@/lib/server/acciones/actas";
import { Button } from "@/components/ui/foundation/Button";
import { Field, Select, Textarea } from "@/components/ui/foundation/Fields";
import { PageHeader } from "@/components/ui/foundation/PageHeader";
import { EmptyState, LoadingState } from "@/components/ui/foundation/States";
import styles from "./actas/ActaImporter.module.css";
import {
  competitionsForCategory,
  pickDefaultCompetitionId,
  type CompetenciaRow,
} from "@/lib/competition";
import { fetchCompeticiones } from "@/lib/lecturas-cliente";
import { parseFutgalActaText } from "@/lib/actas/futgal-parser";
import { leerFichaPdf } from "@/lib/server/acciones/fichas";
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
        tokenScore(
          `${acta.campoNombre} ${acta.campoPoblacion}`,
          `${campo.nombre} ${campo.poblacion || ""}`,
        ),
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

export default function AdminActaImporter({ showToast, showConfirm }: AdminActaImporterProps) {
  const [categoria, setCategoria] = useState<ActaCategoria>("Veteranos");
  const [competicionesCatalog, setCompeticionesCatalog] = useState<CompetenciaRow[]>([]);
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
  /** La ficha federativa en PDF se lee en local; una foto del acta necesita OCR o IA. */
  const esFicha = file?.type === "application/pdf";

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
    if (!detectedMeta || !matches.length) return;
    const found = matches.find((m) => String(m.jornada?.numero) === String(detectedMeta.jornada));
    if (found) setSelectedMatchId(found.id);
  }, [matches, detectedMeta]);

  // Si la carga falla, se dice y se suelta la pantalla: antes se quedaba en «Cargando…».
  const fetchBaseData = useCallback(async () => {
    setBusy(true);
    setBusyText("Cargando partidos y plantilla...");
    try {
      // Una sola acción: Next despacha las del cliente en serie, así que tres serían tres viajes.
      // La temporada activa ya la filtra la consulta.
      const { partidos, jugadores: plantilla, campos: sedes } = await cargarPantallaActa(categoria);
      setJugadores(plantilla as unknown as ActaPlayerDb[]);
      setCampos(sedes as ActaCampoDb[]);

      const data = (partidos as unknown as ActaMatchDb[]).filter((match) => {
        const local = match.equipo_local?.nombre?.toLowerCase() || "";
        const visitante = match.equipo_visitante?.nombre?.toLowerCase() || "";
        const isSantiso = local.includes("santiso") || visitante.includes("santiso");
        const sameCompetition =
          !selectedCompetitionId ||
          match.competicion_id === selectedCompetitionId ||
          match.jornada?.competicion_id === selectedCompetitionId;
        return isSantiso && sameCompetition;
      });
      setMatches(data);
      setSelectedMatchId((current) =>
        data.some((match) => match.id === current) ? current : data[0]?.id || "",
      );
    } catch (error) {
      console.error(error);
      showToast("No se pudieron cargar partidos y plantilla. Comprueba la conexión.", "error");
    } finally {
      setBusy(false);
    }
  }, [categoria, selectedCompetitionId, showToast]);

  useEffect(() => {
    if (!selectedCompetitionId) return;
    const id = window.setTimeout(() => void fetchBaseData(), 0);
    return () => window.clearTimeout(id);
  }, [selectedCompetitionId, fetchBaseData]);

  /**
   * La ficha en PDF ya trae jornada, equipos y competición: se lee en local y no hace falta
   * ir a la nube. Para una foto del acta sigue haciendo falta la detección con IA.
   */
  async function detectarDesdeFicha(f: File): Promise<DetectedActaMeta | null> {
    const formData = new FormData();
    formData.append("ficha", f);
    formData.append("santisoEsLocal", santisoLocal ? "1" : "0");
    const resultado = await leerFichaPdf(formData);
    if (!resultado.ok) return null;
    const { deteccion } = resultado.datos;
    return {
      jornada: deteccion.jornada,
      localTeam: deteccion.localTeam,
      visitorTeam: deteccion.visitorTeam,
      categoria: deteccion.categoria,
      competicion: deteccion.competicion,
      fecha: deteccion.fecha,
    };
  }

  async function detectMatch(f: File) {
    setIsDetecting(true);
    setDetectedMeta(null);
    try {
      let data: DetectedActaMeta | null = null;
      if (f.type === "application/pdf") {
        data = await detectarDesdeFicha(f);
      }
      if (!data) {
        const formData = new FormData();
        formData.append("image", f);
        const res = await fetch("/api/admin/acta-detect", { method: "POST", body: formData });
        if (!res.ok) return;
        data = (await res.json()) as DetectedActaMeta;
      }
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

  /** Lectura local de la ficha federativa en PDF: sin OCR, sin IA y sin salir del ordenador. */
  async function analizarFichaPdf() {
    if (!file || !selectedMatch) {
      showToast("Selecciona partido y ficha antes de leerla.", "error");
      return;
    }

    setBusy(true);
    setProgress(undefined);
    setBusyText("Leyendo la ficha PDF...");

    try {
      const formData = new FormData();
      formData.append("ficha", file);
      formData.append("santisoEsLocal", santisoLocal ? "1" : "0");
      const resultado = await leerFichaPdf(formData);
      if (!resultado.ok) {
        showToast(resultado.error, "error");
        return;
      }

      const { acta: leida } = resultado.datos;
      setOcrText(leida.rawText);
      setActa(resolveCampo(resolveParsedActa(leida, jugadores), campos));
      showToast(
        leida.warnings.length > 0
          ? `Ficha leída con ${leida.warnings.length} aviso(s). Revísalos antes de insertar.`
          : "Ficha leída. Revisa antes de insertar.",
        leida.warnings.length > 0 ? "error" : "success",
      );
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

  function setPlayerFromDb(section: "titulares" | "suplentes", index: number, playerId: string) {
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
      [section]: [...current[section], { id: crypto.randomUUID(), dorsal: "", rawName: "" }],
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
  const canSave =
    Boolean(selectedMatchId) && unresolvedLineup.length === 0 && unresolvedEvents.length === 0;

  async function saveActa() {
    if (!selectedMatchId || !canSave) return;

    setBusy(true);
    setBusyText("Insertando datos revisados...");
    try {
      const resultado = await guardarActa(selectedMatchId, acta);
      if (!resultado.ok) {
        showToast(resultado.error, "error");
        return;
      }
      showToast("Acta insertada correctamente");
      await fetchBaseData();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.importer}>
      {busy && (
        <div className={styles.progress} role="status">
          <p>{busyText}</p>
          <progress max={100} value={progress} aria-label={busyText || "Procesando acta"} />
          {typeof progress === "number" && (
            <span>{Math.max(0, Math.min(100, Math.round(progress)))}%</span>
          )}
        </div>
      )}

      <PageHeader
        title="Importar acta con OCR"
        eyebrow="Acta individual"
        description="Sube una ficha PDF o una captura, revisa los datos y confirma. No modifica nombres ni motes de jugadores."
      />
      <div className={styles.fields}>
        <div className={styles.fieldSlot}>
          <Select
            label="Categoría"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as ActaCategoria)}
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </Select>
        </div>

        <div className={styles.fieldSlot}>
          <Select
            label="Competición"
            value={selectedCompetitionId}
            onChange={(e) => setSelectedCompetitionId(e.target.value)}
          >
            {competitionsInCategory.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nombre}
              </option>
            ))}
          </Select>
        </div>

        <div className={styles.full}>
          <Select
            label="Partido"
            value={selectedMatchId}
            onChange={(e) => setSelectedMatchId(e.target.value)}
          >
            <option value="">Selecciona partido...</option>
            {matches.map((match) => (
              <option key={match.id} value={match.id}>
                {matchLabel(match)}
              </option>
            ))}
          </Select>
        </div>

        <div className={styles.full}>
          <div
            className={styles.dropzone}
            data-selected={Boolean(file)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) {
                setFile(f);
                detectMatch(f);
              }
            }}
          >
            <svg
              aria-hidden="true"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span>{file ? file.name : "Arrastra la ficha PDF o la captura aquí"}</span>
            {file && <span>{(file.size / 1024).toFixed(0)} KB</span>}
            <Field
              label="Captura del acta"
              hint="Selecciona una ficha PDF o una imagen. También puedes arrastrarla aquí."
              id="acta-file-input"
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                setFile(f);
                if (f) detectMatch(f);
                else setDetectedMeta(null);
              }}
            />
          </div>
          {isDetecting && <LoadingState title="Detectando partido..." />}
          {!isDetecting && detectedMeta && (
            <p role="status" className={styles.detection} data-matched={Boolean(selectedMatchId)}>
              {selectedMatchId
                ? `✓ J${detectedMeta.jornada} · ${detectedMeta.localTeam} vs ${detectedMeta.visitorTeam}`
                : `⚠ J${detectedMeta.jornada} detectada — selecciona partido manualmente`}
            </p>
          )}
        </div>
      </div>

      <div className={styles.actions}>
        {/* Con un PDF el lector local es mejor que la nube: es exacto y no sale del ordenador. */}
        <Button
          onClick={esFicha ? analizarFichaPdf : analyzeImage}
          disabled={busy || !file || !selectedMatchId}
        >
          {esFicha ? "Leer ficha PDF (sin IA)" : "Analizar con Gemini"}
        </Button>
      </div>
      <div className={styles.actions}>
        {/* Con un PDF el respaldo es Gemini; con una imagen, el OCR del navegador. */}
        <Button
          variant="secondary"
          onClick={esFicha ? analyzeImage : analyzeWithLocalOcr}
          disabled={busy || !file || !selectedMatchId}
        >
          {esFicha ? "Probar con Gemini (fallback)" : "Usar OCR local (fallback)"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            if (!selectedMatchId) return;
            setActa({ ...emptyActa(), rawText: "__manual__" });
          }}
          disabled={busy || !selectedMatchId}
        >
          ✏️ Rellenar manualmente (sin acta)
        </Button>
      </div>

      {acta.rawText && (
        <div className={styles.review}>
          <div className={styles.column}>
            <section className={styles.section}>
              <h2>Datos del partido</h2>
              <div className={styles.fields}>
                <Field
                  label="Goles local"
                  value={acta.marcadorLocal}
                  onChange={(e) =>
                    setActa((current) => ({ ...current, marcadorLocal: e.target.value }))
                  }
                />

                <Field
                  label="Goles visitante"
                  value={acta.marcadorVisitante}
                  onChange={(e) =>
                    setActa((current) => ({ ...current, marcadorVisitante: e.target.value }))
                  }
                />

                <div className={styles.full}>
                  <Select
                    label="Campo"
                    value={acta.campoId || ""}
                    onChange={(e) => selectCampo(e.target.value)}
                  >
                    <option value="">Crear nuevo / texto detectado</option>
                    {campos.map((campo) => (
                      <option key={campo.id} value={campo.id}>
                        {campo.nombre}
                        {campo.poblacion ? ` (${campo.poblacion})` : ""}
                      </option>
                    ))}
                  </Select>
                </div>
                <Field
                  label="Nombre del campo"
                  value={acta.campoNombre}
                  disabled={Boolean(acta.campoId)}
                  onChange={(e) =>
                    setActa((current) => ({ ...current, campoNombre: e.target.value }))
                  }
                />
                <Field
                  label="Población"
                  value={acta.campoPoblacion}
                  disabled={Boolean(acta.campoId)}
                  onChange={(e) =>
                    setActa((current) => ({ ...current, campoPoblacion: e.target.value }))
                  }
                />
              </div>
            </section>

            <section className={styles.section}>
              <h2>Suplentes</h2>
              <LineupEditor
                labelPrefix="Suplente"
                players={acta.suplentes}
                jugadores={jugadores}
                onChange={(index, playerId) => setPlayerFromDb("suplentes", index, playerId)}
                onRemove={(index) => removeLineupPlayer("suplentes", index)}
              />
              <Button variant="secondary" onClick={() => addLineupPlayer("suplentes")}>
                Añadir suplente
              </Button>
            </section>
          </div>

          <div className={styles.column}>
            <section className={styles.section}>
              <h2>Titulares</h2>
              <LineupEditor
                labelPrefix="Titular"
                players={acta.titulares}
                jugadores={jugadores}
                onChange={(index, playerId) => setPlayerFromDb("titulares", index, playerId)}
                onRemove={(index) => removeLineupPlayer("titulares", index)}
              />
              <Button variant="secondary" onClick={() => addLineupPlayer("titulares")}>
                Añadir titular
              </Button>
            </section>
          </div>

          <section className={styles.fullSection}>
            <div className={styles.sectionHeader}>
              <h2>Eventos</h2>
              <Button variant="secondary" onClick={addEvent}>
                Añadir evento
              </Button>
            </div>
            <EventEditor
              eventos={acta.eventos}
              jugadores={jugadores}
              onUpdate={updateEvent}
              onSetPlayer={setEventPlayer}
              onRemove={removeEvent}
            />
          </section>

          {acta.rawText !== "__manual__" && (
            <section className={styles.fullSection}>
              <div className={styles.sectionHeader}>
                <h2>Texto OCR</h2>
                <Button variant="secondary" onClick={reparseText}>
                  Reprocesar texto
                </Button>
              </div>
              <Textarea
                label="Texto OCR para reprocesar"
                value={ocrText}
                onChange={(e) => setOcrText(e.target.value)}
                rows={8}
              />
            </section>
          )}
        </div>
      )}

      {(acta.warnings.length > 0 || unresolvedLineup.length > 0 || unresolvedEvents.length > 0) && (
        <aside className={styles.warnings} role="status" aria-label="Avisos de revisión">
          {[
            ...acta.warnings,
            `${unresolvedLineup.length} jugadores sin enlazar`,
            `${unresolvedEvents.length} eventos sin resolver`,
          ]
            .filter((warning) => !warning.startsWith("0 "))
            .map((warning, idx) => (
              <p key={`${warning}-${idx}`}>{warning}</p>
            ))}
        </aside>
      )}

      {acta.rawText && (
        <Button
          disabled={!canSave || busy}
          onClick={() =>
            showConfirm(
              "Se borrarán e insertarán de nuevo los datos de este partido. ¿Continuar?",
              saveActa,
            )
          }
        >
          Confirmar e insertar en BD
        </Button>
      )}
    </div>
  );
}

function LineupEditor({
  labelPrefix,
  players,
  jugadores,
  onChange,
  onRemove,
}: {
  labelPrefix: "Titular" | "Suplente";
  players: ActaPlayerRef[];
  jugadores: ActaPlayerDb[];
  onChange: (index: number, playerId: string) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className={styles.rows}>
      {players.length === 0 && (
        <EmptyState
          title={`Sin ${labelPrefix === "Titular" ? "titulares" : "suplentes"}`}
          detail="Añade jugadores para completar la alineación."
        />
      )}
      {players.map((player, index) => (
        <div key={player.id} className={styles.lineupRow}>
          <span
            className={styles.playerStatus}
            data-linked={Boolean(player.jugadorId)}
            aria-label={player.jugadorId ? "Jugador enlazado" : "Jugador sin enlazar"}
          >
            {player.dorsal || "?"}
          </span>
          <span className={styles.playerName}>{player.rawName || "Sin texto OCR"}</span>
          <Select
            label={`${labelPrefix} ${index + 1} · Jugador`}
            value={player.jugadorId || ""}
            onChange={(e) => onChange(index, e.target.value)}
          >
            <option value="">Sin enlazar...</option>
            {jugadores.map((dbPlayer) => (
              <option key={dbPlayer.id} value={dbPlayer.id}>
                {dbPlayer.dorsal ?? "?"} - {displayPlayer(dbPlayer)}
              </option>
            ))}
          </Select>
          <Button
            variant="danger"
            aria-label={`Quitar ${labelPrefix.toLowerCase()} ${index + 1}: ${player.displayName || player.rawName || "sin enlazar"}`}
            onClick={() => onRemove(index)}
          >
            Quitar
          </Button>
        </div>
      ))}
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
  const typeOptions: ActaEventType[] = ["gol", "tarjeta_amarilla", "tarjeta_roja", "cambio"];

  return (
    <div className={styles.rows}>
      {eventos.length === 0 && (
        <EmptyState title="Sin eventos" detail="Añade goles, tarjetas o cambios del partido." />
      )}
      {eventos.map((event, index) => (
        <div key={event.id} className={styles.event}>
          <div className={styles.eventHeader}>
            <div className={styles.fields}>
              <Field
                label={`Evento ${index + 1} · Minuto`}
                value={event.minuto}
                onChange={(e) => onUpdate(index, { minuto: e.target.value })}
                placeholder="Min."
              />
              <Select
                label={`Evento ${index + 1} · Tipo`}
                value={event.tipo}
                onChange={(e) => onUpdate(index, { tipo: e.target.value as ActaEventType })}
              >
                {typeOptions.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </Select>
            </div>

            <div className={styles.eventActions}>
              <Select
                label={`Evento ${index + 1} · Equipo`}
                value={
                  event.isRival
                    ? event.esPropiaSantiso
                      ? "propia_santiso"
                      : "rival"
                    : event.esPropia
                      ? "propia_rival"
                      : "santiso"
                }
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "rival")
                    onUpdate(index, { isRival: true, esPropia: false, esPropiaSantiso: false });
                  else if (v === "propia_rival")
                    onUpdate(index, {
                      isRival: false,
                      esPropia: true,
                      esPropiaSantiso: false,
                      jugador: undefined,
                    });
                  else if (v === "propia_santiso")
                    onUpdate(index, { isRival: true, esPropia: false, esPropiaSantiso: true });
                  else onUpdate(index, { isRival: false, esPropia: false, esPropiaSantiso: false });
                }}
              >
                <option value="santiso">Santiso</option>
                <option value="rival">Rival</option>
                {event.tipo === "gol" && <option value="propia_rival">En propia (rival)</option>}
                {event.tipo === "gol" && (
                  <option value="propia_santiso">En propia (Santiso)</option>
                )}
              </Select>
              <Button
                variant="danger"
                aria-label={`Quitar evento ${index + 1}`}
                onClick={() => onRemove(index)}
              >
                Quitar
              </Button>
            </div>
          </div>

          <div className={styles.eventBody}>
            {event.esPropiaSantiso ? (
              <PlayerSelect
                jugadores={jugadores}
                value={event.jugador?.jugadorId || ""}
                label={`Evento ${index + 1} · Jugador Santiso que marcó en propia...`}
                onChange={(playerId) => onSetPlayer(index, "jugador", playerId)}
              />
            ) : event.isRival ? (
              <Field
                label={`Evento ${index + 1} · Jugador rival`}
                value={event.nombreRival || ""}
                onChange={(e) => onUpdate(index, { nombreRival: e.target.value })}
                placeholder="Nombre jugador rival"
              />
            ) : event.esPropia ? (
              <Field
                label={`Evento ${index + 1} · Jugador rival`}
                value={event.nombreRival || ""}
                onChange={(e) => onUpdate(index, { nombreRival: e.target.value })}
                placeholder="Nombre del jugador rival (opcional)"
              />
            ) : event.tipo === "cambio" ? (
              <div className={styles.fields}>
                <PlayerSelect
                  jugadores={jugadores}
                  value={event.jugadorSale?.jugadorId || ""}
                  label={`Evento ${index + 1} · Sale`}
                  onChange={(playerId) => onSetPlayer(index, "jugadorSale", playerId)}
                />
                <PlayerSelect
                  jugadores={jugadores}
                  value={event.jugadorEntra?.jugadorId || ""}
                  label={`Evento ${index + 1} · Entra`}
                  onChange={(playerId) => onSetPlayer(index, "jugadorEntra", playerId)}
                />
              </div>
            ) : (
              <PlayerSelect
                jugadores={jugadores}
                value={event.jugador?.jugadorId || ""}
                label={`Evento ${index + 1} · Jugador`}
                onChange={(playerId) => onSetPlayer(index, "jugador", playerId)}
              />
            )}
          </div>
        </div>
      ))}
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
    <Select label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Sin elegir</option>
      {jugadores.map((player) => (
        <option key={player.id} value={player.id}>
          {player.dorsal ?? "?"} - {displayPlayer(player)}
        </option>
      ))}
    </Select>
  );
}
