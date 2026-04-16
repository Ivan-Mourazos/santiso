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
        .gte("fecha", new Date().toISOString())
        .order("fecha", { ascending: true })
        .limit(1)
        .single();
      if (mData) setProximoPartido(mData);
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
          {escudo && <img src={escudo} alt="Escudo UD Santiso" className="hero-logo-main" />}
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
                  {escudo ? (
                    <img src={escudo} alt="UD Santiso" className="team-logo-large" />
                  ) : (
                    <div className="team-badge-large">UD</div>
                  )}
                  <span>UD Santiso</span>
                </div>
                <div className="vs-box">VS</div>
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
                     <div className="image-placeholder"></div>
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
            <div className="sponsor-item glass">Sponsor 1</div>
            <div className="sponsor-item glass">Sponsor 2</div>
            <div className="sponsor-item glass">Sponsor 3</div>
            <div className="sponsor-item glass">Sponsor 4</div>
          </div>
        </div>
      </section>

      <style jsx>{`
        .hero { padding: 10rem 0 8rem; text-align: center; background: radial-gradient(circle at center, #111 0%, #000 100%); }
        .hero-logo-main { width: 140px; height: 140px; object-fit: contain; margin: 0 auto 2rem; display: block; filter: drop-shadow(0 0 20px rgba(250, 204, 21, 0.3)); }
        .hero-title { font-size: 6rem; line-height: 0.9; margin: 1.5rem 0; font-weight: 900; }
        .hero-subtitle { font-size: 1.5rem; color: #a3a3a3; max-width: 600px; margin: 0 auto 3rem; }
        .badge-premium { background: var(--muted); padding: 0.5rem 1.5rem; border-radius: 2rem; font-weight: 800; text-transform: uppercase; font-size: 0.8rem; letter-spacing: 2px; }
        .hero-actions { display: flex; gap: 1.5rem; justify-content: center; }
        .btn-premium { padding: 1.2rem 2.5rem; border-radius: 0.5rem; font-weight: 900; text-transform: uppercase; cursor: pointer; transition: all 0.2s; border: none; }
        .btn-primary { background: var(--primary); color: black; }
        .btn-outline { background: transparent; color: var(--primary); border: 2px solid var(--primary); }
        .btn-premium:hover { transform: translateY(-3px); box-shadow: 0 10px 20px rgba(250, 204, 21, 0.2); }

        .section-fixtures { margin-top: -5rem; padding-bottom: 5rem; }
        .fixtures-card { padding: 3rem; border-radius: 2rem; text-align: center; }
        .card-tag { font-size: 0.8rem; text-transform: uppercase; color: var(--primary); letter-spacing: 3px; margin-bottom: 2rem; }
        .match-display { display: flex; align-items: center; justify-content: center; gap: 5rem; }
        .team-box { display: flex; flex-direction: column; align-items: center; gap: 1rem; font-weight: 900; font-size: 1.2rem; }
        .team-badge-large { width: 100px; height: 100px; border-radius: 50%; background: var(--primary); color: black; display: flex; align-items: center; justify-content: center; font-size: 2rem; }
        .team-logo-large { width: 100px; height: 100px; object-fit: contain; }
        .vs-box { font-size: 3rem; font-weight: 900; color: #333; }

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

        .sponsors-flex { display: flex; flex-wrap: wrap; gap: 2rem; justify-content: center; margin-top: 3rem; }
        .sponsor-item { padding: 2rem 4rem; border-radius: 1rem; opacity: 0.6; grayscale: 1; }
      `}</style>
    </main>
  );
}
