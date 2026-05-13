"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface BracketTreeProps {
  categoria: string;
  competicionId: string;
}

export default function BracketTree({ categoria, competicionId }: BracketTreeProps) {
  const [rondas, setRondas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    if (!competicionId) return;
    let cancelled = false;

    async function loadTree() {
      setLoading(true);
      setErrorText(null);

      try {
        // 1. Fetch jornadas de esta competición
        const { data: jornadasData, error: jErr } = await supabase
          .from("jornadas")
          .select("*")
          .eq("categoria", categoria)
          .eq("competicion_id", competicionId)
          .order("numero", { ascending: true });

        if (jErr) throw jErr;

        // 2. Fetch todos los partidos de esta competición con los equipos embebidos
        const { data: partidosData, error: pErr } = await supabase
          .from("partidos_liga")
          .select("*, equipo_local:equipo_local_id(*), equipo_visitante:equipo_visitante_id(*)")
          .eq("categoria", categoria)
          .eq("competicion_id", competicionId)
          .order("fecha", { ascending: true });

        if (pErr) throw pErr;

        if (cancelled) return;

        // 3. Agrupar partidos por jornada
        const treeRounds = (jornadasData || []).map((j: any) => {
          const matches = (partidosData || []).filter((p: any) => p.jornada_id === j.id);
          return {
            id: j.id,
            numero: j.numero,
            nombre: j.nombre_fase || `Ronda ${j.numero}`,
            partidos: matches,
          };
        });

        setRondas(treeRounds);
      } catch (err: any) {
        setErrorText(err.message || "Error al cargar el cuadrante");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadTree();

    return () => {
      cancelled = true;
    };
  }, [categoria, competicionId]);

  if (loading) {
    return (
      <div className="loading-bracket">
        <div className="loader"></div>
        <p>Cargando cuadrante de eliminatorias...</p>
        <style jsx>{`
          .loading-bracket { padding: 4rem; text-align: center; color: #a3a3a3; display: flex; flex-direction: column; align-items: center; gap: 1rem; }
          .loader { width: 32px; height: 32px; border: 3px solid rgba(250, 204, 21, 0.1); border-top-color: var(--primary); border-radius: 50%; animation: spin 0.8s linear infinite; }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  if (errorText) {
    return (
      <div className="error-bracket glass shadow-glare">
        <p>⚠️ {errorText}</p>
        <style jsx>{`
          .error-bracket { padding: 2rem; color: #ef4444; text-align: center; border: 1px solid rgba(239,68,68,0.2); border-radius: 16px; }
        `}</style>
      </div>
    );
  }

  if (rondas.length === 0) {
    return (
      <div className="empty-bracket glass shadow-glare">
        <h3>Sin eliminatorias configuradas</h3>
        <p>Añade jornadas/fases desde el panel de administración para visualizar el árbol.</p>
        <style jsx>{`
          .empty-bracket { padding: 4rem 2rem; text-align: center; color: #a3a3a3; border-radius: 16px; }
          h3 { color: white; margin-bottom: 0.5rem; }
        `}</style>
      </div>
    );
  }

  return (
    <div className="bracket-wrapper">
      <div className="bracket-container">
        {rondas.map((ronda, rIndex) => (
          <div key={ronda.id} className="bracket-column">
            <div className="round-header">
              <h4>{ronda.nombre}</h4>
              <span className="match-count">{ronda.partidos.length} partidos</span>
            </div>

            <div className="round-matches">
              {ronda.partidos.length === 0 ? (
                <div className="empty-match-slot">Sin partidos</div>
              ) : (
                ronda.partidos.map((p: any) => {
                  const locShield = p.equipo_local?.escudo_url;
                  const locName = p.equipo_local?.nombre || "TBD";
                  const visShield = p.equipo_visitante?.escudo_url;
                  const visName = p.equipo_visitante?.nombre || "TBD";
                  const isFinished = p.estado === "finalizado";

                  const locWon = isFinished && (p.goles_local || 0) > (p.goles_visitante || 0);
                  const visWon = isFinished && (p.goles_visitante || 0) > (p.goles_local || 0);

                  return (
                    <div key={p.id} className="match-node glass shadow-glare">
                      <div className={`team-row ${locWon ? "winner" : ""}`}>
                        <div className="team-ident">
                          {locShield ? <img src={locShield} alt="" className="node-shield" /> : <div className="shield-placeholder" />}
                          <span className="node-name">{locName}</span>
                        </div>
                        <span className="node-score">{isFinished ? p.goles_local : "-"}</span>
                      </div>

                      <div className="node-divider" />

                      <div className={`team-row ${visWon ? "winner" : ""}`}>
                        <div className="team-ident">
                          {visShield ? <img src={visShield} alt="" className="node-shield" /> : <div className="shield-placeholder" />}
                          <span className="node-name">{visName}</span>
                        </div>
                        <span className="node-score">{isFinished ? p.goles_visitante : "-"}</span>
                      </div>

                      {p.fecha && (
                        <div className="match-date">
                          {new Date(p.fecha).toLocaleDateString("es-ES", { timeZone: "UTC", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .bracket-wrapper {
          width: 100%;
          overflow-x: auto;
          padding: 1rem 0 2rem;
        }

        .bracket-container {
          display: flex;
          gap: 3rem;
          min-width: max-content;
          padding: 0 1rem;
        }

        .bracket-column {
          width: 280px;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .round-header {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 0.8rem 1rem;
          border-radius: 12px;
          text-align: center;
        }

        .round-header h4 {
          color: var(--primary);
          font-weight: 800;
          font-size: 1rem;
          margin: 0 0 0.2rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .match-count {
          font-size: 0.75rem;
          color: #888;
          font-weight: 600;
        }

        .round-matches {
          display: flex;
          flex-direction: column;
          justify-content: space-around;
          flex: 1;
          gap: 2rem;
        }

        .empty-match-slot {
          padding: 2rem;
          text-align: center;
          background: rgba(0,0,0,0.2);
          border: 1px dashed rgba(255,255,255,0.1);
          border-radius: 12px;
          color: #666;
          font-size: 0.85rem;
        }

        .match-node {
          padding: 0.8rem;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          position: relative;
          transition: transform 0.2s ease, border-color 0.2s ease;
        }

        .match-node:hover {
          transform: translateY(-2px);
          border-color: rgba(250, 204, 21, 0.3);
        }

        .team-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.4rem 0.2rem;
          border-radius: 6px;
          transition: background 0.2s ease;
        }

        .team-row.winner {
          background: rgba(250, 204, 21, 0.08);
        }

        .team-row.winner .node-name {
          color: var(--primary);
          font-weight: 800;
        }

        .team-row.winner .node-score {
          color: var(--primary);
          font-weight: 900;
        }

        .team-ident {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          min-width: 0;
          flex: 1;
        }

        .node-shield {
          width: 22px;
          height: 22px;
          object-fit: contain;
          flex-shrink: 0;
        }

        .shield-placeholder {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: rgba(255,255,255,0.05);
          flex-shrink: 0;
        }

        .node-name {
          font-size: 0.9rem;
          color: #d4d4d4;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .node-score {
          font-size: 1rem;
          color: #888;
          font-weight: 700;
          padding-left: 0.5rem;
        }

        .node-divider {
          height: 1px;
          background: rgba(255, 255, 255, 0.04);
          margin: 0.2rem 0;
        }

        .match-date {
          font-size: 0.65rem;
          color: #666;
          text-align: center;
          margin-top: 0.5rem;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}
