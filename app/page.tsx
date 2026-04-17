"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Jugador {
  id: string;
  nombre: string;
  dorsal: number;
  posicion: string;
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

      // Fetch Próximo Partido
      const { data: mData } = await supabase
        .from("partidos")
        .select("*")
        .gte("fecha", new Date().toISOString().split('T')[0])
        .order("fecha", { ascending: true });
      
      if (mData && mData.length > 0) {
        setProximoPartido(mData[0]);
      }

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
            <h3 className="card-tag">Siguiente Partido</h3>
            {proximoPartido ? (
              <div className="match-display">
                <div className="team-box">
                  {escudo && escudo !== "" ? (
                    <img src={escudo} alt="UD Santiso" className="team-logo-large" />
                  ) : (
                    <div className="team-badge-large">UD</div>
                  )}
                  <span>UD Santiso</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                  {proximoPartido.estado === 'en_juego' && (
                    <div className="live-badge">
                      <span className="live-dot"></span> EN JUEGO
                    </div>
                  )}
                  {proximoPartido.estado === 'finalizado' && (
                    <div className="final-badge">FINALIZADO</div>
                  )}
                  
                  <div className="match-score-container">
                    {(proximoPartido.estado === 'en_juego' || proximoPartido.estado === 'finalizado') ? (
                      <div className="live-score">
                        <span className="score-num">{proximoPartido.goles_local || 0}</span>
                        <span className="score-divider">-</span>
                        <span className="score-num">{proximoPartido.goles_rival || 0}</span>
                      </div>
                    ) : (
                      <div className="vs-badge">VS</div>
                    )}
                  </div>
                  
                  <div className="match-meta">
                    <span className="match-date">
                      {new Date(proximoPartido.fecha).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </span>
                    <span className="match-time">
                      {new Date(proximoPartido.fecha).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
                <div className="team-box">
                  {proximoPartido.rival_escudo_url ? (
                    <img src={proximoPartido.rival_escudo_url} alt={proximoPartido.rival} className="team-logo-large" />
                  ) : (
                    <div className="team-badge-large bg-muted">?</div>
                  )}
                  <span>{proximoPartido.rival}</span>
                </div>
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
        .match-display { display: flex; align-items: center; justify-content: center; gap: 3rem; }
        
        .team-box { display: flex; flex-direction: column; align-items: center; gap: 1rem; font-weight: 900; font-size: 1.2rem; flex: 1; min-width: 0; }
        .team-logo-large { width: 130px; height: 130px; object-fit: contain; filter: drop-shadow(0 10px 20px rgba(0,0,0,0.4)); }
        .team-badge-large { width: 130px; height: 130px; border-radius: 50%; background: var(--secondary); border: 1px solid var(--border); color: #444; display: flex; align-items: center; justify-content: center; font-size: 3rem; }
        
        .match-score-container { display: flex; flex-direction: column; align-items: center; gap: 1rem; flex: 1; }
        .live-score { display: flex; align-items: center; gap: 1.5rem; margin: 0.5rem 0; }
        .score-num { font-size: 5rem; font-weight: 900; color: white; line-height: 1; font-family: 'Outfit', sans-serif; text-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        .score-divider { font-size: 3rem; color: var(--primary); font-weight: 200; opacity: 0.5; }
        
        .vs-badge { background: var(--primary); color: black; padding: 0.6rem 2rem; border-radius: 2rem; font-weight: 900; font-size: 1.4rem; transform: rotate(-5deg); box-shadow: 0 10px 20px rgba(250, 204, 21, 0.2); }
        
        .live-badge { background: #ef4444; color: white; padding: 0.4rem 1rem; border-radius: 0.5rem; font-weight: 800; font-size: 0.7rem; display: flex; align-items: center; gap: 0.5rem; animation: pulse 2s infinite; }
        .live-dot { width: 8px; height: 8px; background: white; border-radius: 50%; display: inline-block; }
        .final-badge { background: #404040; color: #a3a3a3; padding: 0.4rem 1rem; border-radius: 0.5rem; font-weight: 800; font-size: 0.7rem; }

        @keyframes pulse {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }

        .match-meta { display: flex; flex-direction: column; align-items: center; gap: 0.25rem; }

        .section-padding { padding: 6rem 0; }
        .section-heading { font-size: 4rem; text-align: center; margin-bottom: 4rem; }
        .player-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2rem; }
        .player-card { border-radius: 1.5rem; overflow: hidden; transition: transform 0.3s; }
        .player-card:hover { transform: translateY(-10px); }
        .player-image-box { height: 350px; position: relative; background: #111; }
        .player-img { width: 100%; height: 100%; object-fit: cover; }
        .player-number-overlay { position: absolute; top: 20px; right: 20px; font-size: 3rem; font-weight: 900; color: rgba(250, 204, 21, 0.2); }
        .player-data { padding: 2rem; text-align: center; }
        .player-data h4 { font-size: 1.3rem; margin-bottom: 0.5rem; }
        .player-data p { color: var(--primary); font-weight: 800; text-transform: uppercase; font-size: 0.8rem; }

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
