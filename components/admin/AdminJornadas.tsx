"use client";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase-browser";
import BusyBanner from "./BusyBanner";
import { getCompetitionsByCategory, getDefaultUiCompetitionForCategory } from "@/lib/competition";
import {
  fetchMatchdaysForCompetition,
  fetchMatchesForMatchday,
  fetchSeasons,
  fetchTeamsForCompetition,
  mergeMissingTeams,
} from "@/lib/supabase-queries";
import { getCompeticionLabelsForQuery } from "@/lib/competition";

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
  const [showNewJornada, setShowNewJornada] = useState(false);

  // New Season form
  const [nuevaTemporadaNombre, setNuevaTemporadaNombre] = useState("");
  const [showNewTemporada, setShowNewTemporada] = useState(false);

  // New Match form
  const [localId, setLocalId] = useState("");
  const [visitanteId, setVisitanteId] = useState("");
  const [fechaPartido, setFechaPartido] = useState("");
  const [campoId, setCampoId] = useState("");
  const [descansos, setDescansos] = useState<any[]>([]);
  const [descansoEquipoId, setDescansoEquipoId] = useState("");

  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkCount, setBulkCount] = useState(30);

  useEffect(() => {
    fetchBaseData();
  }, [categoria, selectedCompeticion]);

  useEffect(() => {
    const opts = getCompetitionsByCategory(categoria);
    setCompetitions(opts);
    setSelectedCompeticion(getDefaultUiCompetitionForCategory(categoria));
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

  async function handleCreateTemporada(e?: React.FormEvent) {
    if (e) e.preventDefault();
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

  async function handleCreateJornada(e?: React.FormEvent) {
    if (e) e.preventDefault();
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

  async function handleBulkCreateJornadas() {
    if (!temporadaActiva || !selectedCompeticion) return;
    setBusyText(`Verificando jornadas existentes...`);
    setLoading(true);

    try {
      // 1. Obtener jornadas que ya existen (incluyendo aliases históricos)
      const labels = getCompeticionLabelsForQuery(categoria, selectedCompeticion);
      const { data: existing } = await supabase
        .from("jornadas")
        .select("numero")
        .eq("temporada_id", temporadaActiva.id)
        .eq("categoria", categoria)
        .in("competicion", labels);

      const existingNums = new Set(existing?.map(j => j.numero) || []);
      
      // 2. Filtrar las que faltan de 1..bulkCount
      const toInsert = [];
      for (let i = 1; i <= bulkCount; i++) {
        if (!existingNums.has(i)) {
          toInsert.push({
            temporada_id: temporadaActiva.id,
            categoria,
            competicion: selectedCompeticion,
            numero: i,
          });
        }
      }

      if (toInsert.length === 0) {
        showToast("Las jornadas ya estaban creadas");
        setShowBulkModal(false);
        setLoading(false);
        return;
      }

      setBusyText(`Insertando ${toInsert.length} nuevas jornadas...`);
      const { error } = await supabase.from("jornadas").insert(toInsert);
      
      if (error) throw error;

      showToast(`Generadas ${toInsert.length} jornadas faltantes`);
      setShowBulkModal(false);
      fetchJornadas();
    } catch (err: any) {
      showToast("Error al crear jornadas: " + err.message, "error");
    } finally {
      setLoading(false);
    }
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
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
          marginBottom: "3rem",
          paddingBottom: "2rem",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* FILA 1: CONFIGURACIÓN GLOBAL */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "1rem", alignItems: "flex-end" }}>
          {/* Bloque Temporada */}
          <div className="input-group">
            <label style={{ color: "#888", fontWeight: 800, fontSize: "0.7rem", textTransform: "uppercase", marginBottom: "0.6rem", display: "block" }}>
              🏆 Temporada
            </label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <select
                value={temporadaActiva?.id || ""}
                onChange={(e) => toggleTemporadaActiva(e.target.value)}
                style={{ flex: 1, height: "48px", background: "rgba(0,0,0,0.4)", borderRadius: "10px", fontWeight: 600 }}
              >
                {temporadas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre} {t.activa ? "✓" : ""}
                  </option>
                ))}
              </select>
              {showNewTemporada && (
                <input
                  type="text"
                  placeholder="Ej: 26/27"
                  value={nuevaTemporadaNombre}
                  onChange={(e) => setNuevaTemporadaNombre(e.target.value)}
                  autoFocus
                  style={{ width: "100px", height: "48px", borderRadius: "10px", background: "rgba(250,204,21,0.05)", border: "1px solid rgba(250,204,21,0.2)" }}
                />
              )}
              <button
                onClick={() => {
                  if (showNewTemporada && nuevaTemporadaNombre.trim()) {
                    handleCreateTemporada();
                    setShowNewTemporada(false);
                  } else {
                    setShowNewTemporada((v) => !v);
                  }
                }}
                className="btn-primary"
                style={{ height: "48px", width: "48px", borderRadius: "10px", flexShrink: 0 }}
              >
                {showNewTemporada ? "✓" : "+"}
              </button>
            </div>
          </div>

          {/* Bloque Competición */}
          <div className="input-group">
            <label style={{ color: "#888", fontWeight: 800, fontSize: "0.7rem", textTransform: "uppercase", marginBottom: "0.6rem", display: "block" }}>
              ⚔️ Competición
            </label>
            <select
              value={selectedCompeticion}
              onChange={(e) => {
                setSelectedJornada(null);
                setPartidos([]);
                setDescansos([]);
                setSelectedCompeticion(e.target.value);
              }}
              disabled={loading || isFetching}
              style={{ height: "48px", background: "rgba(0,0,0,0.4)", borderRadius: "10px", fontWeight: 600 }}
            >
              {competitions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Botón Configuración */}
          <button 
            className="btn-secondary" 
            onClick={() => setShowBulkModal(true)}
            style={{ height: "48px", padding: "0 1.2rem", borderRadius: "10px", display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 700, fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.5px" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
            Configurar Liga
          </button>
        </div>

        {/* FILA 2: SELECCIÓN DE JORNADA */}
        <div style={{ background: "rgba(255,255,255,0.02)", padding: "1.2rem", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.8rem", flex: 1 }}>
            <span style={{ fontSize: "1.2rem" }}>📅</span>
            <select
              value={selectedJornada || ""}
              onChange={(e) => setSelectedJornada(e.target.value)}
              style={{ flex: 1, height: "45px", background: "none", border: "none", fontSize: "1.1rem", fontWeight: 800, color: "var(--primary)" }}
            >
              <option value="">Selecciona una jornada...</option>
              {jornadas.map((j) => (
                <option key={j.id} value={j.id}>Jornada {j.numero}</option>
              ))}
            </select>
          </div>
          
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {showNewJornada && (
              <input
                type="number"
                placeholder="Nº"
                value={numJornada}
                onChange={(e) => setNumJornada(e.target.value)}
                autoFocus
                style={{ width: "60px", height: "40px", borderRadius: "8px", background: "rgba(0,0,0,0.3)", textAlign: "center" }}
              />
            )}
            <button
              onClick={() => {
                if (showNewJornada && numJornada.trim()) {
                  handleCreateJornada();
                  setShowNewJornada(false);
                } else {
                  setShowNewJornada((v) => !v);
                }
              }}
              className="btn-primary"
              style={{ height: "40px", width: "40px", borderRadius: "8px", fontSize: "1.1rem" }}
            >
              {showNewJornada ? "✓" : "+"}
            </button>
            {selectedJornada && (
              <button
                onClick={() => handleDeleteJornada(selectedJornada)}
                style={{ height: "40px", width: "40px", borderRadius: "8px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}
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
              background: "rgba(255,255,255,0.01)",
              borderRadius: "24px",
              border: "1px solid rgba(255,255,255,0.03)",
              gap: "1.5rem",
              textAlign: "center",
              padding: "2rem"
            }}
          >
            <div style={{ width: "80px", height: "80px", background: "rgba(255,255,255,0.03)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "0.5rem" }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5">
                <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/>
              </svg>
            </div>
            {jornadas.length === 0 && !isFetching ? (
              <>
                <div style={{ maxWidth: "300px" }}>
                  <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "white", margin: "0 0 0.5rem 0" }}>Sin jornadas</h3>
                  <p style={{ margin: 0, fontSize: "0.9rem", color: "#666", lineHeight: "1.5" }}>
                    Esta competición aún no tiene jornadas registradas en la temporada activa.
                  </p>
                </div>
                <button
                  onClick={() => setShowBulkModal(true)}
                  className="btn-primary"
                  style={{ padding: "0.8rem 2rem", borderRadius: "12px", fontSize: "0.9rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1px" }}
                >
                  🚀 Configurar jornadas ahora
                </button>
              </>
            ) : (
              <div style={{ maxWidth: "300px" }}>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "white", margin: "0 0 0.5rem 0" }}>Selecciona una jornada</h3>
                <p style={{ margin: 0, fontSize: "0.9rem", color: "#666", lineHeight: "1.5" }}>
                  Elige una jornada en el selector superior para gestionar sus partidos y resultados.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL CONFIGURACIÓN LIGA (BULK JORNADAS) */}
      {showBulkModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <h3 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>Configurar Competición</h3>
            <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: '2rem' }}>
              Se generarán jornadas vacías para <strong>{selectedCompeticion}</strong> en la temporada activa.
            </p>

            <div className="input-group" style={{ marginBottom: '2rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#666', textTransform: 'uppercase' }}>Número de Jornadas</label>
              <input 
                type="number" 
                value={bulkCount}
                onChange={e => setBulkCount(parseInt(e.target.value) || 0)}
                style={{ width: '100%', height: '50px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white', padding: '0 1rem', fontSize: '1.2rem', fontWeight: 800 }}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn-secondary" onClick={() => setShowBulkModal(false)} style={{ flex: 1, height: '48px' }}>Cancelar</button>
              <button className="btn-primary" onClick={handleBulkCreateJornadas} disabled={loading || bulkCount <= 0} style={{ flex: 1, height: '48px' }}>
                {loading ? "Generando..." : "Generar Jornadas"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.85);
          backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
        }
        .modal-content {
          background: #111;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 24px;
          padding: 2.5rem;
          width: 90%;
          box-shadow: 0 40px 80px rgba(0,0,0,0.5);
        }
        .control-group {
          background: rgba(255,255,255,0.02);
          padding: 1.5rem;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.05);
        }
        .form-grid-4 {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        }
      `}</style>
    </div>
  );
}
