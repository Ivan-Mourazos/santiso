"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface AdminMatchesProps {
  showToast: (msg: string, type?: "success" | "error") => void;
  categoria: string;
}

export default function AdminMatches({ showToast, categoria }: AdminMatchesProps) {
  const [partidos, setPartidos] = useState<any[]>([]);
  const [rival, setRival] = useState("");
  const [fecha, setFecha] = useState("");
  const [lugar, setLugar] = useState("");
  const [equipos, setEquipos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPartidos();
    fetchEquipos();
  }, [categoria]);

  async function fetchPartidos() {
    const { data } = await supabase.from("partidos").select("*").eq("categoria", categoria).order("fecha", { ascending: true });
    if (data) setPartidos(data);
  }

  async function fetchEquipos() {
    const { data } = await supabase.from("equipos").select("*").order("nombre", { ascending: true });
    if (data) setEquipos(data);
  }

  async function handleAddPartido(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    let rival_escudo_url = "";
    const equipoEncontrado = equipos.find(eq => eq.nombre === rival);
    if (equipoEncontrado) rival_escudo_url = equipoEncontrado.escudo_url;

    const { error } = await supabase.from("partidos").insert([{ 
      rival, fecha, lugar, categoria, rival_escudo_url 
    }]);

    if (!error) {
      setRival(""); setFecha(""); setLugar("");
      fetchPartidos();
      showToast("Partido añadido al calendario");
    }
    setLoading(false);
  }

  async function handleUpdateScore(id: string, gLocal: number, gRival: number, estado: string) {
    const { error } = await supabase.from("partidos").update({
      goles_local: gLocal,
      goles_rival: gRival,
      estado
    }).eq("id", id);
    
    if (!error) {
      showToast("Marcador actualizado");
      fetchPartidos();
    }
  }

  const handleScoreChange = (id: string, field: string, val: string) => {
    const numVal = parseInt(val) || 0;
    setPartidos(prev => prev.map(p => p.id === id ? { ...p, [field]: numVal } : p));
  };

  const handleStatusChange = (id: string, val: string) => {
    setPartidos(prev => prev.map(p => p.id === id ? { ...p, estado: val } : p));
  };

  return (
    <div className="card glass">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3>Gestión de Partidos ({categoria})</h3>
      </div>

      <form onSubmit={handleAddPartido} className="admin-form">
        <div className="form-grid-3">
          <div className="input-group">
            <label>Seleccionar Rival (Librería)</label>
            <select value={rival} onChange={(e) => setRival(e.target.value)} required>
              <option value="">Selección...</option>
              {equipos.map(eq => (
                <option key={eq.id} value={eq.nombre}>{eq.nombre}</option>
              ))}
            </select>
          </div>
          <div className="input-group">
            <label>Fecha y Hora</label>
            <input type="datetime-local" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
          </div>
          <div className="input-group">
            <label>Lugar</label>
            <input type="text" placeholder="Ej: Campo de Santiso" value={lugar} onChange={(e) => setLugar(e.target.value)} required />
          </div>
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading} style={{ padding: '0.8rem 2rem' }}>
          {loading ? "Añadiendo..." : "Añadir Partido"}
        </button>
      </form>

      <div className="table-responsive" style={{ marginTop: '2rem' }}>
        <table className="admin-table league-editor">
          <thead>
            <tr>
              <th>Fecha / Rival / Lugar</th>
              <th style={{ width: '120px' }}>Marcador</th>
              <th style={{ width: '150px' }}>Estado</th>
              <th style={{ width: '80px' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {partidos.map(p => (
              <tr key={p.id}>
                <td>
                  <div style={{ fontSize: '0.75rem', color: '#666' }}>{new Date(p.fecha).toLocaleString()}</div>
                  <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0' }}>
                    {p.rival_escudo_url && p.rival_escudo_url !== "" && <img src={p.rival_escudo_url} alt={p.rival} style={{ width: '20px', height: '20px', objectFit: 'contain' }} />}
                    {p.rival}
                  </div>
                  <div style={{ fontSize: '0.7rem' }}>{p.lugar}</div>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <input type="number" value={p.goles_local || 0} onChange={(e) => handleScoreChange(p.id, 'goles_local', e.target.value)} style={{ width: '45px', padding: '0.3rem', textAlign: 'center' }} />
                    <span>-</span>
                    <input type="number" value={p.goles_rival || 0} onChange={(e) => handleScoreChange(p.id, 'goles_rival', e.target.value)} style={{ width: '45px', padding: '0.3rem', textAlign: 'center' }} />
                  </div>
                </td>
                <td>
                  <select value={p.estado} onChange={(e) => handleStatusChange(p.id, e.target.value)} style={{ padding: '0.3rem', fontSize: '0.8rem' }}>
                    <option value="programado">Programado</option>
                    <option value="en_juego">En Juego</option>
                    <option value="finalizado">Finalizado</option>
                  </select>
                </td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <button onClick={() => handleUpdateScore(p.id, p.goles_local, p.goles_rival, p.estado)} className="btn-primary" style={{ fontSize: '0.7rem', padding: '0.3rem' }}>Guardar</button>
                    <button onClick={() => handleDeletePartido(p.id)} className="text-red" style={{ fontSize: '0.65rem' }}>Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <style jsx>{`
        .league-editor input { background: #111; border-color: #222; }
      `}</style>
    </div>
  );
}
