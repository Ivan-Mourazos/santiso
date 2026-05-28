"use client";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase-browser";
import BusyBanner from "./BusyBanner";
import {
  competitionsForCategory,
  pickDefaultCompetitionId,
  type CompetenciaRow,
} from "@/lib/competition";
import {
  fetchCompeticiones,
  fetchMatchdaysForCompetition,
  fetchMatchesForMatchday,
  fetchSeasons,
  fetchTeamsForCompetition,
  mergeMissingTeams,
} from "@/lib/supabase-queries";
import { useCompeticiones } from "@/lib/useCompeticiones";
import {
  matchDateTimeLocalInput,
  matchLocalDateTimeToIso,
} from "./cartel/matchDateTime";

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
  const {
    competicionesCatalog,
    selectedCompetitionId,
    setSelectedCompetitionId,
    competicionesEnCategoria,
    addCompeticion,
    removeCompeticion,
  } = useCompeticiones(categoria);

  const [nuevaCompeticionNombre, setNuevaCompeticionNombre] = useState("");
  const [nuevoFormato, setNuevoFormato] = useState("liga");
  const [showNewCompeticion, setShowNewCompeticion] = useState(false);

  // New Matchday form
  const [numJornada, setNumJornada] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [nombreFase, setNombreFase] = useState("");
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

  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [showLeagueRules, setShowLeagueRules] = useState(false);
  const [bulkCount, setBulkCount] = useState(30);

  // Reglas de desarrollo de liga (flexibles)
  interface LeagueRule {
    id: string;
    nombre: string;
    puestos: number[];
    color: string;
  }
  const [leagueRules, setLeagueRules] = useState<LeagueRule[]>([]);
  const [savingRules, setSavingRules] = useState(false);
  const [newRule, setNewRule] = useState<Omit<LeagueRule, "id">>({
    nombre: "",
    puestos: [],
    color: "#10b981",
  });
  const [ruleFormPuestos, setRuleFormPuestos] = useState("");

  // Colores predefinidos para elegir
  const colorPalette = [
    "#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#ec4899",
    "#8b5cf6", "#06b6d4", "#f97316", "#14b8a6", "#6366f1",
  ];

  const selectedCompeticionNombre = useMemo(
    () =>
      competicionesCatalog.find((c) => c.id === selectedCompetitionId)?.nombre ??
      "",
    [competicionesCatalog, selectedCompetitionId],
  );

  // Cargar reglas de liga existentes
  useEffect(() => {
    if (!temporadaActiva || !selectedCompetitionId) return;
    async function load() {
      const { data } = await supabase
        .from("reglas_liga")
        .select("*")
        .eq("temporada_id", temporadaActiva.id)
        .eq("categoria", categoria)
        .eq("competicion_id", selectedCompetitionId)
        .maybeSingle();
      if (data?.reglas) {
        setLeagueRules(Array.isArray(data.reglas) ? data.reglas : []);
      } else {
        setLeagueRules([]);
      }
    }
    load();
  }, [temporadaActiva, selectedCompetitionId, categoria]);

  async function handleSaveLeagueRules() {
    if (!temporadaActiva) return;
    if (!selectedCompetitionId) {
      showToast("Selecciona una competición", "error");
      return;
    }
    setSavingRules(true);

    const basePayload = {
      temporada_id: temporadaActiva.id,
      categoria,
      competicion_id: selectedCompetitionId,
      reglas: leagueRules,
    };

    const { data: existing, error: findError } = await supabase
      .from("reglas_liga")
      .select("id")
      .eq("temporada_id", temporadaActiva.id)
      .eq("categoria", categoria)
      .eq("competicion_id", selectedCompetitionId)
      .maybeSingle();

    if (findError) {
      showToast("Error al guardar reglas: " + findError.message, "error");
      setSavingRules(false);
      return;
    }

    const { error } = existing?.id
      ? await supabase
          .from("reglas_liga")
          .update({ reglas: leagueRules })
          .eq("id", existing.id)
      : await supabase.from("reglas_liga").insert([basePayload]);

    if (!error) showToast("Reglas de liga guardadas");
    else showToast("Error al guardar reglas: " + error.message, "error");
    setSavingRules(false);
  }

  function addRule() {
    if (!newRule.nombre.trim()) return;
    const puestos = ruleFormPuestos
      .split(",")
      .map((s) => parseInt(s.trim()))
      .filter((n) => !isNaN(n) && n > 0);
    if (puestos.length === 0) return;

    setLeagueRules((prev) => [
      ...prev,
      { ...newRule, id: crypto.randomUUID(), puestos },
    ]);
    setNewRule({ nombre: "", puestos: [], color: "#10b981" });
    setRuleFormPuestos("");
  }

  function removeRule(id: string) {
    setLeagueRules((prev) => prev.filter((r) => r.id !== id));
  }

  function updateRule(id: string, field: keyof LeagueRule, value: string | number[]) {
    setLeagueRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    );
  }

  useEffect(() => {
    fetchBaseData();
  }, [categoria, selectedCompetitionId]);

  async function fetchBaseData() {
    setIsFetching(true);
    const [{ data: tData, active }, eData] = await Promise.all([
      fetchSeasons(),
      selectedCompetitionId
        ? fetchTeamsForCompetition(categoria, selectedCompetitionId)
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
  }, [temporadaActiva, categoria, selectedCompetitionId]);

  async function fetchJornadas() {
    if (!temporadaActiva?.id || !selectedCompetitionId) {
      setJornadas([]);
      setIsFetching(false);
      return;
    }
    setIsFetching(true);
    const { data, error } = await fetchMatchdaysForCompetition(
      temporadaActiva.id,
      categoria,
      selectedCompetitionId,
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
  }, [selectedJornada, selectedCompetitionId, categoria]);

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
    if (!selectedJornada || !selectedCompetitionId) {
      setPartidos([]);
      setIsFetching(false);
      return;
    }

    const { data, error } = await fetchMatchesForMatchday(
      selectedJornada,
      categoria,
      selectedCompetitionId,
    );
    if (error) showToast("Error cargando partidos: " + error.message, "error");
    setPartidos(data);
    setIsFetching(false);
  }

  async function handleCreateJornada(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!temporadaActiva) return showToast("No hay temporada activa", "error");
    if (!selectedCompetitionId)
      return showToast("Selecciona una competición", "error");
    setBusyText("Creando jornada...");
    setLoading(true);
    const payload: any = {
      temporada_id: temporadaActiva.id,
      categoria,
      numero: parseInt(numJornada),
      fecha_inicio: fechaInicio || null,
      competicion_id: selectedCompetitionId,
      nombre_fase: nombreFase.trim() || null,
    };
    const { error } = await supabase.from("jornadas").insert([payload]);
    if (!error) {
      showToast("Jornada creada");
      setNumJornada("");
      setNombreFase("");
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
    if (!selectedCompetitionId)
      return showToast("Selecciona una competición", "error");
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
      competicion_id: selectedCompetitionId,
      equipo_local_id: localId,
      equipo_visitante_id: visitanteId,
      goles_local: null,
      goles_visitante: null,
      fecha: matchLocalDateTimeToIso(fechaPartido),
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
    if (!temporadaActiva || !selectedCompetitionId) return;
    setBusyText(`Verificando jornadas existentes...`);
    setLoading(true);

    try {
      const { data: existing } = await supabase
        .from("jornadas")
        .select("numero")
        .eq("temporada_id", temporadaActiva.id)
        .eq("categoria", categoria)
        .eq("competicion_id", selectedCompetitionId);

      const existingNums = new Set(
        existing?.map((j: { numero: number }) => j.numero) || [],
      );
      
      // 2. Filtrar las que faltan de 1..bulkCount
      const toInsert = [];
      for (let i = 1; i <= bulkCount; i++) {
        if (!existingNums.has(i)) {
          toInsert.push({
            temporada_id: temporadaActiva.id,
            categoria,
            competicion_id: selectedCompetitionId,
            numero: i,
          });
        }
      }

      if (toInsert.length === 0) {
        showToast("Las jornadas ya estaban creadas");
        setShowConfigPanel(false);
        setLoading(false);
        return;
      }

      setBusyText(`Insertando ${toInsert.length} nuevas jornadas...`);
      const { error } = await supabase.from("jornadas").insert(toInsert);
      
      if (error) throw error;

      showToast(`Generadas ${toInsert.length} jornadas faltantes`);
      setShowConfigPanel(false);
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
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <select
                value={selectedCompetitionId}
                onChange={(e) => {
                  setSelectedJornada(null);
                  setPartidos([]);
                  setDescansos([]);
                  setSelectedCompetitionId(e.target.value);
                }}
                disabled={loading || isFetching}
                style={{ flex: 1, height: "48px", background: "rgba(0,0,0,0.4)", borderRadius: "10px", fontWeight: 600 }}
              >
                {competicionesEnCategoria.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
              {showNewCompeticion && (
                <>
                  <input
                    type="text"
                    placeholder="Nombre..."
                    value={nuevaCompeticionNombre}
                    onChange={(e) => setNuevaCompeticionNombre(e.target.value)}
                    autoFocus
                    style={{ width: "100px", height: "48px", borderRadius: "10px", background: "rgba(250,204,21,0.05)", border: "1px solid rgba(250,204,21,0.2)" }}
                  />
                  <select
                    value={nuevoFormato}
                    onChange={(e) => setNuevoFormato(e.target.value)}
                    style={{ width: "100px", height: "48px", borderRadius: "10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white" }}
                  >
                    <option value="liga">Liga</option>
                    <option value="eliminatoria">Copa</option>
                  </select>
                </>
              )}
              <button
                onClick={async () => {
                  if (showNewCompeticion && nuevaCompeticionNombre.trim()) {
                    setLoading(true);
                    const { error } = await addCompeticion(nuevaCompeticionNombre, categoria, nuevoFormato);
                    setLoading(false);
                    if (error) showToast("Error: " + error.message, "error");
                    else {
                      showToast("Competición añadida");
                      setNuevaCompeticionNombre("");
                      setNuevoFormato("liga");
                      setShowNewCompeticion(false);
                    }
                  } else {
                    setShowNewCompeticion((v) => !v);
                  }
                }}
                className="btn-primary"
                style={{ height: "48px", width: "48px", borderRadius: "10px", flexShrink: 0 }}
              >
                {showNewCompeticion ? "✓" : "+"}
              </button>
              {selectedCompetitionId && competicionesEnCategoria.length > 1 && (
                <button
                  onClick={() => {
                    const compName = competicionesEnCategoria.find(c => c.id === selectedCompetitionId)?.nombre;
                    showConfirm(`¿Eliminar la competición "${compName}" de esta categoría?`, async () => {
                      setLoading(true);
                      const { error } = await removeCompeticion(selectedCompetitionId);
                      setLoading(false);
                      if (error) showToast("Error: " + error.message, "error");
                      else showToast("Competición eliminada");
                    });
                  }}
                  className="btn-delete"
                  title="Eliminar Competición"
                  style={{ height: "48px", width: "48px", borderRadius: "10px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Botones de configuración */}
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end" }}>
            <button 
              className="btn-secondary" 
              onClick={() => { setShowConfigPanel(v => !v); setShowLeagueRules(false); }}
              style={{ height: "48px", padding: "0 1.2rem", borderRadius: "10px", display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 700, fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
              {showConfigPanel ? "▲ Cerrar" : "Jornadas"}
            </button>
            <button 
              className="btn-secondary" 
              onClick={() => { setShowLeagueRules(v => !v); setShowConfigPanel(false); }}
              style={{ height: "48px", padding: "0 1.2rem", borderRadius: "10px", display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 700, fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>
              {showLeagueRules ? "▲ Cerrar" : "Reglas Liga"}
            </button>
          </div>
        </div>

        {/* PANEL DESPLEGABLE: CONFIGURAR JORNADAS */}
        {showConfigPanel && (
          <div
            style={{
              background: "linear-gradient(180deg, rgba(250,204,21,0.04) 0%, rgba(255,255,255,0.01) 100%)",
              padding: "2rem",
              borderRadius: "18px",
              border: "1px solid rgba(250,204,21,0.15)",
              marginBottom: "1rem",
              animation: "slideDown 0.25s ease-out",
            }}
          >
            <h3 style={{ color: "var(--primary)", marginBottom: "0.5rem", fontSize: "1rem", fontWeight: 800 }}>Configurar Jornadas</h3>
            <p style={{ color: "#888", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
              Se generarán jornadas vacías para <strong>{selectedCompeticionNombre}</strong> en la temporada activa.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "1rem", alignItems: "flex-end" }}>
              <div className="input-group">
                <label style={{ fontSize: "0.75rem", fontWeight: 800, color: "#666", textTransform: "uppercase" }}>Número de Jornadas</label>
                <input 
                  type="number" 
                  value={bulkCount}
                  onChange={e => setBulkCount(parseInt(e.target.value) || 0)}
                  style={{ width: "100%", height: "50px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", color: "white", padding: "0 1rem", fontSize: "1.2rem", fontWeight: 800 }}
                />
              </div>
              <button 
                className="btn-secondary" 
                onClick={() => setShowConfigPanel(false)}
                style={{ height: "50px", padding: "0 1.5rem", borderRadius: "12px", fontWeight: 700 }}
              >
                Cancelar
              </button>
              <button 
                className="btn-primary" 
                onClick={async () => {
                  await handleBulkCreateJornadas();
                  setShowConfigPanel(false);
                }} 
                disabled={loading || bulkCount <= 0} 
                style={{ height: "50px", padding: "0 1.5rem", borderRadius: "12px", fontWeight: 800 }}
              >
                {loading ? "Generando..." : "Generar Jornadas"}
              </button>
            </div>
          </div>
        )}

        {/* PANEL DESPLEGABLE: REGLAS DE DESARROLLO DE LIGA */}
        {showLeagueRules && (
          <div
            style={{
              background: "linear-gradient(180deg, rgba(139,92,246,0.06) 0%, rgba(255,255,255,0.01) 100%)",
              padding: "2rem",
              borderRadius: "18px",
              border: "1px solid rgba(139,92,246,0.2)",
              marginBottom: "1rem",
              animation: "slideDown 0.25s ease-out",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
              <div>
                <h3 style={{ color: "#a78bfa", marginBottom: "0.3rem", fontSize: "1rem", fontWeight: 800 }}>
                  🏆 Reglas de Desarrollo de Liga
                </h3>
                <p style={{ color: "#888", fontSize: "0.85rem", margin: 0 }}>
                  Crea reglas personalizadas con nombre, puestos y color para <strong>{selectedCompeticionNombre}</strong>.
                </p>
              </div>
              <button
                className="btn-primary"
                onClick={handleSaveLeagueRules}
                disabled={savingRules}
                style={{ height: "44px", padding: "0 1.5rem", borderRadius: "10px", fontWeight: 800, fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.5px", flexShrink: 0 }}
              >
                {savingRules ? "Guardando..." : "Guardar Todo"}
              </button>
            </div>

            {/* FORMULARIO AÑADIR REGLA */}
            <div
              style={{
                background: "rgba(0,0,0,0.25)",
                padding: "1.5rem",
                borderRadius: "14px",
                border: "1px dashed rgba(139,92,246,0.3)",
                display: "grid",
                gridTemplateColumns: "1fr 1fr 120px auto",
                gap: "1rem",
                alignItems: "flex-end",
                marginBottom: "1.5rem",
              }}
            >
              <div className="input-group">
                <label style={{ fontSize: "0.7rem", fontWeight: 800, color: "#a78bfa", textTransform: "uppercase", marginBottom: "0.4rem", display: "block" }}>
                  Nombre de la regla
                </label>
                <input
                  type="text"
                  placeholder="Ej: Campeón, Ascenso directo, Promoción..."
                  value={newRule.nombre}
                  onChange={(e) => setNewRule((prev) => ({ ...prev, nombre: e.target.value }))}
                  style={{ width: "100%", height: "44px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", color: "white", padding: "0 1rem", fontSize: "0.9rem" }}
                />
              </div>

              <div className="input-group">
                <label style={{ fontSize: "0.7rem", fontWeight: 800, color: "#a78bfa", textTransform: "uppercase", marginBottom: "0.4rem", display: "block" }}>
                  Puestos (separados por coma)
                </label>
                <input
                  type="text"
                  placeholder="Ej: 1  o  2,3,4"
                  value={ruleFormPuestos}
                  onChange={(e) => setRuleFormPuestos(e.target.value)}
                  style={{ width: "100%", height: "44px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", color: "white", padding: "0 1rem", fontSize: "0.9rem" }}
                />
              </div>

              <div className="input-group">
                <label style={{ fontSize: "0.7rem", fontWeight: 800, color: "#a78bfa", textTransform: "uppercase", marginBottom: "0.4rem", display: "block" }}>
                  Color
                </label>
                <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap", marginBottom: "0.4rem" }}>
                  {colorPalette.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewRule((prev) => ({ ...prev, color }))}
                      style={{
                        width: "22px",
                        height: "22px",
                        borderRadius: "6px",
                        background: color,
                        border: newRule.color === color ? "2px solid white" : "2px solid transparent",
                        cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                    />
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "6px",
                      background: newRule.color,
                      border: "1px solid rgba(255,255,255,0.2)",
                      flexShrink: 0,
                    }}
                  />
                  <input
                    type="text"
                    value={newRule.color}
                    onChange={(e) => setNewRule((prev) => ({ ...prev, color: e.target.value }))}
                    style={{ flex: 1, height: "32px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "white", padding: "0 0.5rem", fontSize: "0.8rem", fontFamily: "monospace" }}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={addRule}
                className="btn-primary"
                style={{ height: "44px", borderRadius: "10px", fontWeight: 800, fontSize: "0.85rem", padding: "0 1.2rem" }}
              >
                + Añadir
              </button>
            </div>

            {/* LISTA DE REGLAS CREADAS */}
            {leagueRules.length === 0 ? (
              <div style={{ textAlign: "center", padding: "2rem", color: "#666", fontSize: "0.9rem", background: "rgba(0,0,0,0.15)", borderRadius: "12px" }}>
                No hay reglas definidas. Añade la primera arriba.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {leagueRules.map((rule) => (
                  <div
                    key={rule.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "1rem",
                      background: "rgba(0,0,0,0.2)",
                      padding: "0.8rem 1.2rem",
                      borderRadius: "12px",
                      border: `1px solid ${rule.color}22`,
                      borderLeft: `4px solid ${rule.color}`,
                    }}
                  >
                    <div
                      style={{
                        width: "14px",
                        height: "14px",
                        borderRadius: "4px",
                        background: rule.color,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: "0.9rem", color: "white" }}>
                        {rule.nombre}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#888", marginTop: "0.15rem" }}>
                        Puestos: {rule.puestos.sort((a, b) => a - b).join(", ")}
                      </div>
                    </div>
                    <button
                      onClick={() => removeRule(rule.id)}
                      style={{
                        background: "rgba(239,68,68,0.1)",
                        border: "1px solid rgba(239,68,68,0.2)",
                        color: "#f87171",
                        borderRadius: "8px",
                        width: "32px",
                        height: "32px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        fontSize: "1.1rem",
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* LEYENDA PREVIEW */}
            {leagueRules.length > 0 && (
              <div
                style={{
                  marginTop: "1.5rem",
                  background: "rgba(255,255,255,0.02)",
                  padding: "1rem 1.5rem",
                  borderRadius: "12px",
                  border: "1px solid rgba(255,255,255,0.04)",
                  display: "flex",
                  gap: "1.5rem",
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: "0.75rem", color: "#666", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px" }}>
                  Leyenda
                </span>
                {leagueRules.map((rule) => (
                  <span
                    key={rule.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                      fontSize: "0.8rem",
                      color: "#a3a3a3",
                    }}
                  >
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: rule.color }} />
                    {rule.nombre} ({rule.puestos.sort((a, b) => a - b).join(",")})
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

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
              {jornadas.map((j: any) => (
                <option key={j.id} value={j.id}>{j.nombre_fase || `Jornada ${j.numero}`}</option>
              ))}
            </select>
          </div>
          
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {showNewJornada && (
              <>
                <input
                  type="number"
                  placeholder="Nº"
                  value={numJornada}
                  onChange={(e) => setNumJornada(e.target.value)}
                  autoFocus
                  style={{ width: "50px", height: "40px", borderRadius: "8px", background: "rgba(0,0,0,0.3)", textAlign: "center", color: "white" }}
                />
                <input
                  type="text"
                  placeholder="Fase (Ej: Semis)"
                  value={nombreFase}
                  onChange={(e) => setNombreFase(e.target.value)}
                  style={{ width: "130px", height: "40px", borderRadius: "8px", background: "rgba(0,0,0,0.3)", padding: "0 0.5rem", color: "white" }}
                />
              </>
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
            {(() => {
              const currJ = jornadas.find((j: any) => j.id === selectedJornada);
              return currJ ? (
                <h3 style={{ color: "white", marginBottom: "1.5rem", fontSize: "1.5rem", fontWeight: 900 }}>
                  {currJ.nombre_fase || `Jornada ${currJ.numero}`}
                </h3>
              ) : null;
            })()}
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
                          value={matchDateTimeLocalInput(p.fecha)}
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
                              fecha: matchLocalDateTimeToIso(p.fecha),
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
                  onClick={() => setShowConfigPanel(true)}
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

      <style jsx>{`
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
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
