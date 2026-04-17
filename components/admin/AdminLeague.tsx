"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface AdminLeagueProps {
  showToast: (msg: string, type?: "success" | "error") => void;
  categoria: string;
}

export default function AdminLeague({ showToast, categoria }: AdminLeagueProps) {
  const [equipos, setEquipos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchEquipos();
  }, [categoria]);

  async function fetchEquipos() {
    const { data } = await supabase.from("equipos").select("*").eq("categoria", categoria).order("nombre", { ascending: true });
    if (data) setEquipos(data);
    else setEquipos([]);
  }

  const handleInputChange = (id: string, field: string, value: string) => {
    const numValue = parseInt(value) || 0;
    setEquipos(prev => prev.map(eq => eq.id === id ? { ...eq, [field]: numValue } : eq));
  };

  async function handleSaveLeague() {
    setLoading(true);
    try {
      // Usamos una promesa múltiple para actualizar todos los equipos. 
      // En Supabase, el bulk update por ID es más complejo, así que vamos secuencialmente por simplicidad y robustez.
      const updates = equipos.map(eq => 
        supabase.from("equipos").update({
          pts: eq.pts,
          pj: eq.pj,
          pg: eq.pg,
          pe: eq.pe,
          pp: eq.pp,
          gf: eq.gf,
          gc: eq.gc
        }).eq("id", eq.id)
      );

      await Promise.all(updates);
      showToast("Clasificación guardada con éxito");
      fetchEquipos();
    } catch (err) {
      console.error(err);
      showToast("Error al guardar liga", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card full-width glass" style={{ marginBottom: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h3>Editor de Clasificación de la Liga</h3>
          <p style={{ color: '#a3a3a3', fontSize: '0.9rem' }}>Actualiza los puntos y estadísticas de todos los equipos en bloque.</p>
        </div>
        <button onClick={handleSaveLeague} className="btn btn-primary" disabled={loading} style={{ padding: '0.8rem 2rem' }}>
          {loading ? "Guardando..." : "Guardar Clasificación"}
        </button>
      </div>

      <div className="table-responsive">
        <table className="admin-table league-editor">
          <thead>
            <tr>
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
            {equipos.map(eq => (
              <tr key={eq.id}>
                <td>{eq.escudo_url && eq.escudo_url !== "" && <img src={eq.escudo_url} alt="" style={{ width: '30px', height: '30px', objectFit: 'contain' }} />}</td>
                <td style={{ fontWeight: 700 }}>{eq.nombre}</td>
                <td><input type="number" value={eq.pts} onChange={(e) => handleInputChange(eq.id, 'pts', e.target.value)} /></td>
                <td><input type="number" value={eq.pj} onChange={(e) => handleInputChange(eq.id, 'pj', e.target.value)} /></td>
                <td><input type="number" value={eq.pg} onChange={(e) => handleInputChange(eq.id, 'pg', e.target.value)} /></td>
                <td><input type="number" value={eq.pe} onChange={(e) => handleInputChange(eq.id, 'pe', e.target.value)} /></td>
                <td><input type="number" value={eq.pp} onChange={(e) => handleInputChange(eq.id, 'pp', e.target.value)} /></td>
                <td><input type="number" value={eq.gf} onChange={(e) => handleInputChange(eq.id, 'gf', e.target.value)} /></td>
                <td><input type="number" value={eq.gc} onChange={(e) => handleInputChange(eq.id, 'gc', e.target.value)} /></td>
                <td style={{ fontWeight: 800, color: (eq.gf - eq.gc) >= 0 ? '#10b981' : '#ef4444' }}>
                  {eq.gf - eq.gc}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style jsx>{`
        .league-editor input {
          width: 60px;
          padding: 0.4rem;
          text-align: center;
          font-weight: 700;
          border-color: rgba(255,255,255,0.1);
        }
        .league-editor input:focus {
          border-color: var(--primary);
          outline: none;
        }
        .league-editor td { padding: 0.5rem 1rem; }
      `}</style>
    </div>
  );
}
