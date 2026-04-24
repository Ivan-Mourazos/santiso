"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  getCompetitionsByCategory,
  getDefaultUiCompetitionForCategory,
} from "@/lib/competition";
import {
  fetchTeamsForCompetition,
  getCompetitionQueryLabels,
  mergeMissingTeams,
} from "@/lib/supabase-queries";

export default function ClasificacionPage() {
  const [equipos, setEquipos] = useState<any[]>([]);
  const [categoria, setCategoria] = useState("Senior");
  const [competiciones, setCompeticiones] = useState<string[]>([]);
  const [competicion, setCompeticion] = useState(() => getDefaultUiCompetitionForCategory("Senior"));
  const [loading, setLoading] = useState(true);
  const [statsHint, setStatsHint] = useState<string | null>(null);
  const clasificacionFetchGen = useRef(0);

  useEffect(() => {
    setCompeticiones(getCompetitionsByCategory(categoria));
  }, [categoria]);

  useEffect(() => {
    if (!competicion) return;
    fetchClasificacion();
  }, [categoria, competicion]);

  async function fetchClasificacion() {
    const gen = ++clasificacionFetchGen.current;
    setLoading(true);

    const compFilters = getCompetitionQueryLabels(categoria, competicion);

    const { data: partidosData } = await supabase
      .from("partidos_liga")
      .select("*")
      .eq("categoria", categoria)
      .in("competicion", compFilters)
      .eq("estado", "finalizado");

    const baseTeams = await fetchTeamsForCompetition(categoria, competicion);
    const matchTeamIds = (partidosData || []).flatMap((p: any) => [
      p.equipo_local_id,
      p.equipo_visitante_id,
    ]);
    const teamsData = await mergeMissingTeams(baseTeams, matchTeamIds);

    if (gen !== clasificacionFetchGen.current) return;

    if (teamsData.length > 0) {
      const withStats = teamsData.map((team: any) => {
        const teamMatches = (partidosData || []).filter((p: any) =>
          p.equipo_local_id === team.id || p.equipo_visitante_id === team.id
        );

        const pj = teamMatches.length;
        let pg = 0;
        let pe = 0;
        let pp = 0;
        let gf = 0;
        let gc = 0;

        teamMatches.forEach((p: any) => {
          const isLocal = p.equipo_local_id === team.id;
          const favor = isLocal ? (p.goles_local || 0) : (p.goles_visitante || 0);
          const contra = isLocal ? (p.goles_visitante || 0) : (p.goles_local || 0);
          gf += favor;
          gc += contra;
          if (favor > contra) pg += 1;
          else if (favor === contra) pe += 1;
          else pp += 1;
        });

        return {
          equipo_id: team.id,
          nombre: team.nombre,
          escudo_url: team.escudo_url,
          pj, pg, pe, pp, gf, gc,
          pts: pg * 3 + pe,
        };
      });

      const sorted = [...withStats].sort((a, b) => {
        // 1. Puntos
        if (b.pts !== a.pts) return b.pts - a.pts;

        // 2. Goal-Average Particular (Enfrentamientos Directos)
        if (partidosData) {
          const directMatches = partidosData.filter(p => 
            (p.equipo_local_id === a.equipo_id && p.equipo_visitante_id === b.equipo_id) ||
            (p.equipo_local_id === b.equipo_id && p.equipo_visitante_id === a.equipo_id)
          );
          
          if (directMatches.length > 0) {
            let ptsA = 0, ptsB = 0, gfA = 0, gfB = 0;
            
            directMatches.forEach(p => {
              const aIsLocal = p.equipo_local_id === a.equipo_id;
              const gA = aIsLocal ? p.goles_local : p.goles_visitante;
              const gB = aIsLocal ? p.goles_visitante : p.goles_local;
              
              if (gA > gB) ptsA += 3;
              else if (gB > gA) ptsB += 3;
              else { ptsA += 1; ptsB += 1; }
              
              gfA += gA; gfB += gB;
            });
            
            if (ptsA !== ptsB) return ptsB - ptsA;
            if (gfA - gfB !== 0) return (gfB - gfA); // Diferencia en sus cruces
          }
        }

        // 3. Goal-Average General
        const diffA = a.gf - a.gc;
        const diffB = b.gf - b.gc;
        if (diffB !== diffA) return diffB - diffA;
        
        // 4. Goles a favor
        return b.gf - a.gf;
      });
      setEquipos(sorted);
      const anyPlayed = sorted.some((r: any) => r.pj > 0);
      if (!anyPlayed && sorted.length > 0) {
        setStatsHint(
          "No hay partidos finalizados para esta competición (o siguen con otra etiqueta en competicion). Revisa Admin → Calendario y el script scripts/fix_competicion_legacy.sql."
        );
      } else {
        setStatsHint(null);
      }
    } else {
      setEquipos([]);
      setStatsHint(null);
    }
    setLoading(false);
  }

  const categorias = [
    { id: "Senior", label: "Senior Masculino" },
    { id: "Femenino", label: "Senior Femenino" },
    { id: "Veteranos", label: "Veteranos" }
  ];

  const getPositionInfo = (index: number, cat: string, total: number) => {
    const pos = index + 1;
    if (cat === "Senior") {
      if (pos === 1) return { class: "rank-promo", label: "Fase Copa" };
    }
    if (cat === "Femenino") {
      if (pos <= 2) return { class: "rank-promo", label: "Ascenso Directo" };
      if (pos <= 6) return { class: "rank-playoff", label: "Playoffs" };
    }
    if (cat === "Veteranos") {
      if (pos === 1) return { class: "rank-top", label: "Campeón" };
      if (pos >= total - 3) return { class: "rank-down", label: "Descenso" };
    }
    return null;
  };

  return (
    <main className="main-content">
      <section className="hero-simple glass-bg">
        <div className="container">
          <h1 className="hero-title">Clasificación <span className="text-primary">Liga</span></h1>
          <p className="hero-subtitle">Estado actual de la competición. Selecciona una categoría para ver los detalles.</p>
          
          <div className="category-tabs-public">
            {categorias.map(cat => (
              <button 
                key={cat.id} 
                className={`tab-btn-public ${categoria === cat.id ? 'active' : ''}`}
                onClick={() => {
                  setCategoria(cat.id);
                  setCompeticion(getDefaultUiCompetitionForCategory(cat.id));
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>
          <div style={{ marginTop: "1rem" }}>
            <select value={competicion} onChange={(e) => setCompeticion(e.target.value)} className="competition-select">
              {competiciones.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </section>

      <section className="section-padding">
        <div className="container">
          {loading ? (
            <div className="loading-state">
              <div className="loader"></div>
              <p>Actualizando clasificación...</p>
            </div>
          ) : equipos.length === 0 ? (
            <div className="empty-state glass shadow-glare">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ opacity: 0.3, marginBottom: '1rem' }}><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
              <h3>Sin datos todavía</h3>
              <p>No hay equipos registrados en la categoría {categoria} para esta temporada.</p>
            </div>
          ) : (
            <>
              {statsHint && (
                <div className="clasificacion-hint glass">
                  <p>{statsHint}</p>
                </div>
              )}
              <div className="fixtures-card glass shadow-glare" style={{ padding: '0', overflow: 'hidden' }}>
                <table className="league-table">
                  <thead>
                    <tr>
                      <th style={{ width: '60px' }}>POS</th>
                      <th>EQUIPO</th>
                      <th className="hide-mobile">PJ</th>
                      <th className="hide-mobile">PG</th>
                      <th className="hide-mobile">PE</th>
                      <th className="hide-mobile">PP</th>
                      <th className="hide-mobile">GF</th>
                      <th className="hide-mobile">GC</th>
                      <th>DG</th>
                      <th className="pts-col">PTS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {equipos.map((eq, index) => {
                      const info = getPositionInfo(index, categoria, equipos.length);
                      return (
                        <tr key={eq.equipo_id} className={`${index < 3 ? "top-rank" : ""} ${info ? info.class : ""}`}>
                          <td className="rank-num">
                            <div className="rank-content">
                              {index + 1}
                              {index === 0 && <span className="medal">🥇</span>}
                            </div>
                          </td>
                          <td className="team-cell">
                            <div className="team-info">
                              {eq.escudo_url && eq.escudo_url !== "" ? (
                                <img src={eq.escudo_url} alt="" className="table-shield" />
                              ) : (
                                <div className="table-shield-placeholder"></div>
                              )}
                              <span className="team-name">{eq.nombre}</span>
                            </div>
                          </td>
                          <td className="hide-mobile">{eq.pj}</td>
                          <td className="hide-mobile">{eq.pg}</td>
                          <td className="hide-mobile">{eq.pe}</td>
                          <td className="hide-mobile">{eq.pp}</td>
                          <td className="hide-mobile">{eq.gf}</td>
                          <td className="hide-mobile">{eq.gc}</td>
                          <td className={eq.gf - eq.gc >= 0 ? "text-green" : "text-red"}>
                            {eq.gf - eq.gc > 0 ? `+${eq.gf - eq.gc}` : eq.gf - eq.gc}
                          </td>
                          <td className="pts-col"><strong>{eq.pts}</strong></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Leyenda Dinámica */}
              <div className="legend-container">
                {categoria === "Senior" && (
                  <div className="legend-item"><span className="dot dot-green"></span> Fase Copa</div>
                )}
                {categoria === "Femenino" && (
                  <>
                    <div className="legend-item"><span className="dot dot-green"></span> Ascenso Directo</div>
                    <div className="legend-item"><span className="dot dot-yellow"></span> Playoffs</div>
                  </>
                )}
                {categoria === "Veteranos" && (
                  <>
                    <div className="legend-item"><span className="dot dot-blue"></span> Campeón</div>
                    <div className="legend-item"><span className="dot dot-red"></span> Descenso</div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </section>

      <style jsx>{`
        .hero-simple { padding: 1.5rem 0 2rem; text-align: center; }
        .hero-title { font-size: 4rem; font-weight: 900; margin-bottom: 1rem; }
        .hero-subtitle { color: #a3a3a3; font-size: 1.1rem; margin-bottom: 2.5rem; }

        .category-tabs-public {
          display: inline-flex;
          background: rgba(255,255,255,0.03);
          padding: 5px;
          border-radius: 50px;
          border: 1px solid rgba(255,255,255,0.05);
          gap: 5px;
        }
        .tab-btn-public {
          padding: 0.8rem 2rem;
          border-radius: 50px;
          border: none;
          background: transparent;
          color: #a3a3a3;
          font-weight: 700;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .tab-btn-public.active {
          background: var(--primary);
          color: black;
          box-shadow: 0 5px 15px rgba(250, 204, 21, 0.3);
        }
        .tab-btn-public:not(.active):hover {
          background: rgba(255,255,255,0.05);
          color: white;
        }
        .competition-select { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 0.6rem 0.9rem; border-radius: 10px; min-width: 320px; font-weight: 600; }
        .clasificacion-hint { max-width: 720px; margin: 0 auto 1.5rem; padding: 1rem 1.25rem; border-radius: 12px; border: 1px solid rgba(251, 191, 36, 0.3); background: rgba(251, 191, 36, 0.06); color: #d4a574; font-size: 0.9rem; line-height: 1.5; }
        .clasificacion-hint p { margin: 0; }

        .section-padding { padding: 2rem 0 8rem; }
        
        .league-table { width: 100%; border-collapse: collapse; color: white; }
        .league-table th { padding: 1.5rem 1rem; text-align: center; font-size: 0.7rem; text-transform: uppercase; color: #666; letter-spacing: 2px; }
        .league-table th:nth-child(2) { text-align: left; }
        .league-table td { padding: 1.2rem 1rem; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .league-table td:nth-child(2) { text-align: left; }

        .team-info { display: flex; align-items: center; gap: 1rem; }
        .table-shield { width: 35px; height: 35px; object-fit: contain; }
        .table-shield-placeholder { width: 35px; height: 35px; border-radius: 50%; background: rgba(255,255,255,0.05); border: 1px dashed rgba(255,255,255,0.1); }
        .team-name { font-weight: 700; font-size: 1.1rem; }

        .rank-num { font-weight: 900; color: #444; font-size: 1.2rem; position: relative; padding-left: 1.5rem !important; }
        .rank-content { position: relative; z-index: 2; }
        
        /* Indicadores de competición */
        .rank-promo { border-left: 4px solid #10b981 !important; background: linear-gradient(90deg, rgba(16, 185, 129, 0.05) 0%, transparent 100%); }
        .rank-playoff { border-left: 4px solid #facc15 !important; background: linear-gradient(90deg, rgba(250, 204, 21, 0.05) 0%, transparent 100%); }
        .rank-top { border-left: 4px solid #3b82f6 !important; background: linear-gradient(90deg, rgba(59, 130, 246, 0.05) 0%, transparent 100%); }
        .rank-down { border-left: 4px solid #ef4444 !important; background: linear-gradient(90deg, rgba(239, 68, 68, 0.05) 0%, transparent 100%); }

        .top-rank .rank-num { color: var(--primary); }
        .top-rank .team-name { color: white; }
        
        .pts-col { background: rgba(250, 204, 21, 0.05); color: var(--primary); font-size: 1.2rem; width: 80px; }
        .medal { position: absolute; left: -15px; top: 0; font-size: 0.8rem; }

        .legend-container { 
          display: flex; 
          gap: 2rem; 
          margin-top: 2rem; 
          padding: 1rem 1.5rem; 
          background: rgba(255,255,255,0.02); 
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.05);
          flex-wrap: wrap;
        }
        .legend-item { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; font-weight: 600; color: #888; }
        .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
        .dot-green { background: #10b981; box-shadow: 0 0 10px rgba(16, 185, 129, 0.4); }
        .dot-yellow { background: #facc15; box-shadow: 0 0 10px rgba(250, 204, 21, 0.4); }
        .dot-blue { background: #3b82f6; box-shadow: 0 0 10px rgba(59, 130, 246, 0.4); }
        .dot-red { background: #ef4444; box-shadow: 0 0 10px rgba(239, 68, 68, 0.4); }

        .text-green { color: #10b981; font-weight: bold; }
        .text-red { color: #ef4444; font-weight: bold; }

        .loading-state { text-align: center; padding: 5rem; color: #a3a3a3; display: flex; flex-direction: column; align-items: center; gap: 1rem; }
        .loader { width: 30px; height: 30px; border: 3px solid rgba(250, 204, 21, 0.1); border-top-color: var(--primary); border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .empty-state { text-align: center; padding: 5rem; color: #a3a3a3; display: flex; flex-direction: column; align-items: center; }
        .empty-state h3 { color: white; margin-bottom: 0.5rem; }

        @media (max-width: 900px) {
          .hide-mobile { display: none; }
          .team-name { font-size: 0.95rem; }
          .hero-title { font-size: 2.8rem; }
          .category-tabs-public { flex-direction: column; width: 100%; border-radius: 15px; }
          .tab-btn-public { width: 100%; border-radius: 10px; }
          .legend-container { gap: 1rem; justify-content: center; }
        }
      `}</style>
    </main>
  );
}
