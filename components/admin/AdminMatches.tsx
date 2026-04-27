"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase-browser";
import BusyBanner from "./BusyBanner";
import { getCompetitionsByCategory } from "@/lib/competition";
import { fetchTeamsForCompetition } from "@/lib/supabase-queries";

interface AdminMatchesProps {
  showToast: (msg: string, type?: "success" | "error") => void;
  showConfirm: (msg: string, onConfirm: () => void) => void;
  categoria: string;
}

export default function AdminMatches({ showToast, showConfirm, categoria }: AdminMatchesProps) {
  const [partidos, setPartidos] = useState<any[]>([]);
  const [rival, setRival] = useState("");
  const [fecha, setFecha] = useState("");
  const [lugar, setLugar] = useState("");
  const [equipos, setEquipos] = useState<any[]>([]);
  const [competiciones, setCompeticiones] = useState<string[]>([]);
  const [competicion, setCompeticion] = useState("");
  const [loading, setLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [busyText, setBusyText] = useState("Cargando partidos...");
  const [rowBusy, setRowBusy] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const opts = getCompetitionsByCategory(categoria);
    setCompeticiones(opts);
    setCompeticion(opts[0] || "");
  }, [categoria]);

  useEffect(() => {
    if (!competicion) return;
    fetchPartidos();
    fetchEquipos();
  }, [categoria, competicion]);

  async function fetchPartidos() {
    setIsFetching(true);
    const { data } = await supabase.from("partidos").select("*").eq("categoria", categoria).eq("competicion", competicion).order("fecha", { ascending: true });
    if (data) setPartidos(data);
    setIsFetching(false);
  }

  async function fetchEquipos() {
    const data = await fetchTeamsForCompetition(categoria, competicion);
    setEquipos(data);
  }

  const handleDeletePartido = async (id: string) => {
    showConfirm("¿Borrar este partido del calendario?", async () => {
      setRowBusy(prev => ({ ...prev, [id]: true }));
      const { error } = await supabase.from("partidos").delete().eq("id", id);
      if (!error) {
        showToast("Partido eliminado");
        fetchPartidos();
      }
      setRowBusy(prev => ({ ...prev, [id]: false }));
    });
  };

  async function handleAddPartido(e: React.FormEvent) {
    e.preventDefault();
    setBusyText("Guardando nuevo partido...");
    setLoading(true);

    let rival_escudo_url = "";
    const equipoEncontrado = equipos.find(eq => eq.nombre === rival);
    if (equipoEncontrado) rival_escudo_url = equipoEncontrado.escudo_url;

    const { error } = await supabase.from("partidos").insert([{ 
      rival, fecha, lugar, categoria, competicion, rival_escudo_url 
    }]);

    if (!error) {
      setRival(""); setFecha(""); setLugar("");
      fetchPartidos();
      showToast("Partido añadido al calendario");
    }
    setLoading(false);
  }

  async function handleUpdateScore(id: string, gLocal: number, gRival: number, estado: string) {
    setBusyText("Guardando resultado...");
    setRowBusy(prev => ({ ...prev, [id]: true }));
    setLoading(true);
    const { error } = await supabase.from("partidos").update({
      goles_local: gLocal,
      goles_rival: gRival,
      estado
    }).eq("id", id);
    
    if (!error) {
      showToast("Marcador actualizado");
      fetchPartidos();
    }
    setRowBusy(prev => ({ ...prev, [id]: false }));
    setLoading(false);
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
      <BusyBanner show={loading || isFetching} text={isFetching ? "Cargando partidos..." : busyText} />
      <div className="input-group" style={{ marginBottom: "1rem", maxWidth: "480px" }}>
        <label>Competición</label>
        <select value={competicion} onChange={(e) => setCompeticion(e.target.value)} disabled={loading || isFetching}>
          {competiciones.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h3>Gestión de Partidos ({categoria})</h3>
          <p style={{ color: '#a3a3a3', fontSize: '0.85rem' }}>Añade y actualiza los resultados de la jornada.</p>
        </div>
      </div>

      <form onSubmit={handleAddPartido} className="admin-form">
        <div className="form-grid-3">
          <div className="input-group">
            <label>Seleccionar Rival</label>
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
          <div style={{ display: 'flex', alignItems: 'flex-end', gridColumn: 'span 3' }}>
            <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%' }}>
              {loading ? "Añadiendo..." : "Añadir Partido al Calendario"}
            </button>
          </div>
        </div>
      </form>

      <div style={{ marginTop: '3rem' }}>
        <h4 style={{ marginBottom: '1rem', fontSize: '0.9rem', color: '#666', textTransform: 'uppercase', letterSpacing: '1px' }}>Calendario y Resultados</h4>
        <div className="matches-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          {partidos.map(p => (
            <div key={p.id} className="admin-item glass shadow-sm" style={{ 
              display: 'grid', 
              gridTemplateColumns: 'minmax(200px, 2fr) 1fr 1.5fr auto',
              alignItems: 'center', 
              padding: '1.2rem', 
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.05)',
              gap: '20px'
            }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 700, marginBottom: '4px' }}>
                  {new Date(p.fecha).toLocaleString([], { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '10px', color: 'white' }}>
                  {p.rival_escudo_url && <img src={p.rival_escudo_url} alt="" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />}
                  {p.rival}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '4px' }}>{p.lugar}</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <input type="text" inputMode="numeric" pattern="[0-9]*" className="score-input" value={p.goles_local ?? 0} onChange={(e) => handleScoreChange(p.id, 'goles_local', e.target.value)} />
                <span style={{ fontWeight: 900, color: '#444' }}>-</span>
                <input type="text" inputMode="numeric" pattern="[0-9]*" className="score-input" value={p.goles_rival ?? 0} onChange={(e) => handleScoreChange(p.id, 'goles_rival', e.target.value)} />
              </div>

              <div>
                <select className="status-select" value={p.estado} onChange={(e) => handleStatusChange(p.id, e.target.value)}>
                  <option value="programado">📅 Programado</option>
                  <option value="finalizado">🏁 Finalizado</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button disabled={!!rowBusy[p.id]} onClick={() => handleUpdateScore(p.id, p.goles_local, p.goles_rival, p.estado)} className="btn-primary" style={{ padding: '0.6rem 1.2rem', fontSize: '0.8rem', opacity: rowBusy[p.id] ? 0.7 : 1 }}>
                  {rowBusy[p.id] ? "Guardando..." : "Guardar"}
                </button>
                <button disabled={!!rowBusy[p.id]} onClick={() => handleDeletePartido(p.id)} className="btn-delete-icon" title="Borrar partido" style={{ opacity: rowBusy[p.id] ? 0.5 : 1 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        .score-input {
          width: 50px;
          height: 40px;
          text-align: center;
          background: rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          color: white;
          font-weight: 800;
          font-size: 1.1rem;
        }
        .score-input:focus { border-color: var(--primary); outline: none; }
        
        .status-select {
          width: 100%;
          height: 40px;
          background: rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          color: white;
          padding: 0 10px;
          font-size: 0.85rem;
          font-weight: 600;
        }

        .btn-delete-icon {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          color: #ef4444;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          transition: all 0.2s;
          cursor: pointer;
        }
        .btn-delete-icon:hover {
          background: #ef4444;
          color: white;
        }
      `}</style>
    </div>
  );
}
