"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import Image from "next/image";
import {
  fetchCurrentSantisoMatches,
  type LeagueMatch,
} from "@/lib/supabase-queries";
import { LoadingState, EmptyState } from "@/components/ui/AdminUI";

interface Sponsor {
  id: string;
  nombre: string;
  logo_url: string;
  web_url?: string | null;
}

function formatMatchDate(fecha?: string | null) {
  if (!fecha) return "Data pendente";
  return new Date(fecha).toLocaleDateString("es-ES", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatMatchTime(fecha?: string | null) {
  if (!fecha) return "--:--";
  return new Date(fecha).toLocaleTimeString("es-ES", {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Home() {
  const [proximoPartido, setProximoPartido] = useState<LeagueMatch[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [escudo, setEscudo] = useState<string | null>(null);
  const [patrocinadores, setPatrocinadores] = useState<Sponsor[]>([]);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      const [{ data: sData }, nextMatches] = await Promise.all([
        supabase
          .from("patrocinadores")
          .select("*")
          .order("orden", { ascending: true }),
        fetchCurrentSantisoMatches(),
      ]);
      setProximoPartido(nextMatches);
      if (sData) setPatrocinadores(sData);
      setIsLoading(false);
    }
    
    async function fetchEscudo() {
      const { data } = supabase.storage.from("fotos").getPublicUrl("escudo_club.webp");
      if (data) setEscudo(data.publicUrl);
    }

    fetchData();
    fetchEscudo();
  }, []);

  return (
    <main className="main-content">
      {/* Hero Section */}
      <section className="hero glass-bg">
        <div className="container hero-container">
          {escudo && escudo !== "" && (
            <Image
              src={escudo}
              alt="Escudo UD Santiso"
              className="hero-logo-main"
              width={220}
              height={220}
              priority
            />
          )}
          <span className="badge-premium">Unión Deportiva</span>
          <h1 className="hero-title">UD <span className="text-primary">SANTISO</span></h1>
          <p className="hero-subtitle">Pasión, Orgullo y Compromiso en cada partido de nuestra liga.</p>
          <div className="hero-actions">
            <Link href="/partidos" className="btn-premium btn-primary">Calendario</Link>
            <Link href="/clasificacion" className="btn-premium btn-outline">Clasificación</Link>
          </div>
        </div>
      </section>

      {/* Fixtures Widget */}
      <section id="fixtures" className="section-fixtures">
        <div className="container">
          <div className="fixtures-card glass shadow-glare">
            <h3 className="card-tag">Próximos Partidos</h3>
            {isLoading ? (
              <LoadingState
                title="Cargando próximos partidos"
                detail="Preparando calendario e escudos."
              />
            ) : Array.isArray(proximoPartido) && proximoPartido.length > 0 ? (
              <>
                <div className="matches-grid">
                  {proximoPartido.map((partido) => (
                    <div key={partido.id} className="match-card-individual">
                      <h4 className="match-category-label">{partido.categoria}</h4>
                      <div className="match-display-small">
                        <div className="team-box-small">
                          {partido.local?.escudo_url ? (
                            <Image
                              src={partido.local.escudo_url}
                              alt={partido.local.nombre}
                              className="team-logo-small"
                              width={70}
                              height={70}
                            />
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
                              {formatMatchDate(partido.fecha)}
                            </span>
                            <span className="match-time-small">
                              {formatMatchTime(partido.fecha)}
                            </span>
                          </div>
                        </div>
                        <div className="team-box-small">
                          {partido.visitante?.escudo_url ? (
                            <Image
                              src={partido.visitante.escudo_url}
                              alt={partido.visitante.nombre}
                              className="team-logo-small"
                              width={70}
                              height={70}
                            />
                          ) : (
                            <div className="team-badge-small bg-muted">{partido.visitante?.nombre?.[0] || 'V'}</div>
                          )}
                          <span>{partido.visitante?.nombre || 'Visitante'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: '3rem' }}>
                  <Link href="/partidos" className="btn-premium btn-outline" style={{ fontSize: '0.8rem' }}>Ver calendario completo</Link>
                </div>
              </>
            ) : (
              <EmptyState
                title="Calendario pendente"
                detail="Aínda non hai próximos partidos cargados."
              />
            )}
          </div>
        </div>
      </section>

      {/* Squad Teaser Banner */}
      <section className="section-padding">
        <div className="container">
          <div className="squad-teaser glass shadow-glare">
            <div className="teaser-content">
              <h2 className="teaser-title">Nuestros <span className="text-primary">Guerreros</span></h2>
              <p className="teaser-desc">Descubre a los protagonistas de esta temporada. Desde la cantera hasta los veteranos, todos unidos por un escudo.</p>
              <Link href="/plantilla" className="btn-premium btn-primary">Ver Plantilla Completa</Link>
            </div>
            <div className="teaser-visual">
               <div className="visual-circle"></div>
               <div className="visual-cards">
                  <div className="v-card c1"></div>
                  <div className="v-card c2"></div>
                  <div className="v-card c3"></div>
               </div>
            </div>
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
                  <Image
                    src={s.logo_url}
                    alt={s.nombre}
                    className="sponsor-logo"
                    title={s.nombre}
                    width={350}
                    height={180}
                    style={{ objectFit: 'contain' }}
                  />
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

        .squad-teaser { padding: 4rem; border-radius: 2rem; display: flex; align-items: center; justify-content: space-between; gap: 4rem; overflow: hidden; position: relative; }
        .teaser-content { flex: 1; z-index: 2; }
        .teaser-title { font-size: 3.5rem; font-weight: 900; margin-bottom: 1.5rem; }
        .teaser-desc { font-size: 1.2rem; color: #a3a3a3; margin-bottom: 2.5rem; max-width: 500px; }
        
        .teaser-visual { flex: 0.8; position: relative; height: 300px; display: flex; align-items: center; justify-content: center; }
        .visual-circle { position: absolute; width: 400px; height: 400px; border: 1px solid rgba(250, 204, 21, 0.1); border-radius: 50%; }
        .visual-cards { position: relative; width: 100%; height: 100%; }
        .v-card { position: absolute; width: 120px; height: 160px; background: rgba(250, 204, 21, 0.1); border: 1px solid rgba(250, 204, 21, 0.3); border-radius: 1rem; backdrop-filter: blur(5px); }
        .c1 { left: 10%; top: 20%; transform: rotate(-15deg); }
        .c2 { left: 40%; top: 10%; transform: rotate(0deg); background: rgba(250, 204, 21, 0.2); border-color: var(--primary); z-index: 2; }
        .c3 { left: 70%; top: 30%; transform: rotate(15deg); }

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

        @media (max-width: 768px) {
          .hero-title { font-size: 3.5rem; }
          .hero-subtitle { font-size: 1.1rem; }
          .squad-teaser { flex-direction: column; text-align: center; padding: 3rem 1.5rem; }
          .teaser-title { font-size: 2.5rem; }
          .teaser-visual { display: none; }
          .teaser-desc { margin: 0 auto 2.5rem; }
        }
      `}</style>
    </main>
  );
}
