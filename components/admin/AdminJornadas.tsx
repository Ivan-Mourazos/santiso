"use client";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import BusyBanner from "./BusyBanner";
import { getCompetitionsByCategory } from "@/lib/competition";
import {
  fetchMatchdaysForCompetition,
  fetchMatchesForMatchday,
  fetchSeasons,
  fetchTeamsForCompetition,
  mergeMissingTeams,
} from "@/lib/supabase-queries";

interface AdminJornadasProps {
  showToast: (msg: string, type?: "success" | "error") => void;
  showConfirm: (msg: string, onConfirm: () => void) => void;
  categoria: string;
}

export default function AdminJornadas({
  showToast,
  showConfirm,
  categoria,
}: AdminJornadasProps) {
  const parseGoalInput = (raw: string): number | null => {
    if (raw.trim() === "") return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const toGoalInputValue = (value: unknown): string =>
    typeof value === "number" && Number.isFinite(value) ? String(value) : "";

  const [jornadas, setJornadas] = useState<any[]>([]);
  const [equipos, setEquipos] = useState<any[]>([]);
  const [campos, setCampos] = useState<any[]>([]);
  const [partidos, setPartidos] = useState<any[]>([]);
  const [temporadas, setTemporadas] = useState<any[]>([]);
  const [temporadaActiva, setTemporadaActiva] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [busyText, setBusyText] = useState("Cargando jornadas y partidos...");
  const [rowBusy, setRowBusy] = useState<Record<string, boolean>>({});
  const [selectedJornada, setSelectedJornada] = useState<string | null>(null);
  const [competitions, setCompetitions] = useState<string[]>([]);
  const [selectedCompeticion, setSelectedCompeticion] = useState("");

  // New Matchday form
  const [numJornada, setNumJornada] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");

  // New Season form
  const [nuevaTemporadaNombre, setNuevaTemporadaNombre] = useState("");

  // New Match form
  const [localId, setLocalId] = useState("");
  const [visitanteId, setVisitanteId] = useState("");
  const [fechaPartido, setFechaPartido] = useState("");
  const [campoId, setCampoId] = useState("");
  const [descansos, setDescansos] = useState<any[]>([]);
  const [descansoEquipoId, setDescansoEquipoId] = useState("");

  useEffect(() => {
    fetchBaseData();
  }, [categoria, selectedCompeticion]);

  useEffect(() => {
    const opts = getCompetitionsByCategory(categoria);
    setCompetitions(opts);
    setSelectedCompeticion(opts[0] || "");
  }, [categoria]);

  async function fetchBaseData() {
    setIsFetching(true);
    const [{ data: tData, active }, eData] = await Promise.all([
      fetchSeasons(),
      selectedCompeticion
        ? fetchTeamsForCompetition(categoria, selectedCompeticion)
        : Promise.resolve([]),
    ]);

    setTemporadas(tData);
    if (active) setTemporadaActiva(active);
    setEquipos(eData);

    // Campos
    const { data: cData, error: cError } = await supabase
      .from("campos_futbol")
      .select("*")
      .order("nombre");
    if (cError) {
      console.error("Error cargando campos:", cError);
    } else if (cData) {
      setCampos(cData);
    }
    setIsFetching(false);
  }

  useEffect(() => {
    if (temporadaActiva) {
      fetchJornadas();
    }
  }, [temporadaActiva, categoria, selectedCompeticion]);

  async function fetchJornadas() {
    setIsFetching(true);
    const { data, error } = await fetchMatchdaysForCompetition(
      temporadaActiva.id,
      categoria,
      selectedCompeticion,
    );

    if (error) {
      showToast("Error cargando jornadas: " + error.message, "error");
      setIsFetching(false);
      return;
    }

    setJornadas(data);
    if (data.length === 0) setSelectedJornada(null);
    else if (
      !selectedJornada ||
      !data.some((j: any) => j.id === selectedJornada)
    )
      setSelectedJornada(data[0].id);
    setIsFetching(false);
  }

  async function handleCreateTemporada(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevaTemporadaNombre) return;
    setBusyText("Creando temporada...");
    setLoading(true);
    const { error } = await supabase.from("temporadas").insert([
      {
        nombre: nuevaTemporadaNombre,
        activa: temporadas.length === 0,
      },
    ]);
    if (!error) {
      showToast("Temporada creada");
      setNuevaTemporadaNombre("");
      fetchBaseData();
    } else {
      showToast("Error al crear: " + error.message, "error");
    }
    setLoading(false);
  }

  async function toggleTemporadaActiva(id: string) {
    setBusyText("Cambiando temporada activa...");
    setLoading(true);
    await supabase.from("temporadas").update({ activa: false }).neq("id", id);
    const { error } = await supabase
      .from("temporadas")
      .update({ activa: true })
      .eq("id", id);
    if (!error) {
      showToast("Temporada activa cambiada");
      fetchBaseData();
    } else {
      showToast("Error al activar: " + error.message, "error");
    }
    setLoading(false);
  }

  useEffect(() => {
    if (selectedJornada) {
      fetchPartidos();
      fetchDescansos();
    } else {
      setDescansos([]);
    }
  }, [selectedJornada, selectedCompeticion]);

  useEffect(() => {
    if (!partidos.length) return;
    const needed = new Set<string>();
    for (const p of partidos) {
      if (p.equipo_local_id) needed.add(p.equipo_local_id);
      if (p.equipo_visitante_id) needed.add(p.equipo_visitante_id);
    }
    const have = new Set(equipos.map((e: any) => e.id));
    const missing = [...needed].filter((id) => !have.has(id));
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      const merged = await mergeMissingTeams(equipos, missing);
      if (cancelled) return;
      if (merged.length === equipos.length) return;
      setEquipos(merged);
    })();
    return () => {
      cancelled = true;
    };
  }, [partidos, equipos]);

  async function fetchDescansos() {
    if (!selectedJornada) return;
    const { data, error } = await supabase
      .from("jornada_equipo_descanso")
      .select("id, equipo_id")
      .eq("jornada_id", selectedJornada);
    if (error) {
      console.error("jornada_equipo_descanso:", error.message);
      setDescansos([]);
      return;
    }
    setDescansos(data || []);
  }

  async function fetchPartidos() {
    setIsFetching(true);
    if (!selectedJornada) {
      setPartidos([]);
      setIsFetching(false);
      return;
    }

    const jornada = jornadas.find((j: any) => j.id === selectedJornada);
    const { data, error } = await fetchMatchesForMatchday(
      selectedJornada,
      categoria,
      selectedCompeticion,
      {
        jornadaCompeticion: jornada?.competicion ?? null,
      },
    );
    if (error) showToast("Error cargando partidos: " + error.message, "error");
    setPartidos(data);
    setIsFetching(false);
  }

  async function handleCreateJornada(e: React.FormEvent) {
    e.preventDefault();
    if (!temporadaActiva) return showToast("No hay temporada activa", "error");
    setBusyText("Creando jornada...");
    setLoading(true);
    const payload: any = {
      temporada_id: temporadaActiva.id,
      categoria,
      numero: parseInt(numJornada),
      fecha_inicio: fechaInicio || null,
      competicion: selectedCompeticion,
    };
    const { error } = await supabase.from("jornadas").insert([payload]);
    if (!error) {
      showToast("Jornada creada");
      setNumJornada("");
      fetchJornadas();
    } else {
      showToast("Error al crear jornada", "error");
    }
    setLoading(false);
  }

  async function handleAddDescanso(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedJornada || !descansoEquipoId) return;
    const teamAlreadyPlays = partidos.some(
      (p: any) =>
        p.equipo_local_id === descansoEquipoId ||
        p.equipo_visitante_id === descansoEquipoId,
    );
    if (teamAlreadyPlays)
      return showToast("Ese equipo ya tiene partido en esta jornada", "error");

    setBusyText("Marcando descanso...");
    setLoading(true);
    const { error } = await supabase
      .from("jornada_equipo_descanso")
      .insert([{ jornada_id: selectedJornada, equipo_id: descansoEquipoId }]);
    if (error) {
      if (error.code === "23505")
        showToast("Ese equipo ya tiene descanso en esta jornada", "error");
      else if (error.message?.includes("does not exist")) {
        showToast(
          "Ejecuta scripts/migration_jornada_descanso.sql en Supabase",
          "error",
        );
      } else showToast(error.message, "error");
    } else {
      showToast("Descanso registrado");
      setDescansoEquipoId("");
      fetchDescansos();
    }
    setLoading(false);
  }

  async function handleRemoveDescanso(rowId: string) {
    showConfirm(
      "¿Quitar el descanso de este equipo en esta jornada?",
      async () => {
        await supabase.from("jornada_equipo_descanso").delete().eq("id", rowId);
        fetchDescansos();
        showToast("Descanso eliminado");
      },
    );
  }

  async function handleAddPartido(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedJornada || !localId || !visitanteId) return;
    if (localId === visitanteId)
      return showToast("Un equipo no puede jugar contra sí mismo", "error");
    const restingIds = new Set(descansos.map((d: any) => d.equipo_id));
    if (restingIds.has(localId) || restingIds.has(visitanteId)) {
      return showToast(
        "No puedes añadir un partido con un equipo que descansa",
        "error",
      );
    }
    const alreadyUsed = partidos.some(
      (p: any) =>
        [localId, visitanteId].includes(p.equipo_local_id) ||
        [localId, visitanteId].includes(p.equipo_visitante_id),
    );
    if (alreadyUsed)
      return showToast("Uno de los equipos ya juega en esta jornada", "error");

    setBusyText("Añadiendo partido...");
    setLoading(true);
    const payload: any = {
      jornada_id: selectedJornada,
      categoria,
      competicion: selectedCompeticion,
      equipo_local_id: localId,
      equipo_visitante_id: visitanteId,
      goles_local: null,
      goles_visitante: null,
      fecha: fechaPartido || null,
      campo_id: campoId || null,
      estado: "programado",
    };
    const { error } = await supabase.from("partidos_liga").insert([payload]);
    if (!error) {
      showToast("Partido añadido");
      setLocalId("");
      setVisitanteId("");
      setCampoId("");
      fetchPartidos();
    } else {
      showToast("Error añadiendo partido: " + error.message, "error");
    }
    setLoading(false);
  }

  async function updatePartidoState(id: string, field: string, value: any) {
    const updateObj = { [field]: value };
    const { error } = await supabase
      .from("partidos_liga")
      .update(updateObj)
      .eq("id", id);
    if (!error) fetchPartidos();
  }

  async function saveMatchScore(id: string, local: number, vis: number) {
    const { error } = await supabase
      .from("partidos_liga")
      .update({
        goles_local: local,
        goles_visitante: vis,
      })
      .eq("id", id);
    if (!error) showToast("Marcador guardado");
  }

  async function handleDeletePartido(id: string) {
    showConfirm("¿Borrar este partido de la jornada?", async () => {
      setRowBusy((prev) => ({ ...prev, [id]: true }));
      await supabase.from("partidos_liga").delete().eq("id", id);
      fetchPartidos();
      showToast("Partido eliminado");
      setRowBusy((prev) => ({ ...prev, [id]: false }));
    });
  }

  async function handleDeleteJornada(id: string) {
    showConfirm(
      "¿Eliminar TODA la jornada y sus partidos? Esto recalculará la clasificación.",
      async () => {
        await supabase.from("jornadas").delete().eq("id", id);
        setSelectedJornada(null);
        fetchJornadas();
        showToast("Jornada borrada");
      },
    );
  }

  const teamsById = useMemo(
    () => new Map(equipos.map((e: any) => [e.id, e])),
    [equipos],
  );
  const getTeamName = (id: string) =>
    teamsById.get(id)?.nombre || "Desconocido";
  const getTeamShield = (id: string) => teamsById.get(id)?.escudo_url || "";
  const restingTeamIds = useMemo(
    () => new Set(descansos.map((d: any) => d.equipo_id)),
    [descansos],
  );
  const playingTeamIds = useMemo(() => {
    const ids = new Set<string>();
    for (const p of partidos) {
      if (p.equipo_local_id) ids.add(p.equipo_local_id);
      if (p.equipo_visitante_id) ids.add(p.equipo_visitante_id);
    }
    return ids;
  }, [partidos]);
  const unavailableTeamIds = useMemo(
    () => new Set([...restingTeamIds, ...playingTeamIds]),
    [restingTeamIds, playingTeamIds],
  );
  const availableForLocal = equipos.filter(
    (eq) =>
      (!unavailableTeamIds.has(eq.id) || eq.id === localId) &&
      eq.id !== visitanteId,
  );
  const availableForVisitor = equipos.filter(
    (eq) =>
      (!unavailableTeamIds.has(eq.id) || eq.id === visitanteId) &&
      eq.id !== localId,
  );
  const availableForRest = equipos.filter(
    (eq) => !unavailableTeamIds.has(eq.id) || eq.id === descansoEquipoId,
  );

  return (
    <div className="card glass full-width" style={{ padding: "2.5rem" }}>
      <BusyBanner
        show={loading || isFetching}
        text={isFetching ? "Cargando jornadas y partidos..." : busyText}
      />
      <div
        className="input-group"
        style={{ marginBottom: "1rem", maxWidth: "480px" }}
      >
        <label>Competición</label>
        <select
          value={selectedCompeticion}
          onChange={(e) => {
            setSelectedJornada(null);
            setPartidos([]);
            setDescansos([]);
            setSelectedCompeticion(e.target.value);
          }}
          disabled={loading || isFetching}
        >
          {competitions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* BARRA DE HERRAMIENTAS SUPERIOR (TOOLBAR) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "2.5rem",
          paddingBottom: "2.5rem",
          marginBottom: "3rem",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* Bloque Temporada */}
        <div className="control-group">
          <label
            style={{
              fontSize: "0.8rem",
              color: "var(--primary)",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "1px",
              marginBottom: "1rem",
              display: "block",
            }}
          >
            🏆 Gestión de Temporada
          </label>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 140px 60px",
              gap: "0.8rem",
            }}
          >
            <select
              value={temporadaActiva?.id || ""}
              onChange={(e) => toggleTemporadaActiva(e.target.value)}
              style={{
                height: "55px",
                background: "rgba(0,0,0,0.4)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "white",
                padding: "0 1.2rem",
                borderRadius: "12px",
                fontSize: "1rem",
                fontWeight: 600,
              }}
            >
              {temporadas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre} {t.activa ? "(Activa)" : ""}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Nueva..."
              value={nuevaTemporadaNombre}
              onChange={(e) => setNuevaTemporadaNombre(e.target.value)}
              style={{
                height: "55px",
                padding: "0 1rem",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "white",
                fontSize: "0.9rem",
                borderRadius: "12px",
              }}
            />
            <button
              onClick={handleCreateTemporada}
              className="btn-primary"
              style={{
                height: "55px",
                borderRadius: "12px",
                fontSize: "1.5rem",
              }}
            >
              +
            </button>
          </div>
        </div>

        {/* Bloque Jornada */}
        <div className="control-group">
          <label
            style={{
              fontSize: "0.8rem",
              color: "var(--primary)",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "1px",
              marginBottom: "1rem",
              display: "block",
            }}
          >
            📅 Selección de Jornada
          </label>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 100px 60px 60px",
              gap: "0.8rem",
            }}
          >
            <select
              value={selectedJornada || ""}
              onChange={(e) => setSelectedJornada(e.target.value)}
              style={{
                height: "55px",
                background: "rgba(0,0,0,0.4)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "white",
                padding: "0 1.2rem",
                borderRadius: "12px",
                fontSize: "1rem",
                fontWeight: 700,
              }}
            >
              <option value="">Selecciona jornada...</option>
              {jornadas.map((j) => (
                <option key={j.id} value={j.id}>
                  Jornada {j.numero}
                </option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Nº"
              value={numJornada}
              onChange={(e) => setNumJornada(e.target.value)}
              style={{
                height: "55px",
                padding: "0 1rem",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "white",
                fontSize: "1rem",
                borderRadius: "12px",
                textAlign: "center",
              }}
            />
            <button
              onClick={handleCreateJornada}
              className="btn-primary"
              style={{
                height: "55px",
                borderRadius: "12px",
                fontSize: "1.5rem",
              }}
            >
              +
            </button>
            {selectedJornada && (
              <button
                onClick={() => handleDeleteJornada(selectedJornada)}
                disabled={loading}
                className="btn-delete-icon"
                style={{
                  height: "55px",
                  borderRadius: "12px",
                  fontSize: "1.2rem",
                  width: "100%",
                  opacity: loading ? 0.6 : 1,
                }}
              >
                🗑️
              </button>
            )}
          </div>
        </div>
      </div>

      {/* CUERPO PRINCIPAL: PARTIDOS */}
      <div style={{ width: "100%" }}>
        {selectedJornada ? (
          <>
            {/* Creador de Partidos */}
            <form
              onSubmit={handleAddPartido}
              className="form-grid-4"
              style={{
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%)",
                padding: "2rem",
                borderRadius: "20px",
                marginBottom: "3rem",
                border: "1px solid rgba(255,255,255,0.05)",
                alignItems: "flex-end",
                gap: "1.5rem",
              }}
            >
              <div className="input-group">
                <label style={{ marginBottom: "0.8rem" }}>Equipo Local</label>
                <select
                  value={localId}
                  onChange={(e) => setLocalId(e.target.value)}
                  required
                  style={{
                    height: "50px",
                    background: "rgba(0,0,0,0.5)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "white",
                    padding: "0 1rem",
                    borderRadius: "10px",
                    width: "100%",
                  }}
                >
                  <option value="">Selecciona...</option>
                  {availableForLocal.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <label style={{ marginBottom: "0.8rem" }}>
                  Equipo Visitante
                </label>
                <select
                  value={visitanteId}
                  onChange={(e) => setVisitanteId(e.target.value)}
                  required
                  style={{
                    height: "50px",
                    background: "rgba(0,0,0,0.5)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "white",
                    padding: "0 1rem",
                    borderRadius: "10px",
                    width: "100%",
                  }}
                >
                  <option value="">Selecciona...</option>
                  {availableForVisitor.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <label style={{ marginBottom: "0.8rem" }}>
                  Estadio / Campo
                </label>
                <select
                  value={campoId}
                  onChange={(e) => setCampoId(e.target.value)}
                  style={{
                    height: "50px",
                    background: "rgba(0,0,0,0.5)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "white",
                    padding: "0 1rem",
                    borderRadius: "10px",
                    width: "100%",
                  }}
                >
                  <option value="">Selecciona campo...</option>
                  {campos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} ({c.poblacion})
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={loading}
                style={{
                  height: "50px",
                  background: "var(--primary)",
                  color: "black",
                  fontWeight: 900,
                  borderRadius: "10px",
                  cursor: "pointer",
                  border: "none",
                  width: "100%",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                }}
              >
                + Añadir Partido
              </button>
            </form>

            <form
              onSubmit={handleAddDescanso}
              style={{
                background: "rgba(139, 92, 246, 0.06)",
                padding: "1.5rem 2rem",
                borderRadius: "16px",
                marginBottom: "2rem",
                border: "1px solid rgba(139, 92, 246, 0.2)",
                display: "flex",
                flexWrap: "wrap",
                alignItems: "flex-end",
                gap: "1rem",
              }}
            >
              <div className="input-group" style={{ flex: "1 1 280px" }}>
                <label
                  style={{
                    marginBottom: "0.5rem",
                    display: "block",
                    fontWeight: 800,
                    color: "#a78bfa",
                  }}
                >
                  🛌 Equipo que descansa esta jornada
                </label>
                <select
                  value={descansoEquipoId}
                  onChange={(e) => setDescansoEquipoId(e.target.value)}
                  style={{
                    height: "48px",
                    background: "rgba(0,0,0,0.5)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "white",
                    padding: "0 1rem",
                    borderRadius: "10px",
                    width: "100%",
                  }}
                >
                  <option value="">Selecciona equipo...</option>
                  {availableForRest.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={loading || !descansoEquipoId}
                style={{
                  height: "48px",
                  background: "rgba(139, 92, 246, 0.35)",
                  color: "#e9d5ff",
                  fontWeight: 800,
                  borderRadius: "10px",
                  border: "1px solid rgba(139, 92, 246, 0.4)",
                  padding: "0 1.5rem",
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                + Marcar descanso
              </button>
              {descansos.length > 0 && (
                <div
                  style={{
                    width: "100%",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.5rem",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: "#888",
                      fontWeight: 700,
                    }}
                  >
                    Descansan:
                  </span>
                  {descansos.map((d) => (
                    <span
                      key={d.id}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        background: "rgba(0,0,0,0.35)",
                        padding: "0.35rem 0.65rem",
                        borderRadius: "8px",
                        fontSize: "0.85rem",
                      }}
                    >
                      {getTeamName(d.equipo_id)}
                      <button
                        type="button"
                        onClick={() => handleRemoveDescanso(d.id)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#f87171",
                          cursor: "pointer",
                          padding: 0,
                          lineHeight: 1,
                        }}
                        title="Quitar"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </form>

            {/* Listado de Partidos */}
            <div
              style={{ display: "flex", flexDirection: "column", gap: "2rem" }}
            >
              {partidos.length === 0 && (
                <p
                  style={{
                    color: "#666",
                    textAlign: "center",
                    padding: "4rem",
                    background: "rgba(255,255,255,0.01)",
                    borderRadius: "20px",
                    border: "1px dashed rgba(255,255,255,0.1)",
                  }}
                >
                  No hay partidos registrados en esta jornada.
                </p>
              )}

              {partidos.map((p) => {
                const localName = getTeamName(p.equipo_local_id);
                const visName = getTeamName(p.equipo_visitante_id);
                const localShield = getTeamShield(p.equipo_local_id);
                const visShield = getTeamShield(p.equipo_visitante_id);

                return (
                  <div
                    key={p.id}
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      padding: "2.5rem",
                      borderRadius: "24px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "2.5rem",
                      border: "1px solid rgba(255,255,255,0.05)",
                      boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "2rem",
                        width: "100%",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "1.5rem",
                          flex: 1,
                          justifyContent: "flex-end",
                          textAlign: "right",
                        }}
                      >
                        <span style={{ fontSize: "1.4rem", fontWeight: 800 }}>
                          {localName}
                        </span>
                        {localShield && (
                          <img
                            src={localShield}
                            alt=""
                            style={{
                              width: 50,
                              height: 50,
                              objectFit: "contain",
                            }}
                          />
                        )}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "1.5rem",
                          background: "rgba(0,0,0,0.5)",
                          padding: "1rem 2rem",
                          borderRadius: "20px",
                          border: "1px solid rgba(255,255,255,0.05)",
                        }}
                      >
                        <input
                          type="number"
                          value={toGoalInputValue(p.goles_local)}
                          onChange={(e) => {
                            const val = parseGoalInput(e.target.value);
                            setPartidos((prev) =>
                              prev.map((pt) =>
                                pt.id === p.id
                                  ? { ...pt, goles_local: val }
                                  : pt,
                              ),
                            );
                          }}
                          style={{
                            width: "80px",
                            height: "60px",
                            background: "rgba(255,255,255,0.03)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            color: "white",
                            fontWeight: 900,
                            textAlign: "center",
                            fontSize: "2.5rem",
                            borderRadius: "12px",
                          }}
                        />
                        <span
                          style={{
                            color: "var(--primary)",
                            fontWeight: 900,
                            fontSize: "2rem",
                          }}
                        >
                          -
                        </span>
                        <input
                          type="number"
                          value={toGoalInputValue(p.goles_visitante)}
                          onChange={(e) => {
                            const val = parseGoalInput(e.target.value);
                            setPartidos((prev) =>
                              prev.map((pt) =>
                                pt.id === p.id
                                  ? { ...pt, goles_visitante: val }
                                  : pt,
                              ),
                            );
                          }}
                          style={{
                            width: "80px",
                            height: "60px",
                            background: "rgba(255,255,255,0.03)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            color: "white",
                            fontWeight: 900,
                            textAlign: "center",
                            fontSize: "2.5rem",
                            borderRadius: "12px",
                          }}
                        />
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "1.5rem",
                          flex: 1,
                        }}
                      >
                        {visShield && (
                          <img
                            src={visShield}
                            alt=""
                            style={{
                              width: 50,
                              height: 50,
                              objectFit: "contain",
                            }}
                          />
                        )}
                        <span style={{ fontSize: "1.4rem", fontWeight: 800 }}>
                          {visName}
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 160px auto auto",
                        alignItems: "flex-end",
                        gap: "1.5rem",
                        background: "rgba(255,255,255,0.01)",
                        padding: "2rem",
                        borderRadius: "16px",
                        border: "1px solid rgba(255,255,255,0.03)",
                      }}
                    >
                      <div className="input-group">
                        <label
                          style={{
                            fontSize: "0.7rem",
                            color: "#666",
                            fontWeight: 800,
                            textTransform: "uppercase",
                            marginBottom: "0.6rem",
                            display: "block",
                          }}
                        >
                          🏟️ Campo / Estadio
                        </label>
                        <select
                          value={p.campo_id || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPartidos((prev) =>
                              prev.map((pt) =>
                                pt.id === p.id ? { ...pt, campo_id: val } : pt,
                              ),
                            );
                          }}
                          style={{
                            height: "45px",
                            background: "rgba(0,0,0,0.3)",
                            color: "white",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: "8px",
                            padding: "0 1rem",
                            fontSize: "0.95rem",
                            width: "100%",
                          }}
                        >
                          <option value="">Sin asignar</option>
                          {campos.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nombre}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="input-group">
                        <label
                          style={{
                            fontSize: "0.7rem",
                            color: "#666",
                            fontWeight: 800,
                            textTransform: "uppercase",
                            marginBottom: "0.6rem",
                            display: "block",
                          }}
                        >
                          ⏰ Fecha y Hora
                        </label>
                        <input
                          type="datetime-local"
                          value={p.fecha ? p.fecha.substring(0, 16) : ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPartidos((prev) =>
                              prev.map((pt) =>
                                pt.id === p.id ? { ...pt, fecha: val } : pt,
                              ),
                            );
                          }}
                          style={{
                            height: "45px",
                            background: "rgba(0,0,0,0.3)",
                            color: "white",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: "8px",
                            padding: "0 1rem",
                            fontSize: "0.95rem",
                            width: "100%",
                          }}
                        />
                      </div>

                      <div className="input-group">
                        <label
                          style={{
                            fontSize: "0.7rem",
                            color: "#666",
                            fontWeight: 800,
                            textTransform: "uppercase",
                            marginBottom: "0.6rem",
                            display: "block",
                          }}
                        >
                          🏁 Estado
                        </label>
                        <select
                          value={p.estado}
                          onChange={(e) =>
                            updatePartidoState(p.id, "estado", e.target.value)
                          }
                          style={{
                            height: "45px",
                            padding: "0 1rem",
                            borderRadius: "8px",
                            background:
                              p.estado === "finalizado"
                                ? "#10b981"
                                : p.estado === "en_juego"
                                  ? "#ef4444"
                                  : "rgba(255,255,255,0.1)",
                            color: "black",
                            fontWeight: 900,
                            border: "none",
                            fontSize: "0.9rem",
                            width: "100%",
                          }}
                        >
                          <option value="programado">Programado</option>
                          <option value="en_juego">En Juego</option>
                          <option value="finalizado">Finalizado</option>
                        </select>
                      </div>

                      <button
                        disabled={!!rowBusy[p.id]}
                        onClick={async () => {
                          setRowBusy((prev) => ({ ...prev, [p.id]: true }));
                          const { error } = await supabase
                            .from("partidos_liga")
                            .update({
                              goles_local:
                                typeof p.goles_local === "number"
                                  ? p.goles_local
                                  : null,
                              goles_visitante:
                                typeof p.goles_visitante === "number"
                                  ? p.goles_visitante
                                  : null,
                              fecha: p.fecha
                                ? new Date(p.fecha).toISOString()
                                : null,
                              campo_id: p.campo_id,
                            })
                            .eq("id", p.id);
                          if (!error) showToast("Cambios guardados");
                          setRowBusy((prev) => ({ ...prev, [p.id]: false }));
                        }}
                        style={{
                          height: "45px",
                          background: "var(--primary)",
                          border: "none",
                          color: "black",
                          padding: "0 2rem",
                          borderRadius: "8px",
                          fontWeight: 900,
                          cursor: "pointer",
                          opacity: rowBusy[p.id] ? 0.7 : 1,
                        }}
                      >
                        {rowBusy[p.id] ? "Guardando..." : "Guardar"}
                      </button>

                      <button
                        disabled={!!rowBusy[p.id]}
                        onClick={() => handleDeletePartido(p.id)}
                        style={{
                          height: "45px",
                          background: "rgba(239, 68, 68, 0.1)",
                          border: "1px solid rgba(239, 68, 68, 0.2)",
                          color: "#ef4444",
                          padding: "0 1rem",
                          borderRadius: "8px",
                          cursor: "pointer",
                          transition: "all 0.2s",
                          opacity: rowBusy[p.id] ? 0.6 : 1,
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "400px",
              color: "#444",
              background: "rgba(255,255,255,0.01)",
              borderRadius: "30px",
              border: "2px dashed rgba(255,255,255,0.05)",
            }}
          >
            <svg
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              style={{ marginBottom: "1.5rem", opacity: 0.2 }}
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#666" }}>
              Panel de Control de Jornadas
            </h3>
            <p style={{ marginTop: "0.5rem" }}>
              Selecciona una jornada arriba para gestionar el calendario y los
              resultados.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
