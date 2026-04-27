"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

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
  foto_url: string | null;
}

interface PlayerCardStats {
  convocado: number;
  titular: number;
  pj: number;
  goles: number;
}

interface Temporada {
  id: string;
  nombre: string;
}

type CardPerson = Jugador | Staff;

function isStaffMember(person: CardPerson): person is Staff {
  return "tipo" in person;
}

export default function PlantillaPage() {
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [categoriaActiva, setCategoriaActiva] = useState("Senior");
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<Jugador | null>(null);
  const [temporadaActiva, setTemporadaActiva] = useState<Temporada | null>(null);
  const [santisoTeamIds, setSantisoTeamIds] = useState<string[]>([]);
  const [cardStats, setCardStats] = useState<Record<string, PlayerCardStats>>({});
  const [faseActiva, setFaseActiva] = useState("Total");
  const [fasesDisponibles, setFasesDisponibles] = useState<string[]>([]);
  const [playerStats, setPlayerStats] = useState({
    convocado: 0,
    titular: 0,
    suplente: 0,
    pj: 0,
    goles: 0,
    minutos: 0,
    golesEncajados: 0,
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

      const { data: sData } = await supabase.from("staff_club").select("*");
      if (sData) setStaff(sData);

      const { data: santisoTeams } = await supabase
        .from("equipos")
        .select("id")
        .ilike("nombre", "%santiso%");
      const santisoIds = (santisoTeams || []).map((team: { id: string }) => team.id);
      setSantisoTeamIds(santisoIds);
      if (temp && pData) {
        await loadCardStats(temp.id, pData as Jugador[]);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  async function loadCardStats(temporadaId: string, players: Jugador[]) {
    const { data: jornadas } = await supabase
      .from("jornadas")
      .select("id")
      .eq("temporada_id", temporadaId);
    const jornadaIds = jornadas?.map((j) => j.id) || [];
    const playerIds = players.map((player) => player.id);
    if (jornadaIds.length === 0 || playerIds.length === 0) {
      setCardStats({});
      return;
    }

    const { data: stats } = await supabase
      .from("jugador_partido_stats")
      .select("jugador_id, titular, jugo, goles, partidos_liga!inner(jornada_id)")
      .in("jugador_id", playerIds)
      .in("partidos_liga.jornada_id", jornadaIds);

    const next: Record<string, PlayerCardStats> = {};
    for (const row of stats || []) {
      const jugadorId = row.jugador_id as string;
      const current = next[jugadorId] || {
        convocado: 0,
        titular: 0,
        pj: 0,
        goles: 0,
      };
      current.convocado += 1;
      if (row.titular) current.titular += 1;
      if (row.jugo || row.titular) current.pj += 1;
      current.goles += Number(row.goles || 0);
      next[jugadorId] = current;
    }
    setCardStats(next);
  }

  useEffect(() => {
    const player = selectedPlayer;
    const temporada = temporadaActiva;
    if (!player || !temporada) return;

    async function getFases(categoria: string, temporadaId: string) {
      const { data: jData } = await supabase
        .from("jornadas")
        .select("competicion")
        .eq("temporada_id", temporadaId)
        .eq("categoria", categoria);

      if (jData) {
        const unicas = Array.from(
          new Set(jData.map((j) => j.competicion || "Liga")),
        );
        setFasesDisponibles(unicas);
      }
    }
    void getFases(player.categoria, temporada.id);
  }, [selectedPlayer, temporadaActiva]);

  useEffect(() => {
    const player = selectedPlayer;
    const temporada = temporadaActiva;
    if (!player || !temporada) return;

    async function loadDetailedStats(
      p: Jugador,
      temporadaId: string,
      fase: string,
    ) {
      let query = supabase
        .from("jornadas")
        .select("id")
        .eq("temporada_id", temporadaId)
        .eq("categoria", p.categoria);

      if (fase !== "Total") {
        query = query.eq("competicion", fase);
      }

      const { data: jornadas } = await query;
      const jornadaIds = jornadas?.map((j) => j.id) || [];
      if (jornadaIds.length === 0) {
        setPlayerStats({
          convocado: 0,
          titular: 0,
          suplente: 0,
          pj: 0,
          goles: 0,
          minutos: 0,
          golesEncajados: 0,
        });
        return;
      }

      const { data: stats } = await supabase
        .from("jugador_partido_stats")
        .select("*, partidos_liga!inner(*)")
        .eq("jugador_id", p.id)
        .in("partidos_liga.jornada_id", jornadaIds);

      if (stats) {
        let totalMin = 0;
        let totalGoles = 0;
        let totalEncajados = 0;
        const conv = stats.length;
        let tit = 0;
        let sup = 0;
        let pj = 0;

        stats.forEach((s) => {
          const isTitular = s.titular;
          const played = s.jugo || s.titular;
          if (played) pj++;
          if (isTitular) tit++;
          else if (played) sup++;
          totalGoles += s.goles || 0;

          if (p.posicion === "POR" && played) {
            const pl = s.partidos_liga;
            totalEncajados += santisoTeamIds.includes(pl.equipo_local_id)
              ? pl.goles_visitante
              : pl.goles_local;
          }
          if (played) totalMin += isTitular ? 90 : 25;
        });

        setPlayerStats({
          convocado: conv,
          titular: tit,
          suplente: sup,
          pj: pj,
          goles: totalGoles,
          minutos: totalMin,
          golesEncajados: totalEncajados,
        });
      }
    }
    void loadDetailedStats(player, temporada.id, faseActiva);
  }, [selectedPlayer, temporadaActiva, faseActiva, santisoTeamIds]);

  const jugadoresFiltrados = jugadores.filter(
    (j) => j.categoria === categoriaActiva,
  );
  const staffFiltrado = staff.filter(
    (s) =>
      s.tipo === "Tecnico" &&
      s.categoria?.toLowerCase() === categoriaActiva.toLowerCase(),
  );
  const directiva = staff.filter((s) => s.tipo === "Directiva");

  const Porteros = jugadoresFiltrados.filter((j) => j.posicion === "POR");
  const Defensas = jugadoresFiltrados.filter((j) =>
    ["DFC", "LD", "LI"].includes(j.posicion),
  );
  const Medios = jugadoresFiltrados.filter((j) =>
    ["MC", "MCD", "MCO", "MI", "MD"].includes(j.posicion),
  );
  const Delanteros = jugadoresFiltrados.filter((j) =>
    ["DC", "ED", "EI"].includes(j.posicion),
  );

  const renderFifaCard = (j: CardPerson, isSmall = true) => {
    const isStaff = isStaffMember(j);
    const name = isStaff ? j.nombre : j.nombre.split(" ").slice(0, 2).join(" ");
    const stats = !isStaff ? cardStats[j.id] : null;
    const rating = !isStaff
      ? Math.min(
          99,
          60 +
            (stats?.pj || 0) * 2 +
            (stats?.goles || 0) * 3 +
            (stats?.titular || 0) +
            (j.capitan ? 4 : 0),
        )
      : null;

    return (
      <div
        key={j.id}
        className={`fifa-card-container ${isSmall && !isStaff ? "clickable" : "no-scale"}`}
        onClick={isSmall && !isStaff ? () => setSelectedPlayer(j) : undefined}
      >
        <div className={`fifa-card premium-card ${categoriaActiva.toLowerCase()}`}>
          <div className="fifa-shine" />
          {!isStaff && (j.capitan ?? 0) > 0 && (
            <div className="fifa-capitan-badge" title={`Capitán ${j.capitan}`}>
              C
            </div>
          )}
          {!isStaff && (
            <div className="fifa-meta">
              <span className="fifa-dorsal">{rating}</span>
              <span className="fifa-pos">{j.posicion}</span>
              <span className="fifa-shirt">#{j.dorsal}</span>
            </div>
          )}
          <div className="fifa-img-box">
            {j.foto_url ? (
              <Image
                src={j.foto_url}
                alt={j.nombre}
                className="fifa-player-img"
                width={230}
                height={214}
              />
            ) : (
              <div className="fifa-placeholder">
                <svg
                  width="60"
                  height="60"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
            )}
          </div>
          <div className="fifa-info">
            <h4
              className="fifa-name"
              style={{
                fontSize: name.length > 15 ? "1.1rem" : "1.4rem",
                lineHeight: 1.1,
                marginBottom: "0.1rem",
              }}
            >
              {name}
            </h4>
            {!isStaff && j.apodo && (
              <p
                className="fifa-nickname"
                style={{ fontSize: "1rem", marginTop: "-0.2rem" }}
              >
                {j.apodo}
              </p>
            )}
            {!isStaff && (
              <div className="fifa-stats-strip">
                <span>
                  <strong>{stats?.pj || 0}</strong>
                  PJ
                </span>
                <span>
                  <strong>{stats?.goles || 0}</strong>
                  GOL
                </span>
                <span>
                  <strong>{stats?.titular || 0}</strong>
                  TIT
                </span>
              </div>
            )}
            {isStaff && (
              <p
                className="fifa-nickname"
                style={{
                  fontSize: "0.8rem",
                  opacity: 0.8,
                  color: "var(--primary)",
                  marginTop: "-0.2rem",
                }}
              >
                {j.cargo}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderSection = (titulo: string, lista: CardPerson[]) => {
    if (lista.length === 0) return null;
    return (
      <div className="pos-section">
        <h3 className="pos-title">{titulo}</h3>
        <div className="grid-pro">{lista.map((j) => renderFifaCard(j))}</div>
      </div>
    );
  };

  return (
    <main className="plantilla-page-v2">
      <div className="container">
        <div className="page-header">
          <h1 className="main-title">
            Nuestra <span className="text-primary">Plantilla</span>
          </h1>
          <p className="page-subtitle">
            Temporada {temporadaActiva?.nombre || "25/26"} - Unión Deportiva
            Santiso
          </p>
        </div>

        <div className="cat-selector">
          {["Senior", "Femenino", "Veteranos", "Directiva"].map((cat) => (
            <button
              key={cat}
              className={`cat-btn ${categoriaActiva === cat ? "active" : ""}`}
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
            {categoriaActiva === "Directiva" ? (
              renderSection("Junta Directiva", directiva)
            ) : (
              <>
                {renderSection("Porteros", Porteros)}
                {renderSection("Defensas", Defensas)}
                {renderSection("Centrocampistas", Medios)}
                {renderSection("Delanteros", Delanteros)}

                {/* STAFF */}
                {renderSection("Cuerpo Técnico", staffFiltrado)}
              </>
            )}
          </div>
        )}
      </div>

      {/* MODAL DETALLE JUGADOR */}
      {selectedPlayer && (
        <div className="modal-overlay" onClick={() => setSelectedPlayer(null)}>
          <div
            className="player-detail-card"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="close-detail"
              onClick={() => setSelectedPlayer(null)}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>

            <div className="detail-left">
              {renderFifaCard(selectedPlayer, false)}
              <div
                className="player-meta-badges"
                style={{ marginTop: "2rem", display: "flex", gap: "1rem" }}
              >
                <span className="badge-premium">
                  {selectedPlayer.categoria}
                </span>
                <span
                  className="badge-premium"
                  style={{
                    borderColor: "var(--primary)",
                    color: "var(--primary)",
                  }}
                >
                  SANTISO
                </span>
              </div>
            </div>

            <div className="detail-right">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <div>
                  <h2
                    className="detail-name"
                    style={{
                      fontSize: "2.5rem",
                      fontWeight: 900,
                      marginBottom: "0.2rem",
                    }}
                  >
                    {selectedPlayer.nombre}
                  </h2>
                  <p
                    className="detail-nickname"
                    style={{
                      color: "var(--primary)",
                      fontSize: "1.2rem",
                      fontWeight: 700,
                      marginBottom: "1rem",
                    }}
                  >
                    {selectedPlayer.apodo || "Sin apodo"}
                  </p>
                </div>
                <div className="fase-pill-selector">
                  {["Total", ...fasesDisponibles].length > 2 &&
                    ["Total", ...fasesDisponibles].map((f) => (
                      <button
                        key={f}
                        className={`fase-pill ${faseActiva === f ? "active" : ""}`}
                        onClick={() => setFaseActiva(f)}
                      >
                        {f}
                      </button>
                    ))}
                </div>
              </div>

              <div
                className="stats-sections-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "1.5rem",
                }}
              >
                {/* BLOQUE PARTICIPACIÓN */}
                <div className="stats-block">
                  <p className="block-title">Participación</p>
                  <div className="stats-row-mini">
                    <div className="mini-box">
                      <span>{playerStats.convocado}</span>
                      <label>Convocados</label>
                    </div>
                    <div className="mini-box">
                      <span>{playerStats.titular}</span>
                      <label>Titulares</label>
                    </div>
                    <div className="mini-box">
                      <span>{playerStats.suplente}</span>
                      <label>Suplentes</label>
                    </div>
                  </div>
                </div>

                {/* BLOQUE GOLES / PORTERÍA */}
                <div className="stats-block">
                  <p className="block-title">
                    {selectedPlayer.posicion === "POR"
                      ? "Portería"
                      : "Rendimiento Goleador"}
                  </p>
                  <div className="stats-row-mini">
                    {selectedPlayer.posicion === "POR" ? (
                      <>
                        <div className="mini-box">
                          <span>{playerStats.golesEncajados}</span>
                          <label>Encajados</label>
                        </div>
                        <div className="mini-box">
                          <span>
                            {(
                              playerStats.golesEncajados / (playerStats.pj || 1)
                            ).toFixed(2)}
                          </span>
                          <label>Media</label>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="mini-box">
                          <span>{playerStats.goles}</span>
                          <label>Goles</label>
                        </div>
                        <div className="mini-box">
                          <span>
                            {(
                              playerStats.goles / (playerStats.pj || 1)
                            ).toFixed(2)}
                          </span>
                          <label>Media</label>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* BLOQUE TIEMPO DE JUEGO */}
                <div className="stats-block" style={{ gridColumn: "span 2" }}>
                  <p className="block-title">Tiempo de Juego ({faseActiva})</p>
                  <div className="stats-row-mini">
                    <div className="mini-box" style={{ flex: 1 }}>
                      <span>{playerStats.minutos} min</span>
                      <label>Minutos Totales</label>
                    </div>
                    <div className="mini-box" style={{ flex: 1 }}>
                      <span>
                        {(playerStats.minutos / (playerStats.pj || 1)).toFixed(
                          1,
                        )}{" "}
                        min
                      </span>
                      <label>Promedio / Partido</label>
                    </div>
                  </div>
                </div>
              </div>

              <div
                className="detail-footer"
                style={{
                  marginTop: "auto",
                  paddingTop: "1.5rem",
                  borderTop: "1px solid rgba(255,255,255,0.05)",
                  fontSize: "0.75rem",
                  color: "#444",
                }}
              >
                <p>
                  Datos oficiales de la Temporada {temporadaActiva?.nombre} (
                  {faseActiva})
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .plantilla-page-v2 {
          padding: 2rem 0 6rem;
          min-height: 100vh;
          background: radial-gradient(circle at top, #1a1a1a 0%, #000 100%);
        }
        .page-header {
          text-align: center;
          margin-bottom: 4rem;
        }
        .main-title {
          font-size: 4rem;
          font-weight: 900;
          line-height: 1;
          margin-bottom: 1rem;
        }
        .page-subtitle {
          color: #666;
          font-size: 1.2rem;
        }

        .cat-selector {
          display: flex;
          gap: 0.5rem;
          padding: 0.5rem;
          border-radius: 1rem;
          margin: 0 auto 2.5rem;
          max-width: fit-content;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .cat-btn {
          padding: 0.8rem 2rem;
          border-radius: 0.7rem;
          border: none;
          background: transparent;
          color: #666;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.3s;
          text-transform: uppercase;
          font-size: 0.8rem;
          letter-spacing: 1px;
        }
        .cat-btn.active {
          background: var(--primary);
          color: black;
          box-shadow: 0 4px 15px rgba(250, 204, 21, 0.2);
        }

        .pos-section {
          margin-bottom: 0rem;
        }
        .pos-title {
          margin-bottom: 0.5rem;
        }
        .loading-state {
          text-align: center;
          padding: 5rem;
          font-size: 1.2rem;
          color: var(--primary);
          font-style: italic;
        }

        .block-title {
          color: #555;
          font-weight: 800;
          font-size: 0.65rem;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          margin-bottom: 1rem;
        }
        .stats-row-mini {
          display: flex;
          gap: 1rem;
        }
        .mini-box {
          background: rgba(255, 255, 255, 0.02);
          padding: 0.8rem;
          border-radius: 0.8rem;
          border: 1px solid rgba(255, 255, 255, 0.05);
          text-align: center;
          flex: 1;
        }
        .mini-box span {
          display: block;
          font-size: 1.4rem;
          font-weight: 900;
          color: white;
          line-height: 1;
          margin-bottom: 0.3rem;
        }
        .mini-box label {
          font-size: 0.55rem;
          text-transform: uppercase;
          color: #666;
          font-weight: 700;
          letter-spacing: 0.5px;
        }

        @media (max-width: 768px) {
          .main-title {
            font-size: 3rem;
          }
          .stats-sections-grid {
            grid-template-columns: 1fr !important;
          }
          .player-detail-card {
            flex-direction: column;
            overflow-y: auto;
          }
        }
      `}</style>
    </main>
  );
}
