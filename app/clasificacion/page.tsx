"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ClasificacionPage() {
  const [equipos, setEquipos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClasificacion();
  }, []);

  async function fetchClasificacion() {
    // La magia está en el orden dinámico:
    // 1º Puntos (DESC)
    // 2º Diferencia de Goles (DESC) - Calculada en frontend o por DB
    // 3º Goles a Favor (DESC)
    const { data } = await supabase
      .from("equipos")
      .select("*")
      .order("pts", { ascending: false })
      .order("gf", { ascending: false }); // Aproximación, luego ordenamos DG en JS

    if (data) {
      // Orden final por Diferencia de Goles en JS
      const sorted = [...data].sort((a, b) => {
        if (b.pts !== a.pts) return b.pts - a.pts;
        const diffA = a.gf - a.gc;
        const diffB = b.gf - b.gc;
        if (diffB !== diffA) return diffB - diffA;
        return b.gf - a.gf;
      });
      setEquipos(sorted);
    }
    setLoading(false);
  }

  return (
    <main className="main-content">
      <section className="hero-simple glass-bg">
        <div className="container">
          <h1 className="hero-title">Clasificación <span className="text-primary">Liga</span></h1>
          <p className="hero-subtitle">Estado actual de la competición. Todos los equipos de nuestra categoría.</p>
        </div>
      </section>

      <section className="section-padding">
        <div className="container">
          {loading ? (
            <div className="loading-state">Cargando clasificación...</div>
          ) : (
            <div className="fixtures-card glass shadow-glare" style={{ padding: '0' }}>
              <table className="league-table">
                <thead>
                  <tr>
                    <th style={{ width: '60px' }}>POS</th>
                    <th>EQUIPO</th>
                    <th>PJ</th>
                    <th>PG</th>
                    <th>PE</th>
                    <th>PP</th>
                    <th>GF</th>
                    <th>GC</th>
                    <th>DG</th>
                    <th className="pts-col">PTS</th>
                  </tr>
                </thead>
                <tbody>
                  {equipos.map((eq, index) => (
                    <tr key={eq.id} className={index < 3 ? "top-rank" : ""}>
                      <td className="rank-num">
                        {index + 1}
                        {index === 0 && <span className="medal">🥇</span>}
                      </td>
                      <td className="team-cell">
                        <div className="team-info">
                          {eq.escudo_url && eq.escudo_url !== "" && (
                            <img src={eq.escudo_url} alt="" className="table-shield" />
                          )}
                          <span className="team-name">{eq.nombre}</span>
                        </div>
                      </td>
                      <td>{eq.pj}</td>
                      <td>{eq.pg}</td>
                      <td>{eq.pe}</td>
                      <td>{eq.pp}</td>
                      <td>{eq.gf}</td>
                      <td>{eq.gc}</td>
                      <td className={eq.gf - eq.gc >= 0 ? "text-green" : "text-red"}>
                        {eq.gf - eq.gc}
                      </td>
                      <td className="pts-col"><strong>{eq.pts}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <style jsx>{`
        .hero-simple { padding: 8rem 0 4rem; text-align: center; }
        .hero-title { font-size: 4rem; font-weight: 900; margin-bottom: 1rem; }
        .hero-subtitle { color: #a3a3a3; font-size: 1.1rem; }

        .section-padding { padding: 4rem 0 8rem; }
        
        .league-table { width: 100%; border-collapse: collapse; color: white; }
        .league-table th { padding: 1.5rem 1rem; text-align: center; font-size: 0.7rem; text-transform: uppercase; color: #666; letter-spacing: 2px; }
        .league-table th:nth-child(2) { text-align: left; }
        .league-table td { padding: 1.2rem 1rem; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .league-table td:nth-child(2) { text-align: left; }

        .team-info { display: flex; align-items: center; gap: 1rem; }
        .table-shield { width: 35px; height: 35px; object-fit: contain; }
        .team-name { font-weight: 700; font-size: 1.1rem; }

        .rank-num { font-weight: 900; color: #444; font-size: 1.2rem; position: relative; }
        .top-rank .rank-num { color: var(--primary); }
        .top-rank .team-name { color: white; }
        
        .pts-col { background: rgba(250, 204, 21, 0.05); color: var(--primary); font-size: 1.2rem; width: 80px; }
        .medal { position: absolute; left: -5px; top: 0; font-size: 0.8rem; }

        .text-green { color: #10b981; font-weight: bold; }
        .text-red { color: #ef4444; font-weight: bold; }

        .loading-state { text-align: center; padding: 5rem; color: #a3a3a3; }

        @media (max-width: 768px) {
          .league-table th:nth-child(4), .league-table td:nth-child(4),
          .league-table th:nth-child(5), .league-table td:nth-child(5),
          .league-table th:nth-child(6), .league-table td:nth-child(6) { display: none; }
          .team-name { font-size: 0.9rem; }
          .hero-title { font-size: 2.5rem; }
        }
      `}</style>
    </main>
  );
}
