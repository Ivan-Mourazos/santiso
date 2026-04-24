"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import {
  getCompetitionsByCategory,
  getDefaultUiCompetitionForCategory,
} from "@/lib/competition";
import {
  fetchMatchdaysForCompetition,
  fetchMatchesForMatchday,
  fetchSeasons,
} from "@/lib/supabase-queries";

export default function PartidosPage() {
  const [categoria, setCategoria] = useState("Senior");
  const [jornadas, setJornadas] = useState<any[]>([]);
  const [jornadaSeleccionada, setJornadaSeleccionada] = useState<any>(null);
  const [partidos, setPartidos] = useState<any[]>([]);
  const [descansos, setDescansos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [temporadaActiva, setTemporadaActiva] = useState<any>(null);
  const [competiciones, setCompeticiones] = useState<string[]>([]);
  const [competicion, setCompeticion] = useState(() => getDefaultUiCompetitionForCategory("Senior"));
  /** Datos antiguos guardados como "Liga principal" mientras la web muestra otro nombre */
  const [usingLegacyCompeticion, setUsingLegacyCompeticion] = useState(false);
  const jornadasFetchGen = useRef(0);
  const partidosFetchGen = useRef(0);

  const categorias = [
    { id: "Senior", label: "Senior Masculino" },
    { id: "Femenino", label: "Senior Femenino" },
    { id: "Veteranos", label: "Veteranos" }
  ];

  useEffect(() => {
    setCompeticiones(getCompetitionsByCategory(categoria));
  }, [categoria]);

  useEffect(() => {
    async function init() {
      const { active } = await fetchSeasons();
      if (active) setTemporadaActiva(active);
    }
    init();
  }, []);

  useEffect(() => {
    if (temporadaActiva && competicion) {
      fetchJornadas();
    }
  }, [categoria, temporadaActiva, competicion]);

  useEffect(() => {
    if (!jornadaSeleccionada?.id || !competicion) return;
    fetchPartidos(jornadaSeleccionada.id, jornadaSeleccionada.competicion ?? null);
  }, [jornadaSeleccionada?.id, competicion, categoria, usingLegacyCompeticion]);

  async function fetchJornadas() {
    const gen = ++jornadasFetchGen.current;
    setLoading(true);
    setUsingLegacyCompeticion(false);

    const { data: jData } = await fetchMatchdaysForCompetition(temporadaActiva.id, categoria, competicion);
    const legacy = jData.some((j: any) => j.competicion === "Liga principal");

    if (gen !== jornadasFetchGen.current) return;

    if (legacy) setUsingLegacyCompeticion(true);

    if (jData && jData.length > 0) {
      setJornadas(jData);
      const hoy = new Date().toISOString().split("T")[0];
      const actual =
        jData.find(j => j.fecha_inicio && j.fecha_inicio >= hoy) || jData[jData.length - 1];
      setJornadaSeleccionada(actual || jData[0]);
    } else {
      setJornadas([]);
      setJornadaSeleccionada(null);
      setPartidos([]);
    }
    setLoading(false);
  }

  async function fetchPartidos(
    jornadaId: string,
    jornadaCompeticion?: string | null
  ) {
    const gen = ++partidosFetchGen.current;
    const { data: pData } = await fetchMatchesForMatchday(jornadaId, categoria, competicion, {
      embed: true,
      jornadaCompeticion,
    });

    if (gen !== partidosFetchGen.current) return;
    setPartidos(pData ?? []);
  }

  useEffect(() => {
    if (!jornadaSeleccionada?.id) {
      setDescansos([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("jornada_equipo_descanso")
        .select("id, equipo:equipo_id(id, nombre, escudo_url)")
        .eq("jornada_id", jornadaSeleccionada.id);
      if (cancelled) return;
      if (error || !data) setDescansos([]);
      else setDescansos(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [jornadaSeleccionada?.id]);

  const navegarJornada = (direccion: number) => {
    const currentIndex = jornadas.findIndex(j => j.id === jornadaSeleccionada.id);
    const nextIndex = currentIndex + direccion;
    if (nextIndex >= 0 && nextIndex < jornadas.length) {
      setJornadaSeleccionada(jornadas[nextIndex]);
    }
  };

  return (
    <main className="main-content">
      <section className="hero-simple glass-bg">
        <div className="container">
          <h1 className="hero-title">Calendario y <span className="text-primary">Resultados</span></h1>
          <p className="hero-subtitle">Sigue todos los partidos de la temporada {temporadaActiva?.nombre || ''}</p>
          
          <div className="category-tabs-public">
            {categorias.map(cat => (
              <button 
                key={cat.id} 
                className={`tab-btn-public ${categoria === cat.id ? 'active' : ''}`}
                onClick={() => {
                  setCategoria(cat.id);
                  setCompeticion(getDefaultUiCompetitionForCategory(cat.id));
                  setUsingLegacyCompeticion(false);
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>
          <div style={{ marginTop: "1rem" }}>
            <select
              value={competicion}
              onChange={(e) => {
                setUsingLegacyCompeticion(false);
                setCompeticion(e.target.value);
              }}
              className="competition-select"
            >
              {competiciones.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {usingLegacyCompeticion && (
            <p className="legacy-competicion-hint">
              Mostrando jornadas guardadas como «Liga principal». Ejecuta{" "}
              <code>scripts/fix_competicion_legacy.sql</code> en Supabase para alinear el nombre con la competición.
            </p>
          )}
        </div>
      </section>

      <section className="section-padding">
        <div className="container">
          {loading ? (
            <div className="loading-state">
              <div className="loader"></div>
              <p>Cargando calendario...</p>
            </div>
          ) : jornadas.length === 0 ? (
            <div className="empty-state glass">
              <p>No hay jornadas para <strong>{competicion}</strong> en esta categoría y temporada.</p>
              <p className="empty-hint">
                Si tenías datos antes de la migración, en base pueden estar como «Liga principal». Actualiza{" "}
                <code>jornadas.competicion</code> y <code>partidos_liga.competicion</code> al texto exacto del desplegable, o usa{" "}
                <code>scripts/fix_competicion_legacy.sql</code>.
              </p>
              <p className="empty-hint">
                Las competiciones nuevas se definen en código: <code>components/admin/cartel/types.ts</code> → <code>COMPETICIONS</code>.
              </p>
            </div>
          ) : (
            <>
              {/* SELECTOR DE JORNADA */}
              <div className="jornada-nav glass shadow-glare">
                <button 
                  className="nav-btn" 
                  onClick={() => navegarJornada(-1)}
                  disabled={jornadas.findIndex(j => j.id === jornadaSeleccionada?.id) === 0}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M15 18l-6-6 6-6"/></svg>
                </button>
                <div className="jornada-info">
                  <span className="jornada-num">Jornada {jornadaSeleccionada?.numero}</span>
                  <span className="jornada-fase">{jornadaSeleccionada?.competicion || 'Liga'}</span>
                </div>
                <button 
                  className="nav-btn" 
                  onClick={() => navegarJornada(1)}
                  disabled={jornadas.findIndex(j => j.id === jornadaSeleccionada?.id) === jornadas.length - 1}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M9 18l6-6-6-6"/></svg>
                </button>
              </div>

              {descansos.length > 0 && (
                <div className="descansos-jornada glass shadow-glare">
                  <span className="descansos-title">Descansan esta jornada</span>
                  <ul className="descansos-list">
                    {descansos.map((d: any) => (
                      <li key={d.id} className="descanso-item">
                        {d.equipo?.escudo_url ? (
                          <img src={d.equipo.escudo_url} alt="" className="descanso-shield" />
                        ) : null}
                        <span>{d.equipo?.nombre ?? "Equipo"}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* LISTA DE PARTIDOS */}
              <div className="matches-grid">
                {partidos.length > 0 ? partidos.map(p => (
                  <div key={p.id} className={`match-card-v2 glass shadow-glare ${p.estado}`}>
                    <div className="match-header">
                      <span className="match-date">
                        {p.fecha ? new Date(p.fecha).toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' }) : 'Fecha por definir'}
                      </span>
                      <span className="match-time">{p.fecha ? p.fecha.split('T')[1]?.substring(0,5) : '--:--'}h</span>
                    </div>

                    <div className="match-teams-row">
                      <div className="team-box home">
                        <img src={p.equipo_local?.escudo_url || '/placeholder-shield.png'} alt="" className="team-shield-large" />
                        <span className="team-name-v2">{p.equipo_local?.nombre}</span>
                      </div>

                      <div className="match-score-box">
                        {p.estado === 'finalizado' ? (
                          <div className="score-final">
                            <span>{p.goles_local}</span>
                            <span className="score-divider">-</span>
                            <span>{p.goles_visitante}</span>
                          </div>
                        ) : (
                          <div className="score-pending">VS</div>
                        )}
                        <span className={`status-pill ${p.estado}`}>{p.estado}</span>
                      </div>

                      <div className="team-box away">
                        <img src={p.equipo_visitante?.escudo_url || '/placeholder-shield.png'} alt="" className="team-shield-large" />
                        <span className="team-name-v2">{p.equipo_visitante?.nombre}</span>
                      </div>
                    </div>

                    <div className="match-footer">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                      <span className="stadium-name">{p.campo?.nombre || 'Campo por definir'}</span>
                      {p.campo?.poblacion && <span className="stadium-city">({p.campo.poblacion})</span>}
                    </div>
                  </div>
                )) : (
                  <div className="no-matches-in-jornada">
                    <p>No hay partidos programados para esta jornada todavía.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </section>

      <style jsx>{`
        .hero-simple { padding: 1.5rem 0 2rem; text-align: center; }
        .hero-title { font-size: 4rem; font-weight: 900; margin-bottom: 1rem; }
        .hero-subtitle { color: #666; font-size: 1.1rem; margin-bottom: 2.5rem; }

        .category-tabs-public { display: inline-flex; background: rgba(255,255,255,0.03); padding: 5px; border-radius: 50px; border: 1px solid rgba(255,255,255,0.05); gap: 5px; }
        .tab-btn-public { padding: 0.8rem 2rem; border-radius: 50px; border: none; background: transparent; color: #666; font-weight: 700; cursor: pointer; transition: all 0.3s; }
        .tab-btn-public.active { background: var(--primary); color: black; box-shadow: 0 5px 15px rgba(250, 204, 21, 0.3); }
        .competition-select { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 0.6rem 0.9rem; border-radius: 10px; min-width: 320px; font-weight: 600; }
        .legacy-competicion-hint { max-width: 640px; margin: 1rem auto 0; padding: 0.75rem 1rem; font-size: 0.85rem; color: #fbbf24; background: rgba(251, 191, 36, 0.08); border: 1px solid rgba(251, 191, 36, 0.25); border-radius: 10px; }
        .legacy-competicion-hint code { font-size: 0.8rem; color: #fcd34d; }
        .empty-hint { margin-top: 1rem; font-size: 0.9rem; color: #888; line-height: 1.5; max-width: 560px; margin-left: auto; margin-right: auto; }
        .empty-hint code { font-size: 0.8rem; color: #a3a3a3; }

        .descansos-jornada {
          max-width: 720px;
          margin: 0 auto 2rem;
          padding: 1.25rem 1.5rem;
          border-radius: 16px;
          border: 1px solid rgba(167, 139, 250, 0.25);
          background: rgba(139, 92, 246, 0.08);
        }
        .descansos-title {
          display: block;
          font-size: 0.75rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: #c4b5fd;
          margin-bottom: 0.75rem;
        }
        .descansos-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem 1.25rem;
        }
        .descanso-item {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 700;
          color: #e9d5ff;
          font-size: 0.95rem;
        }
        .descanso-shield {
          width: 28px;
          height: 28px;
          object-fit: contain;
        }
        .jornada-nav { 
          display: flex; 
          align-items: center; 
          justify-content: space-between; 
          max-width: 400px; 
          margin: 0 auto 4rem; 
          padding: 1rem; 
          border-radius: 100px;
          border: 1px solid rgba(255,255,255,0.05);
        }
        .nav-btn { 
          width: 50px; height: 50px; border-radius: 50%; border: none; 
          background: rgba(255,255,255,0.05); color: white; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.2s;
        }
        .nav-btn:hover:not(:disabled) { background: var(--primary); color: black; }
        .nav-btn:disabled { opacity: 0.1; cursor: not-allowed; }

        .jornada-info { text-align: center; }
        .jornada-num { display: block; font-size: 1.5rem; font-weight: 900; color: white; line-height: 1; }
        .jornada-fase { font-size: 0.7rem; text-transform: uppercase; color: var(--primary); font-weight: 800; letter-spacing: 1px; }

        .matches-grid { display: grid; grid-template-columns: 1fr; gap: 1.5rem; max-width: 800px; margin: 0 auto; }
        
        .match-card-v2 { padding: 2rem; border-radius: 20px; border: 1px solid rgba(255,255,255,0.05); transition: transform 0.3s; }
        .match-card-v2:hover { transform: translateY(-5px); border-color: rgba(250, 204, 21, 0.2); }
        
        .match-header { display: flex; justify-content: space-between; margin-bottom: 2rem; font-size: 0.8rem; font-weight: 700; color: #444; text-transform: uppercase; letter-spacing: 1px; }
        .match-time { color: var(--primary); }

        .match-teams-row { display: grid; grid-template-columns: 1fr 120px 1fr; align-items: center; gap: 1rem; margin-bottom: 2rem; }
        .team-box { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 1rem; }
        .team-shield-large { width: 70px; height: 70px; object-fit: contain; filter: drop-shadow(0 5px 15px rgba(0,0,0,0.5)); }
        .team-name-v2 { font-weight: 800; font-size: 1.1rem; color: white; }

        .match-score-box { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 0.5rem; }
        .score-final { font-size: 2.5rem; font-weight: 900; color: white; display: flex; gap: 1rem; align-items: center; }
        .score-divider { color: var(--primary); opacity: 0.5; }
        .score-pending { font-size: 1.5rem; font-weight: 900; color: #222; letter-spacing: 4px; }
        
        .status-pill { font-size: 0.6rem; text-transform: uppercase; padding: 0.3rem 0.8rem; border-radius: 10px; font-weight: 800; letter-spacing: 1px; background: rgba(255,255,255,0.05); color: #555; }
        .status-pill.finalizado { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .status-pill.en_juego { background: rgba(239, 68, 68, 0.1); color: #ef4444; animation: pulse 2s infinite; }

        .match-footer { display: flex; align-items: center; justify-content: center; gap: 0.5rem; color: #444; font-size: 0.85rem; font-weight: 600; padding-top: 1.5rem; border-top: 1px solid rgba(255,255,255,0.03); }
        .stadium-name { color: #888; }
        .stadium-city { opacity: 0.5; }

        .loading-state { text-align: center; padding: 5rem; display: flex; flex-direction: column; align-items: center; gap: 1rem; color: #666; }
        .loader { width: 30px; height: 30px; border: 3px solid rgba(250, 204, 21, 0.1); border-top-color: var(--primary); border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 600px) {
          .match-teams-row { grid-template-columns: 1fr; gap: 2rem; }
          .match-score-box { order: -1; margin-bottom: 1rem; }
          .hero-title { font-size: 2.5rem; }
          .category-tabs-public { flex-direction: column; width: 100%; border-radius: 15px; }
          .tab-btn-public { width: 100%; }
        }
      `}</style>
    </main>
  );
}
