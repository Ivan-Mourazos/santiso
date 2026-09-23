"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cargarPantallaActa, guardarActa } from "@/lib/server/acciones/actas";
import { leerFichaPdf } from "@/lib/server/acciones/fichas";
import type {
  ActaCampoDb,
  ActaEvent,
  ActaEventType,
  ActaMatchDb,
  ActaPlayerDb,
  ActaPlayerRef,
  ParsedActa,
} from "@/lib/actas/types";

import { Button } from "@/components/ui/foundation/Button";
import { Field, Select } from "@/components/ui/foundation/Fields";
import { Dialog } from "@/components/ui/foundation/Dialog";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/foundation/States";
import { PageHeader } from "@/components/ui/foundation/PageHeader";
import styles from "./actas/ActaBatch.module.css";

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
  const resolve = (p?: ActaPlayerRef) => (p ? resolvePlayerRef(p, byDorsal, jugadores) : undefined);
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
        tokenScore(
          `${acta.campoNombre} ${acta.campoPoblacion}`,
          `${c.nombre} ${c.poblacion || ""}`,
        ),
      ),
    }))
    .sort((a, b) => b.score - a.score)[0];
  if (!best || best.score < 0.55) return acta;
  return {
    ...acta,
    campoId: best.c.id,
    campoNombre: best.c.nombre,
    campoPoblacion: best.c.poblacion || acta.campoPoblacion,
  };
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
  if (unresolvedEvents.length > 0) issues.push(`${unresolvedEvents.length} evento(s) sin resolver`);
  const scoreWarning = acta.warnings?.find((w) => w.includes("no coinciden"));
  if (scoreWarning) issues.push(scoreWarning);
  return issues;
}

// ── API calls ────────────────────────────────────────────────────────────────

/**
 * La ficha federativa en PDF se lee en local, sin IA. Devuelve `null` cuando el fichero no es
 * un PDF o el parser lo rechaza, y entonces el lote sigue por Gemini como hasta ahora.
 */
async function leerEnLocal(file: File, santisoEsLocal: boolean) {
  if (file.type !== "application/pdf") return null;
  const fd = new FormData();
  fd.append("ficha", file);
  fd.append("santisoEsLocal", santisoEsLocal ? "1" : "0");
  const resultado = await leerFichaPdf(fd);
  return resultado.ok ? resultado.datos : null;
}

async function callDetect(file: File): Promise<DetectedMeta | null> {
  const local = await leerEnLocal(file, true);
  if (local) {
    const { deteccion } = local;
    return {
      jornada: deteccion.jornada,
      localTeam: deteccion.localTeam,
      visitorTeam: deteccion.visitorTeam,
      categoria: deteccion.categoria,
      competicion: deteccion.competicion,
    };
  }

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
  const santisoEsLocal = match.equipo_local?.nombre?.toLowerCase().includes("santiso") ?? true;
  const local = await leerEnLocal(file, santisoEsLocal);
  if (local) return local.acta;

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
  if (status === "detecting" || status === "analyzing" || status === "saving")
    return <span aria-hidden="true" className={styles.spinner} />;
  return (
    <span aria-hidden="true">
      {status === "done" ? "✓" : status === "review" ? "⚠" : status === "error" ? "✗" : "–"}
    </span>
  );
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

function PlayerSelect({
  jugadores,
  value,
  label,
  onChange,
}: {
  jugadores: ActaPlayerDb[];
  value: string;
  label: string;
  onChange: (id: string) => void;
}) {
  return (
    <Select label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Sin enlazar...</option>
      {jugadores.map((p) => (
        <option key={p.id} value={p.id}>
          {p.dorsal ?? "?"} - {displayPlayer(p)}
        </option>
      ))}
    </Select>
  );
}

function LineupEditor({
  seccion,
  players,
  jugadores,
  onChange,
  onRemove,
}: {
  /** Nombra cada selector: sin ella, «Jugador 1» se repetiría en titulares y suplentes. */
  seccion: "titulares" | "suplentes";
  players: ActaPlayerRef[];
  jugadores: ActaPlayerDb[];
  onChange: (index: number, playerId: string) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className={styles.stack}>
      {players.map((player, index) => (
        <div key={player.id} className={styles.editorRow}>
          <span>{player.dorsal || "?"}</span>
          <span>{player.rawName || "Sin texto"}</span>
          <Select
            label={`Jugador ${index + 1} de ${seccion}`}
            value={player.jugadorId || ""}
            onChange={(e) => onChange(index, e.target.value)}
          >
            <option value="">Sin enlazar...</option>
            {jugadores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.dorsal ?? "?"} - {displayPlayer(p)}
              </option>
            ))}
          </Select>
          <Button
            variant="secondary"
            aria-label={`Eliminar jugador ${index + 1} de ${seccion}`}
            onClick={() => onRemove(index)}
          >
            Eliminar
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
    <div className={styles.stack}>
      {eventos.map((event, index) => (
        <div key={event.id} className={styles.editorRow}>
          <div className={styles.stack}>
            <Field
              label={`Minuto del evento ${index + 1}`}
              value={event.minuto}
              onChange={(e) => onUpdate(index, { minuto: e.target.value })}
              placeholder="Min"
            />
            <Select
              label={`Tipo del evento ${index + 1}`}
              value={event.tipo}
              onChange={(e) => onUpdate(index, { tipo: e.target.value as ActaEventType })}
            >
              {typeOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
            <Select
              label={`Equipo del evento ${index + 1}`}
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
              {event.tipo === "gol" && <option value="propia_rival">Propia (rival)</option>}
              {event.tipo === "gol" && <option value="propia_santiso">Propia (Santiso)</option>}
            </Select>
            <Button
              variant="secondary"
              aria-label={`Eliminar evento ${index + 1}`}
              onClick={() => onRemove(index)}
            >
              Eliminar evento
            </Button>
          </div>
          <div className={styles.stack}>
            {event.esPropiaSantiso ? (
              <PlayerSelect
                jugadores={jugadores}
                value={event.jugador?.jugadorId || ""}
                label={`Jugador en propia del evento ${index + 1}`}
                onChange={(id) => onSetPlayer(index, "jugador", id)}
              />
            ) : event.isRival ? (
              <Field
                label={`Jugador rival del evento ${index + 1}`}
                value={event.nombreRival || ""}
                onChange={(e) => onUpdate(index, { nombreRival: e.target.value })}
                placeholder="Nombre jugador rival"
              />
            ) : event.esPropia ? (
              <Field
                label={`Jugador rival del evento ${index + 1}`}
                value={event.nombreRival || ""}
                onChange={(e) => onUpdate(index, { nombreRival: e.target.value })}
                placeholder="Nombre jugador rival (opcional)"
              />
            ) : event.tipo === "cambio" ? (
              <div className={styles.stack}>
                <PlayerSelect
                  jugadores={jugadores}
                  value={event.jugadorSale?.jugadorId || ""}
                  label={`Jugador que sale del evento ${index + 1}`}
                  onChange={(id) => onSetPlayer(index, "jugadorSale", id)}
                />
                <PlayerSelect
                  jugadores={jugadores}
                  value={event.jugadorEntra?.jugadorId || ""}
                  label={`Jugador que entra del evento ${index + 1}`}
                  onChange={(id) => onSetPlayer(index, "jugadorEntra", id)}
                />
              </div>
            ) : (
              <PlayerSelect
                jugadores={jugadores}
                value={event.jugador?.jugadorId || ""}
                label={`Jugador del evento ${index + 1}`}
                onChange={(id) => onSetPlayer(index, "jugador", id)}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Modal de revisión ─────────────────────────────────────────────────────────

function BatchReviewModal({
  item,
  allMatches,
  jugadoresByCategoria,
  campos,
  onSaved,
  onCancel,
}: {
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
  const santisoLocal =
    selectedMatch?.equipo_local?.nombre?.toLowerCase().includes("santiso") ?? true;
  const santisoName = santisoLocal
    ? selectedMatch?.equipo_local?.nombre
    : selectedMatch?.equipo_visitante?.nombre;
  const rivalName = santisoLocal
    ? selectedMatch?.equipo_visitante?.nombre
    : selectedMatch?.equipo_local?.nombre;

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
    setActa((cur) => ({
      ...cur,
      [section]: [...cur[section], { id: crypto.randomUUID(), dorsal: "", rawName: "" }],
    }));
  }

  function updateEvent(index: number, patch: Partial<ActaEvent>) {
    setActa((cur) => {
      const eventos = [...cur.eventos];
      eventos[index] = { ...eventos[index], ...patch };
      return { ...cur, eventos };
    });
  }

  function setEventPlayer(
    index: number,
    key: "jugador" | "jugadorSale" | "jugadorEntra",
    playerId: string,
  ) {
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
    if (!campoId) {
      setActa((cur) => ({ ...cur, campoId: undefined }));
      return;
    }
    const campo = campos.find((c) => c.id === campoId);
    if (!campo) return;
    setActa((cur) => ({
      ...cur,
      campoId: campo.id,
      campoNombre: campo.nombre,
      campoPoblacion: campo.poblacion || "",
    }));
  }

  async function handleSave() {
    if (!selectedMatch || !canSave) return;
    setSaving(true);
    try {
      const resultado = await guardarActa(selectedMatch.id, acta);
      if (!resultado.ok) {
        alert(resultado.error);
        return;
      }
      onSaved(item.id);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      title="Revisar acta del lote"
      description={item.file.name}
      pending={saving}
      onClose={() => {
        if (!saving) onCancel();
      }}
      closeLabel="Cerrar revisión"
      footer={
        <>
          <Button
            variant="secondary"
            disabled={saving}
            onClick={() => {
              if (!saving) onCancel();
            }}
          >
            Volver al lote
          </Button>
          <Button
            onClick={handleSave}
            disabled={!canSave}
            pending={saving}
            pendingLabel="Guardando..."
          >
            Confirmar e insertar
          </Button>
        </>
      }
    >
      <fieldset className={styles.review} disabled={saving}>
        <legend className={styles.srOnly}>Edición del acta</legend>
        <Select
          label="Partido del acta"
          value={selectedMatch?.id || ""}
          onChange={(e) => changeMatch(e.target.value)}
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
                        J{m.jornada?.numero} · {m.equipo_local?.nombre} vs{" "}
                        {m.equipo_visitante?.nombre}
                      </option>
                    ))}
                </optgroup>
              ));
          })()}
        </Select>
        {selectedMatch && (
          <p className={styles.detail}>
            Santiso como <strong>{santisoLocal ? "LOCAL" : "VISITANTE"}</strong> vs{" "}
            {rivalName || "Rival"}
          </p>
        )}
        {(unresolvedLineup.length > 0 || unresolvedEvents.length > 0) && (
          <div className={styles.notice} role="status">
            {unresolvedLineup.length > 0 && (
              <p>{unresolvedLineup.length} jugador(es) sin enlazar</p>
            )}
            {unresolvedEvents.length > 0 && <p>{unresolvedEvents.length} evento(s) sin resolver</p>}
          </div>
        )}
        <section className={styles.section} aria-label="Datos del partido">
          <h3>Datos del partido</h3>
          <div className={styles.fields}>
            <Field
              label={`Goles ${santisoLocal ? "local (Santiso)" : "local (Rival)"}`}
              value={acta.marcadorLocal}
              onChange={(e) => setActa((c) => ({ ...c, marcadorLocal: e.target.value }))}
            />
            <Field
              label={`Goles ${santisoLocal ? "visitante (Rival)" : "visitante (Santiso)"}`}
              value={acta.marcadorVisitante}
              onChange={(e) => setActa((c) => ({ ...c, marcadorVisitante: e.target.value }))}
            />
            <Select
              label="Campo"
              value={acta.campoId || ""}
              onChange={(e) => selectCampo(e.target.value)}
            >
              <option value="">Nuevo / detectado</option>
              {campos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                  {c.poblacion ? ` (${c.poblacion})` : ""}
                </option>
              ))}
            </Select>
          </div>
          {!acta.campoId && acta.campoNombre && (
            <p className={styles.detail}>
              Campo detectado: {acta.campoNombre}
              {acta.campoPoblacion ? `, ${acta.campoPoblacion}` : ""}
            </p>
          )}
        </section>
        <section className={styles.section} aria-label="Titulares de Santiso">
          <div className={styles.sectionHeader}>
            <h3>Titulares · Santiso</h3>
            <Button variant="secondary" onClick={() => addToSection("titulares")}>
              Añadir titular
            </Button>
          </div>
          <LineupEditor
            seccion="titulares"
            players={acta.titulares}
            jugadores={jugadores}
            onChange={(i, id) => setPlayerInSection("titulares", i, id)}
            onRemove={(i) => removeFromSection("titulares", i)}
          />
        </section>
        <section className={styles.section} aria-label="Suplentes de Santiso">
          <div className={styles.sectionHeader}>
            <h3>Suplentes · Santiso</h3>
            <Button variant="secondary" onClick={() => addToSection("suplentes")}>
              Añadir suplente
            </Button>
          </div>
          <LineupEditor
            seccion="suplentes"
            players={acta.suplentes}
            jugadores={jugadores}
            onChange={(i, id) => setPlayerInSection("suplentes", i, id)}
            onRemove={(i) => removeFromSection("suplentes", i)}
          />
        </section>
        <section className={styles.section} aria-label="Eventos del partido">
          <div className={styles.sectionHeader}>
            <h3>Eventos</h3>
            <Button variant="secondary" onClick={addEvent}>
              Añadir evento
            </Button>
          </div>
          <p className={styles.detail}>
            Santiso = {santisoName || "Santiso"} · Rival = {rivalName || "Rival"}
          </p>
          <EventEditor
            eventos={acta.eventos}
            jugadores={jugadores}
            onUpdate={updateEvent}
            onSetPlayer={setEventPlayer}
            onRemove={removeEvent}
          />
        </section>
        {acta.warnings && acta.warnings.length > 0 && (
          <div className={styles.notice}>
            {acta.warnings.map((w, i) => (
              <p key={i}>⚠ {w}</p>
            ))}
          </div>
        )}
      </fieldset>
    </Dialog>
  );
}

// ── Component principal ───────────────────────────────────────────────────────

export default function AdminActaBatch({ showToast }: AdminActaBatchProps) {
  const [allMatches, setAllMatches] = useState<ActaMatchDb[]>([]);
  const [jugadoresByCategoria, setJugadoresByCategoria] = useState<Record<string, ActaPlayerDb[]>>(
    {},
  );
  const [campos, setCampos] = useState<ActaCampoDb[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  const [items, setItems] = useState<BatchItem[]>([]);
  const [running, setRunning] = useState(false);
  const abortRef = useRef(false);
  const [reviewingItem, setReviewingItem] = useState<BatchItem | null>(null);
  const reviewTriggerRef = useRef<HTMLButtonElement | null>(null);
  const uploadRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!reviewingItem && reviewTriggerRef.current) {
      const trigger = reviewTriggerRef.current;
      (trigger.isConnected ? trigger : uploadRef.current)?.focus();
      reviewTriggerRef.current = null;
    }
  }, [reviewingItem]);

  // Si la carga falla, la pantalla lo dice y deja reintentar. Antes se quedaba en «Cargando…»
  // para siempre, sin ningún aviso.
  const cargarDatos = useCallback(async () => {
    setLoadingData(true);
    setErrorCarga(null);
    try {
      // Sin categoría: el lote trabaja con las tres. La temporada activa la filtra la consulta.
      const { partidos, jugadores: plantilla, campos: sedes } = await cargarPantallaActa();

      const santiso = (partidos as unknown as ActaMatchDb[]).filter((m) => {
        const local = m.equipo_local?.nombre?.toLowerCase() || "";
        const visitante = m.equipo_visitante?.nombre?.toLowerCase() || "";
        return local.includes("santiso") || visitante.includes("santiso");
      });
      setAllMatches(santiso);

      const bycat: Record<string, ActaPlayerDb[]> = {};
      for (const j of plantilla as unknown as ActaPlayerDb[]) {
        (bycat[j.categoria] = bycat[j.categoria] || []).push(j);
      }
      setJugadoresByCategoria(bycat);

      setCampos(sedes as ActaCampoDb[]);
    } catch (error) {
      console.error(error);
      setErrorCarga("No se pudieron cargar partidos, plantillas y campos.");
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void cargarDatos(), 0);
    return () => window.clearTimeout(id);
  }, [cargarDatos]);

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
    const pending = items.filter(
      (it) =>
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
      // La ficha no siempre dice la categoría: con la categoría vacía se prueban todas y
      // decide el nombre del rival, que es el desempate de más abajo.
      const candidates = allMatches.filter(
        (m) =>
          (!meta.categoria || m.categoria === meta.categoria) &&
          String(m.jornada?.numero) === String(meta.jornada),
      );
      const match = (() => {
        if (candidates.length === 0) return null;
        if (candidates.length === 1) return candidates[0];
        // Nombre rival detectado: el que NO es Santiso en meta
        const detectedRival =
          [meta.localTeam, meta.visitorTeam].find((t) => !t.toLowerCase().includes("santiso")) ||
          "";
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
      updateItem(item.id, {
        status: "analyzing",
        partido: matchLabel(match),
        competicion: meta.competicion,
      });
      const parsed = await callAnalyze(item.file, match, jugadores, campos);
      if (!parsed) {
        updateItem(item.id, {
          status: "error",
          partido: matchLabel(match),
          error: "Gemini no devolvió datos",
        });
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
      // Un fallo marca solo esta fila y el lote continúa: lo que pide la auditoría (§8.1).
      const resultado = await guardarActa(match.id, resolved);
      if (resultado.ok) {
        updateItem(item.id, { status: "done", partido: matchLabel(match) });
        savedCount++;
      } else {
        updateItem(item.id, {
          status: "error",
          partido: matchLabel(match),
          error: resultado.error,
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
    (it) =>
      it.status === "pending" ||
      it.status === "error" ||
      (it.status === "review" && !it.resolvedActa),
  ).length;

  const doneCount = items.filter((item) => item.status === "done").length;
  const reviewCount = items.filter((item) => item.status === "review").length;
  const errorCount = items.filter((item) => item.status === "error").length;
  const completedCount = doneCount + reviewCount + errorCount;

  return (
    <div className={styles.batch}>
      <PageHeader
        title="Importar actas en lote"
        description="Sube varios PDFs o imágenes. Cada archivo se detecta y analiza automáticamente; las actas sin incidencias se guardan y las demás quedan para revisión."
      />
      {loadingData ? (
        <LoadingState title="Cargando datos del lote..." />
      ) : errorCarga ? (
        <ErrorState
          title="No se pudo preparar el lote"
          detail={errorCarga}
          action={<Button onClick={() => void cargarDatos()}>Reintentar</Button>}
        />
      ) : (
        <>
          <div
            className={styles.upload}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              onFilesSelected(e.dataTransfer.files);
            }}
          >
            <Field
              ref={uploadRef}
              id="batch-file-input"
              label="Archivos del lote"
              type="file"
              accept="application/pdf,image/*"
              multiple
              onChange={(e) => onFilesSelected(e.target.files)}
              hint="Arrastra PDFs o imágenes aquí, o selecciona varios archivos."
            />
          </div>
          {items.length === 0 ? (
            <EmptyState
              title="Sin archivos en el lote"
              detail="Selecciona las actas que quieres importar."
            />
          ) : (
            <>
              <div className={styles.summary} role="status" aria-live="polite">
                <span>{items.length} archivo(s)</span>
                <span>{doneCount} guardada(s)</span>
                <span>{reviewCount} para revisar</span>
                <span>{errorCount} con error</span>
              </div>
              <progress
                className={styles.progress}
                value={completedCount}
                max={items.length}
                aria-label="Progreso del lote"
              />
              <ul className={styles.list} aria-label="Actas del lote">
                {items.map((item) => (
                  <li key={item.id} className={styles.item}>
                    <div className={styles.fileInfo}>
                      <h3>{item.file.name}</h3>
                      <p>{item.partido ?? "Partido pendiente de detectar"}</p>
                      {item.competicion && <p className={styles.detail}>{item.competicion}</p>}
                    </div>
                    <div className={styles.status} data-status={item.status}>
                      <StatusIcon status={item.status} />
                      <span>{statusLabel(item.status)}</span>
                    </div>
                    {item.issues?.length || item.error ? (
                      <p className={styles.notice}>{item.issues?.join(" · ") || item.error}</p>
                    ) : null}
                    <div className={styles.actions}>
                      {item.status === "review" && item.resolvedActa && (
                        <Button
                          variant="secondary"
                          aria-label={`Revisar ${item.file.name}`}
                          onClick={(event) => {
                            reviewTriggerRef.current = event.currentTarget;
                            setReviewingItem(item);
                          }}
                        >
                          Revisar
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        aria-label={`Quitar ${item.file.name} del lote`}
                        onClick={() => setItems((prev) => prev.filter((it) => it.id !== item.id))}
                        disabled={running}
                      >
                        Quitar
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className={styles.actions}>
            <Button
              onClick={processAll}
              disabled={running || pendingCount === 0 || loadingData}
              pending={running}
              pendingLabel="Procesando..."
            >
              Procesar {pendingCount} acta(s)
            </Button>
            {running && (
              <Button
                variant="secondary"
                onClick={() => {
                  abortRef.current = true;
                }}
              >
                Detener
              </Button>
            )}
            {items.length > 0 && !running && (
              <Button variant="secondary" onClick={() => setItems([])}>
                Limpiar lista
              </Button>
            )}
          </div>
          {running && (
            <p className={styles.detail}>
              Detener finalizará el archivo en curso antes de parar el lote.
            </p>
          )}
        </>
      )}
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
    </div>
  );
}
