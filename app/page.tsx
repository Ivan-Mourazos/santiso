"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Jugador {
  id: string;
  nombre: string;
  dorsal: number;
  posicion: string;
  foto_url: string | null;
}

export default function Home() {
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [proximoPartido, setProximoPartido] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [escudo, setEscudo] = useState<string | null>(null);
  const [patrocinadores, setPatrocinadores] = useState<any[]>([]);

  useEffect(() => {
    setMounted(true);
    async function fetchData() {
      // Fetch Jugadores
      const { data: pData } = await supabase.from("jugadores").select("*").order("dorsal", { ascending: true });
      if (pData) setJugadores(pData);

      // Fetch Próximos Partidos (Uno por categoría para los equipos del Santiso)
      const { data: santisoTeams } = await supabase
        .from("equipos")
        .select("id, categoria")
        .ilike("nombre", "%santiso%");

      const nextMatches = [];
      if (santisoTeams) {
        for (const team of santisoTeams) {
          const { data: mData } = await supabase
            .from("partidos_liga")
            .select(`
              *,
              local:equipo_local_id (nombre, escudo_url),
              visitante:equipo_visitante_id (nombre, escudo_url)
            `)
            .eq("categoria", team.categoria)
            .or(`equipo_local_id.eq.${team.id},equipo_visitante_id.eq.${team.id}`)
            .gte("fecha", new Date().toISOString())
            .order("fecha", { ascending: true })
            .limit(1);

          if (mData && mData.length > 0) {
            nextMatches.push(mData[0]);
          }
        }
      }
      // Ordenar por fecha para mostrar primero el más inminente
      nextMatches.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
      
      setProximoPartido(nextMatches);

      // Fetch Patrocinadores
      const { data: sData } = await supabase.from("patrocinadores").select("*").order("orden", { ascending: true });
      if (sData) setPatrocinadores(sData);
    }
    
    async function fetchEscudo() {
      const { data } = supabase.storage.from("fotos").getPublicUrl(`escudo_club.webp?t=${Date.now()}`);
      if (data) setEscudo(data.publicUrl);
    }

    fetchData();
    fetchEscudo();
  }, []);

  if (!mounted) return <div style={{ background: '#000', minHeight: '100vh' }}></div>;

  return (
    <main className="main-content">
      {/* Hero Section */}
      <section className="hero glass-bg">
        <div className="container hero-container">
          {escudo && escudo !== "" && <img src={escudo} alt="Escudo UD Santiso" className="hero-logo-main" />}
          <span className="badge-premium">Unión Deportiva</span>
          <h1 className="hero-title">UD <span className="text-primary">SANTISO</span></h1>
          <p className="hero-subtitle">Pasión, Orgullo y Compromiso en cada partido de nuestra liga.</p>
          <div className="hero-actions">
            <a href="#fixtures" className="btn-premium btn-primary">Próximo Partido</a>
            <a href="#teams" className="btn-premium btn-outline">Nuestra Plantilla</a>
          </div>
        </div>
      </section>

      {/* Fixtures Widget */}
      <section id="fixtures" className="section-fixtures">
        <div className="container">
          <div className="fixtures-card glass shadow-glare">
            <h3 className="card-tag">Próximos Partidos</h3>
            {Array.isArray(proximoPartido) && proximoPartido.length > 0 ? (
              <div className="matches-grid">
                {proximoPartido.map((partido) => (
                  <div key={partido.id} className="match-card-individual">
                    <h4 className="match-category-label">{partido.categoria}</h4>
                    <div className="match-display-small">
                      <div className="team-box-small">
                        {partido.local?.escudo_url ? (
                          <img src={partido.local.escudo_url} alt={partido.local.nombre} className="team-logo-small" />
                        ) : (
                          <div className="team-badge-small">{partido.local?.nombre?.[0] || 'L'}</div>
                        )}
                        <span>{partido.local?.nombre || 'Local'}</span>
                      </div>
                      <div className="match-center-small">
                        {partido.estado === 'en_juego' && (
                          <div className="live-badge"><span className="live-dot"></span> EN JUEGO</div>
                        )}
                        {partido.estado === 'finalizado' && (
                          <div className="final-badge">FINALIZADO</div>
                        )}
                        
                        <div className="match-score-container-small">
                          {(partido.estado === 'en_juego' || partido.estado === 'finalizado') ? (
                            <div className="live-score-small">
                              <span className="score-num-small">{partido.goles_local ?? 0}</span>
                              <span className="score-divider-small">-</span>
                              <span className="score-num-small">{partido.goles_visitante ?? 0}</span>
                            </div>
                          ) : (
                            <div className="vs-badge-small">VS</div>
                          )}
                        </div>
                        
                        <div className="match-meta-small">
                          <span className="match-date-small">
                            {new Date(partido.fecha).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                          </span>
                          <span className="match-time-small">
                            {new Date(partido.fecha).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                      <div className="team-box-small">
                        {partido.visitante?.escudo_url ? (
                          <img src={partido.visitante.escudo_url} alt={partido.visitante.nombre} className="team-logo-small" />
                        ) : (
                          <div className="team-badge-small bg-muted">{partido.visitante?.nombre?.[0] || 'V'}</div>
                        )}
                        <span>{partido.visitante?.nombre || 'Visitante'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p>Esperando calendario...</p>
            )}
          </div>
        </div>
      </section>

      {/* Team Listing */}
      <section id="teams" className="section-padding">
        <div className="container">
          <h2 className="section-heading">Nuestra <span className="text-primary">Plantilla</span></h2>
          <div className="player-grid">
            {jugadores.map((j) => (
              <div key={j.id} className="player-card glass">
                <div className="player-image-box">
                   {j.foto_url ? (
                     <img src={j.foto_url} alt={j.nombre} className="player-img" />
                   ) : (
                     <div className="image-placeholder">
                       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ width: '60%', height: '60%', color: '#333', opacity: 0.5 }}>
                         <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                         <circle cx="12" cy="7" r="4" />
                       </svg>
                     </div>
                   )}
                   <div className="player-number-overlay">{j.dorsal}</div>
                </div>
                <div className="player-data">
                  <h4>{j.nombre}</h4>
                  <p>{j.posicion}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sponsors */}
      <section className="section-padding bg-muted-subtle">
        <div className="container">
          <h3 className="section-subtitle text-center">Patrocinadores Oficiales</h3>
          <div className="sponsors-flex">
            {patrocinadores.length > 0 ? patrocinadores.map(s => (
              <a 
                key={s.id} 
                href={s.web_url || '#'} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="sponsor-link"
              >
                <div className="sponsor-item glass">
                  <img src={s.logo_url} alt={s.nombre} className="sponsor-logo" title={s.nombre} />
                </div>
              </a>
            )) : (
              <p style={{ color: '#666', fontStyle: 'italic' }}>Convertite en nuestro próximo patrocinador...</p>
            )}
          </div>
        </div>
      </section>

      <style jsx>{`
        .hero { padding: 10rem 0 8rem; text-align: center; background: radial-gradient(circle at center, #111 0%, #000 100%); }
        .hero-logo-main { width: 220px; height: 220px; object-fit: contain; margin: 0 auto 2rem; display: block; filter: drop-shadow(0 0 30px rgba(250, 204, 21, 0.4)); }
        .hero-title { font-size: 6rem; line-height: 0.9; margin: 1.5rem 0; font-weight: 900; }
        .hero-subtitle { font-size: 1.5rem; color: #a3a3a3; max-width: 600px; margin: 0 auto 3rem; }
        .badge-premium { background: var(--muted); padding: 0.5rem 1.5rem; border-radius: 2rem; font-weight: 800; text-transform: uppercase; font-size: 0.8rem; letter-spacing: 2px; }
        .hero-actions { display: flex; gap: 1.5rem; justify-content: center; }
        .btn-premium { padding: 1.2rem 2.5rem; border-radius: 0.5rem; font-weight: 900; text-transform: uppercase; cursor: pointer; transition: all 0.2s; border: none; }
        .btn-primary { background: var(--primary); color: black; }
        .btn-outline { background: transparent; color: var(--primary); border: 2px solid var(--primary); }
        .btn-premium:hover { transform: translateY(-3px); box-shadow: 0 10px 20px rgba(250, 204, 21, 0.2); }

        .section-fixtures { margin-top: -5rem; padding-bottom: 5rem; }
        .fixtures-card { padding: 4rem 3rem; border-radius: 2rem; text-align: center; }
        .card-tag { font-size: 0.8rem; text-transform: uppercase; color: var(--primary); letter-spacing: 3px; margin-bottom: 3rem; }
        .matches-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem; }
        .match-card-individual { background: rgba(255,255,255,0.02); padding: 2rem 1rem; border-radius: 1.5rem; text-align: center; border: 1px solid rgba(255,255,255,0.05); }
        .match-category-label { font-size: 0.9rem; text-transform: uppercase; color: var(--primary); letter-spacing: 2px; margin-bottom: 2rem; font-weight: 800; }
        .match-display-small { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
        
        .team-box-small { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; flex: 1; font-weight: 800; font-size: 0.9rem; }
        .team-logo-small { width: 70px; height: 70px; object-fit: contain; filter: drop-shadow(0 5px 15px rgba(0,0,0,0.3)); }
        .team-badge-small { width: 70px; height: 70px; border-radius: 50%; background: var(--secondary); border: 1px solid var(--border); color: #444; display: flex; align-items: center; justify-content: center; font-size: 2rem; }
        
        .match-center-small { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; }
        .live-score-small { display: flex; align-items: center; gap: 0.5rem; }
        .score-num-small { font-size: 2.5rem; font-weight: 900; color: white; line-height: 1; font-family: 'Outfit', sans-serif; }
        .score-divider-small { font-size: 1.5rem; color: var(--primary); opacity: 0.5; }
        .vs-badge-small { background: var(--primary); color: black; padding: 0.4rem 1rem; border-radius: 2rem; font-weight: 900; font-size: 1rem; }
        
        .match-meta-small { display: flex; flex-direction: column; align-items: center; gap: 0.2rem; font-size: 0.8rem; color: #a3a3a3; margin-top: 0.5rem; }

        .sponsors-flex { display: flex; flex-wrap: wrap; gap: 5rem; justify-content: center; margin-top: 5rem; }
        .sponsor-link { text-decoration: none; }
        .sponsor-item { 
          width: 350px; height: 180px; 
          padding: 0; border-radius: 2rem; 
          display: flex; align-items: center; justify-content: center;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          overflow: hidden;
        }
        .sponsor-logo { 
          width: 100%; height: 100%;
          object-fit: contain; 
          filter: grayscale(1) brightness(1); 
          transition: all 0.4s;
          transform: scale(2);
        }
        .sponsor-item:hover { 
          transform: translateY(-12px) scale(1.05); 
          background: rgba(250, 204, 21, 0.05);
          border-color: var(--primary);
          box-shadow: 0 20px 40px rgba(0,0,0,0.5);
        }
        .sponsor-item:hover .sponsor-logo { 
          filter: grayscale(0) brightness(1); 
        }
      `}</style>
    </main>
  );
}
