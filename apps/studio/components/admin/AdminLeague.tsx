"use client";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase-browser";
import BusyBanner from "./BusyBanner";
import {
  competitionsForCategory,
  pickDefaultCompetitionId,
  type CompetenciaRow,
} from "@/lib/competition";
import { fetchCompeticiones, fetchTeamsForCompetition } from "@/lib/supabase-queries";

interface AdminLeagueProps {
  showToast: (msg: string, type?: "success" | "error") => void;
  showConfirm: (msg: string, onConfirm: () => void) => void;
  categoria: string;
}

interface LeagueRule {
  id: string;
  nombre: string;
  puestos: number[];
  color: string;
}

export default function AdminLeague({ showToast, showConfirm, categoria }: AdminLeagueProps) {
  const [equipos, setEquipos] = useState<any[]>([]);
  const [competicionesCatalog, setCompeticionesCatalog] = useState<
    CompetenciaRow[]
  >([]);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState("");
  const [loading, setLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [leagueRules, setLeagueRules] = useState<LeagueRule[]>([]);
  const [temporadaActiva, setTemporadaActiva] = useState<string | null>(null);

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

  const competicionesEnCategoria = useMemo(
    () => competitionsForCategory(competicionesCatalog, categoria),
    [competicionesCatalog, categoria],
  );

  // Cargar temporada activa
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("temporadas")
        .select("id")
        .eq("activa", true)
        .single();
      if (data) setTemporadaActiva(data.id);
    }
    load();
  }, []);

  // Cargar reglas de liga
  useEffect(() => {
    if (!temporadaActiva || !selectedCompetitionId) return;
    async function load() {
      const { data } = await supabase
        .from("reglas_liga")
        .select("reglas")
        .eq("temporada_id", temporadaActiva)
        .eq("categoria", categoria)
        .eq("competicion_id", selectedCompetitionId)
        .maybeSingle();
      if (data?.reglas && Array.isArray(data.reglas)) {
        setLeagueRules(data.reglas as LeagueRule[]);
      } else {
        setLeagueRules([]);
      }
    }
    load();
  }, [temporadaActiva, selectedCompetitionId, categoria]);

  useEffect(() => {
    if (!selectedCompetitionId) return;
    fetchEquipos();
  }, [categoria, selectedCompetitionId]);

  async function fetchEquipos() {
    setIsFetching(true);
    const data = await fetchTeamsForCompetition(categoria, selectedCompetitionId);
    setEquipos(data);
    setIsFetching(false);
  }

  const handleInputChange = (id: string, field: string, value: string) => {
    const numValue = parseInt(value) || 0;
    setEquipos(prev => prev.map(eq => eq.id === id ? { ...eq, [field]: numValue } : eq));
  };

  async function handleSaveLeague() {
    setLoading(true);
    try {
      const updates = equipos.map(eq => 
        supabase.from("equipos").update({
          pts: eq.pts,
          pj: eq.pj,
          pg: eq.pg,
          pe: eq.pe,
          pp: eq.pp,
          gf: eq.gf,
          gc: eq.gc
        }).eq("id", eq.id)
      );

      await Promise.all(updates);
      showToast("Clasificación guardada con éxito");
      fetchEquipos();
    } catch (err) {
      console.error(err);
      showToast("Error al guardar liga", "error");
    } finally {
      setLoading(false);
    }
  }

  // Ordenar equipos por puntos descendente
  const equiposOrdenados = [...equipos].sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    const dgA = (a.gf || 0) - (a.gc || 0);
    const dgB = (b.gf || 0) - (b.gc || 0);
    if (dgB !== dgA) return dgB - dgA;
    return (b.gf || 0) - (a.gf || 0);
  });

  // Buscar la regla que aplica a una posición dada
  function getRuleForPosition(pos: number): LeagueRule | null {
    for (const rule of leagueRules) {
      if (rule.puestos.includes(pos)) return rule;
    }
    return null;
  }

  return (
    <div className="card full-width glass" style={{ marginBottom: '2rem' }}>
      <BusyBanner show={loading || isFetching} text={isFetching ? "Cargando clasificación..." : "Guardando clasificación..."} />
      <div className="input-group" style={{ marginBottom: "1rem", maxWidth: "480px" }}>
        <label>Competición</label>
        <select
          value={selectedCompetitionId}
          onChange={(e) => setSelectedCompetitionId(e.target.value)}
          disabled={loading || isFetching}
        >
          {competicionesEnCategoria.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
      </div>

      {/* LEYENDA DE REGLAS */}
      {leagueRules.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1.5rem",
            flexWrap: "wrap",
            padding: "0.8rem 1.2rem",
            marginBottom: "1.5rem",
            background: "rgba(255,255,255,0.02)",
            borderRadius: "10px",
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <span style={{ fontSize: "0.7rem", color: "#666", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1px" }}>
            Reglas
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
              <span
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "3px",
                  background: rule.color,
                  flexShrink: 0,
                }}
              />
              {rule.nombre} ({rule.puestos.sort((a, b) => a - b).join(", ")})
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h3>Editor de Clasificación de la Liga</h3>
          <p style={{ color: '#a3a3a3', fontSize: '0.9rem' }}>Actualiza los puntos y estadísticas de todos los equipos en bloque.</p>
        </div>
        <button onClick={handleSaveLeague} className="btn btn-primary" disabled={loading} style={{ padding: '0.8rem 2rem' }}>
          {loading ? "Guardando..." : "Guardar Clasificación"}
        </button>
      </div>

      <div className="table-responsive">
        <table className="admin-table league-editor">
          <thead>
            <tr>
              <th style={{ width: '40px' }}>#</th>
              <th style={{ width: '40px' }}>Logo</th>
              <th>Equipo</th>
              <th title="Puntos">PTS</th>
              <th title="Partidos Jugados">PJ</th>
              <th title="Victorias">PG</th>
              <th title="Empates">PE</th>
              <th title="Derrotas">PP</th>
              <th title="Goles a Favor">GF</th>
              <th title="Goles en Contra">GC</th>
              <th>DG</th>
            </tr>
          </thead>
          <tbody>
            {equiposOrdenados.map((eq, index) => {
              const posicion = index + 1;
              const rule = getRuleForPosition(posicion);
              return (
                <tr
                  key={eq.id}
                  style={
                    rule
                      ? {
                          borderLeft: `3px solid ${rule.color}`,
                          background: `${rule.color}0d`,
                        }
                      : undefined
                  }
                >
                  <td style={{ fontWeight: 800, color: rule ? rule.color : "#666", textAlign: "center" }}>
                    {posicion}
                  </td>
                  <td>{eq.escudo_url && eq.escudo_url !== "" && <img src={eq.escudo_url} alt="" style={{ width: '30px', height: '30px', objectFit: 'contain' }} />}</td>
                  <td style={{ fontWeight: 700, color: rule ? rule.color : "white" }}>{eq.nombre}</td>
                  <td><input type="text" inputMode="numeric" pattern="[0-9]*" value={eq.pts} onChange={(e) => handleInputChange(eq.id, 'pts', e.target.value)} /></td>
                  <td><input type="text" inputMode="numeric" pattern="[0-9]*" value={eq.pj}  onChange={(e) => handleInputChange(eq.id, 'pj',  e.target.value)} /></td>
                  <td><input type="text" inputMode="numeric" pattern="[0-9]*" value={eq.pg}  onChange={(e) => handleInputChange(eq.id, 'pg',  e.target.value)} /></td>
                  <td><input type="text" inputMode="numeric" pattern="[0-9]*" value={eq.pe}  onChange={(e) => handleInputChange(eq.id, 'pe',  e.target.value)} /></td>
                  <td><input type="text" inputMode="numeric" pattern="[0-9]*" value={eq.pp}  onChange={(e) => handleInputChange(eq.id, 'pp',  e.target.value)} /></td>
                  <td><input type="text" inputMode="numeric" pattern="[0-9]*" value={eq.gf}  onChange={(e) => handleInputChange(eq.id, 'gf',  e.target.value)} /></td>
                  <td><input type="text" inputMode="numeric" pattern="[0-9]*" value={eq.gc}  onChange={(e) => handleInputChange(eq.id, 'gc',  e.target.value)} /></td>
                  <td style={{ fontWeight: 800, color: (eq.gf - eq.gc) >= 0 ? '#10b981' : '#ef4444' }}>
                    {eq.gf - eq.gc}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <style jsx>{`
        .league-editor input {
          width: 60px;
          padding: 0.4rem;
          text-align: center;
          font-weight: 700;
          border-color: rgba(255,255,255,0.1);
        }
        .league-editor input:focus {
          border-color: var(--primary);
          outline: none;
        }
        .league-editor td { padding: 0.5rem 1rem; }
      `}</style>
    </div>
  );
}