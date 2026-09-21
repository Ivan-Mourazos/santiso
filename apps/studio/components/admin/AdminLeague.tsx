"use client";
import { useState, useEffect } from "react";
import BusyBanner from "./BusyBanner";
import { useCompeticiones } from "@/lib/useCompeticiones";
import type { FilaClasificacion } from "@/lib/dto";
import { cargarPantallaClasificacion } from "@/lib/server/acciones/clasificacion";


interface AdminLeagueProps {
  showToast: (msg: string, type?: "success" | "error") => void;
  showConfirm: (msg: string, onConfirm: () => void) => void;
  categoria: string;
}

interface LeagueRule {
  id: string;
  nombre: string;
  puestos: number[];
  color: string;
}

export default function AdminLeague({ showToast, showConfirm, categoria }: AdminLeagueProps) {
  const [filas, setFilas] = useState<FilaClasificacion[]>([]);
  const { selectedCompetitionId, setSelectedCompetitionId, competicionesEnCategoria, loadingCompeticiones } = useCompeticiones(categoria, true);
  const [isFetching, setIsFetching] = useState(false);
  const [leagueRules, setLeagueRules] = useState<LeagueRule[]>([]);

  // Tabla y reglas llegan en una sola acción: Next despacha las del cliente de una en una.
  useEffect(() => {
    if (!selectedCompetitionId) {
      setFilas([]);
      setLeagueRules([]);
      setIsFetching(false);
      return;
    }
    let cancelado = false;
    (async () => {
      setIsFetching(true);
      const pantalla = await cargarPantallaClasificacion(selectedCompetitionId);
      if (cancelado) return;
      if (pantalla.ok) {
        setFilas(pantalla.datos.filas);
        setLeagueRules(pantalla.datos.reglas);
      } else {
        showToast(pantalla.error, "error");
      }
      setIsFetching(false);
    })();
    return () => {
      cancelado = true;
    };
  }, [selectedCompetitionId, showToast]);

  // Buscar la regla que aplica a una posición dada
  function getRuleForPosition(pos: number): LeagueRule | null {
    for (const rule of leagueRules) {
      if (rule.puestos.includes(pos)) return rule;
    }
    return null;
  }

  return (
    <div className="card full-width glass" style={{ marginBottom: '2rem' }}>
      <BusyBanner show={isFetching || loadingCompeticiones} text="Cargando clasificación..." />
      <div className="input-group" style={{ marginBottom: "1rem", maxWidth: "480px" }}>
        <label>Competición</label>
        <select
          value={selectedCompetitionId}
          onChange={(e) => setSelectedCompetitionId(e.target.value)}
          disabled={isFetching}
        >
          {competicionesEnCategoria.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
      </div>

      {/* LEYENDA DE REGLAS */}
      {leagueRules.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1.5rem",
            flexWrap: "wrap",
            padding: "0.8rem 1.2rem",
            marginBottom: "1.5rem",
            background: "rgba(255,255,255,0.02)",
            borderRadius: "10px",
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <span style={{ fontSize: "0.7rem", color: "#666", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1px" }}>
            Reglas
          </span>
          {leagueRules.map((rule) => (
            <span
              key={rule.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                fontSize: "0.8rem",
                color: "#a3a3a3",
              }}
            >
              <span
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "3px",
                  background: rule.color,
                  flexShrink: 0,
                }}
              />
              {rule.nombre} ({rule.puestos.sort((a, b) => a - b).join(", ")})
            </span>
          ))}
        </div>
      )}

      <div style={{ marginBottom: '1.5rem' }}>
        <h3>Clasificación</h3>
        <p style={{ color: '#a3a3a3', fontSize: '0.9rem' }}>
          Se calcula desde los partidos finalizados. El editor de sanciones y puntos concedidos
          llega en una fase posterior.
        </p>
      </div>

      <div className="table-responsive">
        <table className="admin-table league-editor">
          <thead>
            <tr>
              <th style={{ width: '40px' }}>#</th>
              <th style={{ width: '40px' }}>Logo</th>
              <th>Equipo</th>
              <th title="Puntos">PTS</th>
              <th title="Partidos Jugados">PJ</th>
              <th title="Victorias">PG</th>
              <th title="Empates">PE</th>
              <th title="Derrotas">PP</th>
              <th title="Goles a Favor">GF</th>
              <th title="Goles en Contra">GC</th>
              <th>DG</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((fila, index) => {
              const posicion = index + 1;
              const rule = getRuleForPosition(posicion);
              return (
                <tr
                  key={fila.equipoId}
                  style={
                    rule
                      ? {
                          borderLeft: `3px solid ${rule.color}`,
                          background: `${rule.color}0d`,
                        }
                      : undefined
                  }
                >
                  <td style={{ fontWeight: 800, color: rule ? rule.color : "#666", textAlign: "center" }}>
                    {posicion}
                  </td>
                  <td>{fila.escudoUrl && <img src={fila.escudoUrl} alt="" style={{ width: '30px', height: '30px', objectFit: 'contain' }} />}</td>
                  <td style={{ fontWeight: 700, color: rule ? rule.color : "white" }}>{fila.nombre}</td>
                  <td>{fila.puntos}</td>
                  <td>{fila.jugados}</td>
                  <td>{fila.ganados}</td>
                  <td>{fila.empatados}</td>
                  <td>{fila.perdidos}</td>
                  <td>{fila.golesFavor}</td>
                  <td>{fila.golesContra}</td>
                  <td style={{ fontWeight: 800, color: fila.diferencia >= 0 ? '#10b981' : '#ef4444' }}>
                    {fila.diferencia}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <style jsx>{`
        .league-editor td { padding: 0.5rem 1rem; }
      `}</style>
    </div>
  );
}