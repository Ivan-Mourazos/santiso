"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

interface Jugador {
  id: string;
  nombre: string;
  apodo: string | null;
  dorsal: number;
  posicion: string;
  capitan: number;
  foto_url: string | null;
  categoria: string;
}

interface Staff {
  id: string;
  nombre: string;
  cargo: string;
  tipo: string;
  categoria: string | null;
}

export default function PlantillaPage() {
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [categoriaActiva, setCategoriaActiva] = useState("Senior");
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<Jugador | null>(null);
  const [temporadaActiva, setTemporadaActiva] = useState<any>(null);
  const [faseActiva, setFaseActiva] = useState("Total");
  const [fasesDisponibles, setFasesDisponibles] = useState<string[]>([]);
  const [playerStats, setPlayerStats] = useState({ 
    convocado: 0, titular: 0, suplente: 0, pj: 0, 
    goles: 0, minutos: 0, golesEncajados: 0 
  });

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const { data: temp } = await supabase
        .from("temporadas")
        .select("*")
        .eq("activa", true)
        .single();
      if (temp) setTemporadaActiva(temp);

      const { data: pData } = await supabase
        .from("jugadores")
        .select("*")
        .order("dorsal", { ascending: true });
      if (pData) setJugadores(pData);

      const { data: sData } = await supabase
        .from("staff_club")
        .select("*");
      if (sData) setStaff(sData);
      setLoading(false);
    }
    fetchData();
  }, []);

  // Cargar fases disponibles cuando cambia el jugador o categoría
  useEffect(() => {
    if (selectedPlayer && temporadaActiva) {
      async function getFases() {
        const { data: jData } = await supabase
          .from("jornadas")
          .select("competicion")
          .eq("temporada_id", temporadaActiva.id)
          .eq("categoria", selectedPlayer.categoria);
        
        if (jData) {
          const unicas = Array.from(new Set(jData.map(j => j.competicion || "Liga")));
          setFasesDisponibles(unicas);
        }
      }
      getFases();
    }
  }, [selectedPlayer, temporadaActiva]);

  useEffect(() => {
    if (selectedPlayer && temporadaActiva) {
      async function loadDetailedStats() {
        let query = supabase
          .from("jornadas")
          .select("id")
          .eq("temporada_id", temporadaActiva.id)
          .eq("categoria", selectedPlayer.categoria);
        
        if (faseActiva !== "Total") {
          query = query.eq("competicion", faseActiva);
        }

        const { data: jornadas } = await query;
        const jornadaIds = jornadas?.map(j => j.id) || [];

        const { data: stats } = await supabase
          .from("jugador_partido_stats")
          .select("*, partidos_liga!inner(*)")
          .eq("jugador_id", selectedPlayer.id)
          .in("partidos_liga.jornada_id", jornadaIds);

        if (stats) {
          let totalMin = 0; let totalGoles = 0; let totalEncajados = 0;
          let conv = stats.length; let tit = 0; let sup = 0; let pj = 0;

          stats.forEach(s => {
            const isTitular = s.titular;
            const played = s.jugo || s.titular;
            if (played) pj++;
            if (isTitular) tit++; else if (played) sup++;
            totalGoles += (s.goles || 0);

            if (selectedPlayer.posicion === 'POR' && played) {
              const p = s.partidos_liga;
              totalEncajados += (p.equipo_local_id === 'c3c7e732-7201-4976-9630-1081518f8883' ? p.goles_visitante : p.goles_local);
            }
            if (played) totalMin += isTitular ? 90 : 25;
          });

          setPlayerStats({
            convocado: conv, titular: tit, suplente: sup, pj: pj,
            goles: totalGoles, minutos: totalMin, golesEncajados: totalEncajados
          });
        }
      }
      loadDetailedStats();
    }
  }, [selectedPlayer, temporadaActiva, faseActiva]);

  const jugadoresFiltrados = jugadores.filter(j => j.categoria === categoriaActiva);
  const staffFiltrado = staff.filter(s => 
    s.tipo === 'Tecnico' && 
    s.categoria?.toLowerCase() === categoriaActiva.toLowerCase()
  );
  const directiva = staff.filter(s => s.tipo === 'Directiva');

  const Porteros = jugadoresFiltrados.filter(j => j.posicion === 'POR');
  const Defensas = jugadoresFiltrados.filter(j => ['DFC', 'LD', 'LI'].includes(j.posicion));
  const Medios = jugadoresFiltrados.filter(j => ['MC', 'MCD', 'MCO', 'MI', 'MD'].includes(j.posicion));
  const Delanteros = jugadoresFiltrados.filter(j => ['DC', 'ED', 'EI'].includes(j.posicion));

  const renderFifaCard = (j: Jugador, isSmall = true) => (
    <div 
      key={j.id} 
      className={`fifa-card-container ${isSmall ? 'clickable' : 'no-scale'}`}
      onClick={isSmall ? () => setSelectedPlayer(j) : undefined}
    >
      <div className={`fifa-card ${categoriaActiva.toLowerCase()}`}>
        {j.capitan > 0 && <div className="fifa-capitan-badge" title={`Capitán ${j.capitan}`}>C</div>}
        <div className="fifa-meta">
          <span className="fifa-dorsal">{j.dorsal}</span>
          <span className="fifa-pos">{j.posicion}</span>
        </div>
        <div className="fifa-img-box">
          {j.foto_url ? (
            <img src={j.foto_url} alt={j.nombre} className="fifa-player-img" />
          ) : (
            <div className="fifa-placeholder">
               <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
            </div>
          )}
        </div>
        <div className="fifa-info">
          <h4 className="fifa-name">{j.nombre.split(' ').slice(0, 2).join(' ')}</h4>
          {j.apodo && <p className="fifa-nickname">{j.apodo}</p>}
        </div>
      </div>
    </div>
  );

  const renderSection = (titulo: string, lista: Jugador[]) => {
    if (lista.length === 0) return null;
    return (
      <div className="pos-section">
        <h3 className="pos-title">{titulo}</h3>
        <div className="grid-pro">
          {lista.map(j => renderFifaCard(j))}
        </div>
      </div>
    );
  };

  return (
    <main className="plantilla-page-v2">
      <div className="container">
        <div className="page-header">
          <Link href="/" className="back-link">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Volver al inicio
          </Link>
          <h1 className="main-title">Nuestra <span className="text-primary">Plantilla</span></h1>
          <p className="page-subtitle">Temporada {temporadaActiva?.nombre || '2023/24'} - Unión Deportiva Santiso</p>
        </div>

        <div className="cat-selector">
          {['Senior', 'Femenino', 'Veteranos'].map(cat => (
            <button 
              key={cat} 
              className={`cat-btn ${categoriaActiva === cat ? 'active' : ''}`}
              onClick={() => setCategoriaActiva(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="loading-state">Preparando los cromos...</div>
        ) : (
          <div className="squad-content">
            {renderSection("Porteros", Porteros)}
            {renderSection("Defensas", Defensas)}
            {renderSection("Centrocampistas", Medios)}
            {renderSection("Delanteros", Delanteros)}

            {/* STAFF */}
            <div className="staff-section">
              <h3 className="pos-title">Cuerpo Técnico</h3>
              <div className="staff-grid">
                {staffFiltrado.length > 0 ? staffFiltrado.map(s => (
                  <div key={s.id} className="staff-card-pro">
                    <span className="staff-role-label">{s.cargo}</span>
                    <h4 className="staff-name-label">{s.nombre}</h4>
                  </div>
                )) : (
                  <p className="no-staff">Cargando equipo técnico...</p>
                )}
              </div>
            </div>

            {/* DIRECTIVA */}
            {categoriaActiva === 'Senior' && directiva.length > 0 && (
              <div className="staff-section directiva-section">
                <h3 className="pos-title">Junta Directiva</h3>
                <div className="staff-grid">
                  {directiva.map(s => (
                    <div key={s.id} className="staff-card-pro">
                      <span className="staff-role-label">{s.cargo}</span>
                      <h4 className="staff-name-label">{s.nombre}</h4>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL DETALLE JUGADOR */}
      {selectedPlayer && (
        <div className="modal-overlay" onClick={() => setSelectedPlayer(null)}>
          <div className="player-detail-card" onClick={e => e.stopPropagation()}>
            <button className="close-detail" onClick={() => setSelectedPlayer(null)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
            
            <div className="detail-left">
              {renderFifaCard(selectedPlayer, false)}
              <div className="player-meta-badges" style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
                <span className="badge-premium">{selectedPlayer.categoria}</span>
                <span className="badge-premium" style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}>SANTISO</span>
              </div>
            </div>

            <div className="detail-right">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h2 className="detail-name" style={{ fontSize: "2.5rem", fontWeight: 900, marginBottom: "0.2rem" }}>{selectedPlayer.nombre}</h2>
                  <p className="detail-nickname" style={{ color: "var(--primary)", fontSize: "1.2rem", fontWeight: 700, marginBottom: "1rem" }}>{selectedPlayer.apodo || "Sin apodo"}</p>
                </div>
                <div className="fase-pill-selector">
                  {['Total', ...fasesDisponibles].length > 2 && ['Total', ...fasesDisponibles].map(f => (
                    <button key={f} className={`fase-pill ${faseActiva === f ? 'active' : ''}`} onClick={() => setFaseActiva(f)}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="stats-sections-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                
                {/* BLOQUE PARTICIPACIÓN */}
                <div className="stats-block">
                  <p className="block-title">Participación</p>
                  <div className="stats-row-mini">
                    <div className="mini-box"><span>{playerStats.convocado}</span><label>Convocados</label></div>
                    <div className="mini-box"><span>{playerStats.titular}</span><label>Titulares</label></div>
                    <div className="mini-box"><span>{playerStats.suplente}</span><label>Suplentes</label></div>
                  </div>
                </div>

                {/* BLOQUE GOLES / PORTERÍA */}
                <div className="stats-block">
                  <p className="block-title">{selectedPlayer.posicion === 'POR' ? 'Portería' : 'Rendimiento Goleador'}</p>
                  <div className="stats-row-mini">
                    {selectedPlayer.posicion === 'POR' ? (
                      <>
                        <div className="mini-box"><span>{playerStats.golesEncajados}</span><label>Encajados</label></div>
                        <div className="mini-box"><span>{(playerStats.golesEncajados / (playerStats.pj || 1)).toFixed(2)}</span><label>Media</label></div>
                      </>
                    ) : (
                      <>
                        <div className="mini-box"><span>{playerStats.goles}</span><label>Goles</label></div>
                        <div className="mini-box"><span>{(playerStats.goles / (playerStats.pj || 1)).toFixed(2)}</span><label>Media</label></div>
                      </>
                    )}
                  </div>
                </div>

                {/* BLOQUE TIEMPO DE JUEGO */}
                <div className="stats-block" style={{ gridColumn: 'span 2' }}>
                  <p className="block-title">Tiempo de Juego ({faseActiva})</p>
                  <div className="stats-row-mini">
                    <div className="mini-box" style={{ flex: 1 }}><span>{playerStats.minutos} min</span><label>Minutos Totales</label></div>
                    <div className="mini-box" style={{ flex: 1 }}><span>{(playerStats.minutos / (playerStats.pj || 1)).toFixed(1)} min</span><label>Promedio / Partido</label></div>
                  </div>
                </div>

              </div>

              <div className="detail-footer" style={{ marginTop: "auto", paddingTop: "1.5rem", borderTop: "1px solid rgba(255,255,255,0.05)", fontSize: "0.75rem", color: "#444" }}>
                <p>Datos oficiales de la Temporada {temporadaActiva?.nombre} ({faseActiva})</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .plantilla-page-v2 { padding: 8rem 0 10rem; min-height: 100vh; background: radial-gradient(circle at top, #1a1a1a 0%, #000 100%); }
        .page-header { text-align: center; margin-bottom: 4rem; }
        .back-link { display: inline-flex; align-items: center; gap: 0.5rem; color: #666; font-size: 0.9rem; margin-bottom: 2rem; transition: color 0.2s; }
        .back-link:hover { color: var(--primary); }
        .main-title { font-size: 4rem; font-weight: 900; line-height: 1; margin-bottom: 1rem; }
        .page-subtitle { color: #666; font-size: 1.2rem; }

        .cat-selector { display: flex; gap: 0.5rem; padding: 0.5rem; border-radius: 1rem; margin: 0 auto 5rem; max-width: fit-content; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); }
        .cat-btn { padding: 0.8rem 2rem; border-radius: 0.7rem; border: none; background: transparent; color: #666; font-weight: 800; cursor: pointer; transition: all 0.3s; text-transform: uppercase; font-size: 0.8rem; letter-spacing: 1px; }
        .cat-btn.active { background: var(--primary); color: black; box-shadow: 0 4px 15px rgba(250, 204, 21, 0.2); }

        .fase-pill-selector { display: flex; gap: 0.4rem; background: rgba(255,255,255,0.03); padding: 0.3rem; border-radius: 2rem; border: 1px solid rgba(255,255,255,0.05); }
        .fase-pill { padding: 0.4rem 1rem; border-radius: 2rem; border: none; background: transparent; color: #555; font-size: 0.7rem; font-weight: 800; cursor: pointer; transition: all 0.2s; text-transform: uppercase; }
        .fase-pill.active { background: rgba(255,255,255,0.07); color: var(--primary); }

        .pos-section { margin-bottom: 6rem; }
        .loading-state { text-align: center; padding: 5rem; font-size: 1.2rem; color: var(--primary); font-style: italic; }
        
        .block-title { color: #555; font-weight: 800; font-size: 0.65rem; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 1rem; }
        .stats-row-mini { display: flex; gap: 1rem; }
        .mini-box { background: rgba(255,255,255,0.02); padding: 0.8rem; border-radius: 0.8rem; border: 1px solid rgba(255,255,255,0.05); text-align: center; flex: 1; }
        .mini-box span { display: block; font-size: 1.4rem; font-weight: 900; color: white; line-height: 1; margin-bottom: 0.3rem; }
        .mini-box label { font-size: 0.55rem; text-transform: uppercase; color: #666; font-weight: 700; letter-spacing: 0.5px; }

        @media (max-width: 768px) {
          .main-title { font-size: 3rem; }
          .stats-sections-grid { grid-template-columns: 1fr !important; }
          .player-detail-card { flex-direction: column; overflow-y: auto; }
        }
      `}</style>
    </main>
  );
}
