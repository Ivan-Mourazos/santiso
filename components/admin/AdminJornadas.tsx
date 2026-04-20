"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface AdminJornadasProps {
  showToast: (msg: string, type?: "success" | "error") => void;
  showConfirm: (msg: string, onConfirm: () => void) => void;
  categoria: string;
}

export default function AdminJornadas({ showToast, showConfirm, categoria }: AdminJornadasProps) {
  const [jornadas, setJornadas] = useState<any[]>([]);
  const [equipos, setEquipos] = useState<any[]>([]);
  const [partidos, setPartidos] = useState<any[]>([]);
  const [temporadas, setTemporadas] = useState<any[]>([]);
  const [temporadaActiva, setTemporadaActiva] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const [selectedJornada, setSelectedJornada] = useState<string | null>(null);

  // New Matchday form
  const [numJornada, setNumJornada] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");

  // New Season form
  const [nuevaTemporadaNombre, setNuevaTemporadaNombre] = useState("");

  // New Match form
  const [localId, setLocalId] = useState("");
  const [visitanteId, setVisitanteId] = useState("");
  const [fechaPartido, setFechaPartido] = useState("");
  const [lugarPartido, setLugarPartido] = useState("");

  useEffect(() => {
    fetchBaseData();
  }, [categoria]);

  async function fetchBaseData() {
    // Temporadas
    const { data: tData } = await supabase.from("temporadas").select("*").order("created_at", { ascending: false });
    if (tData) {
      setTemporadas(tData);
      const activa = tData.find((t: any) => t.activa) || tData[0];
      if (activa) setTemporadaActiva(activa);
    }

    // Equipos de la categoría
    const { data: eData } = await supabase.from("equipos").select("*").eq("categoria", categoria).order("nombre");
    if (eData) setEquipos(eData);
  }

  useEffect(() => {
    if (temporadaActiva) {
      fetchJornadas();
    }
  }, [temporadaActiva, categoria]);

  async function fetchJornadas() {
    const { data } = await supabase
      .from("jornadas")
      .select("*")
      .eq("temporada_id", temporadaActiva.id)
      .eq("categoria", categoria)
      .order("numero", { ascending: true });
    
    if (data) {
      setJornadas(data);
      if (data.length > 0 && !selectedJornada) {
        // Auto-select initial matchday
        setSelectedJornada(data[0].id);
      } else if (data.length === 0) {
        setSelectedJornada(null);
      }
    }
  }

  async function handleCreateTemporada(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevaTemporadaNombre) return;
    setLoading(true);
    const { error } = await supabase.from("temporadas").insert([{ 
      nombre: nuevaTemporadaNombre, 
      activa: temporadas.length === 0 
    }]);
    if (!error) {
      showToast("Temporada creada");
      setNuevaTemporadaNombre("");
      fetchBaseData();
    } else {
      console.error("Error creating season:", error);
      showToast("Error al crear: " + error.message, "error");
    }
    setLoading(false);
  }

  async function toggleTemporadaActiva(id: string) {
    setLoading(true);
    await supabase.from("temporadas").update({ activa: false }).neq("id", id);
    const { error } = await supabase.from("temporadas").update({ activa: true }).eq("id", id);
    if (!error) {
      showToast("Temporada activa cambiada");
      fetchBaseData();
    } else {
      console.error("Error changing active season:", error);
      showToast("Error al activar: " + error.message, "error");
    }
    setLoading(false);
  }

  useEffect(() => {
    if (selectedJornada) {
      fetchPartidos();
    }
  }, [selectedJornada]);

  async function fetchPartidos() {
    const { data } = await supabase
      .from("partidos_liga")
      .select("*")
      .eq("jornada_id", selectedJornada)
      .order("fecha", { ascending: true });
    if (data) setPartidos(data);
  }

  async function handleCreateJornada(e: React.FormEvent) {
    e.preventDefault();
    if (!temporadaActiva) return showToast("No hay temporada activa", "error");
    setLoading(true);

    const { error } = await supabase.from("jornadas").insert([{
      temporada_id: temporadaActiva.id,
      categoria,
      numero: parseInt(numJornada),
      fecha_inicio: fechaInicio || null
    }]);

    if (!error) {
      showToast("Jornada creada");
      setNumJornada("");
      fetchJornadas();
    } else {
      showToast("Error al crear jornada", "error");
    }
    setLoading(false);
  }

  async function handleAddPartido(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedJornada || !localId || !visitanteId) return;
    if (localId === visitanteId) return showToast("Un equipo no puede jugar contra sí mismo", "error");
    
    setLoading(true);
    const { error } = await supabase.from("partidos_liga").insert([{
      jornada_id: selectedJornada,
      categoria,
      equipo_local_id: localId,
      equipo_visitante_id: visitanteId,
      fecha: fechaPartido || null,
      lugar: lugarPartido || null,
      estado: "programado"
    }]);

    if (!error) {
      showToast("Partido añadido");
      setLocalId(""); setVisitanteId(""); setLugarPartido("");
      fetchPartidos();
    }
    setLoading(false);
  }

  async function updatePartidoState(id: string, field: string, value: any) {
    // Si cambia de estado, update inmediatament
    const updateObj = { [field]: value };
    const { error } = await supabase.from("partidos_liga").update(updateObj).eq("id", id);
    if (!error) fetchPartidos();
  }

  async function saveMatchScore(id: string, local: number, vis: number) {
    const { error } = await supabase.from("partidos_liga").update({
      goles_local: local,
      goles_visitante: vis
    }).eq("id", id);
    if (!error) showToast("Marcador guardado");
  }

  async function handleDeletePartido(id: string) {
    showConfirm("¿Borrar este partido de la jornada?", async () => {
      await supabase.from("partidos_liga").delete().eq("id", id);
      fetchPartidos();
      showToast("Partido eliminado");
    });
  }

  async function handleDeleteJornada(id: string) {
    showConfirm("¿Eliminar TODA la jornada y sus partidos? Esto recalculará la clasificación.", async () => {
      await supabase.from("jornadas").delete().eq("id", id);
      setSelectedJornada(null);
      fetchJornadas();
      showToast("Jornada borrada");
    });
  }

  const getTeamName = (id: string) => equipos.find(e => e.id === id)?.nombre || "Desconocido";
  const getTeamShield = (id: string) => equipos.find(e => e.id === id)?.escudo_url || "";

  return (
    <div className="card glass full-width" style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 1fr) 3fr', gap: '2rem' }}>
      
      {/* Columna Izquierda: selector de temporadas y jornadas */}
      <div style={{ borderRight: '1px solid rgba(255,255,255,0.1)', paddingRight: '2rem' }}>
        <h3 style={{ marginBottom: '1.5rem', fontSize: '1.2rem' }}>Configuración Liga</h3>
        
        {/* Gestión de Temporadas */}
        <div style={{ marginBottom: '2rem' }}>
          <span style={{ fontSize: '0.7rem', color: '#a3a3a3', textTransform: 'uppercase', fontWeight: 800 }}>Temporadas</span>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
            {temporadas.map(t => (
              <div key={t.id} style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                padding: '0.5rem', 
                background: t.activa ? 'rgba(250, 204, 21, 0.1)' : 'rgba(255,255,255,0.03)',
                border: t.activa ? '1px solid var(--primary)' : '1px solid transparent',
                borderRadius: '6px'
              }}>
                <span style={{ fontSize: '0.9rem', fontWeight: t.activa ? 800 : 400 }}>{t.nombre}</span>
                {!t.activa && (
                  <button onClick={() => toggleTemporadaActiva(t.id)} style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer' }}>Activar</button>
                )}
              </div>
            ))}
          </div>

          <form onSubmit={handleCreateTemporada} style={{ display: 'flex', gap: '0.4rem', marginTop: '0.8rem' }}>
            <input 
              type="text" 
              placeholder="Nueva (24/25)" 
              value={nuevaTemporadaNombre}
              onChange={e => setNuevaTemporadaNombre(e.target.value)}
              style={{ flex: 1, padding: '0.4rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '0.8rem', borderRadius: '4px' }}
            />
            <button type="submit" disabled={loading} style={{ background: 'var(--primary)', color: 'black', border: 'none', padding: '0 0.5rem', borderRadius: '4px', fontWeight: 900, cursor: 'pointer' }}>+</button>
          </form>
        </div>

        {/* Lista de Jornadas */}
        <div style={{ marginBottom: '1rem' }}>
          <span style={{ fontSize: '0.7rem', color: '#a3a3a3', textTransform: 'uppercase', fontWeight: 800 }}>Jornadas ({categoria})</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '2rem' }}>
          {jornadas.map(j => (
             <div 
               key={j.id} 
               onClick={() => setSelectedJornada(j.id)}
               style={{
                 padding: '0.8rem 1rem',
                 background: selectedJornada === j.id ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                 color: selectedJornada === j.id ? 'black' : 'white',
                 borderRadius: '8px',
                 cursor: 'pointer',
                 fontWeight: 700,
                 display: 'flex',
                 justifyContent: 'space-between'
               }}>
               <span>Jornada {j.numero}</span>
               <button 
                 onClick={(e) => { e.stopPropagation(); handleDeleteJornada(j.id); }} 
                 style={{ background: 'none', border: 'none', color: selectedJornada === j.id ? 'black' : '#ef4444', cursor: 'pointer', opacity: 0.6 }}>✖</button>
             </div>
          ))}
        </div>

        {/* Creador de Jornadas */}
        <form onSubmit={handleCreateJornada} style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
          <h4 style={{ fontSize: '0.9rem', marginBottom: '0.8rem', color: '#888' }}>Nueva Jornada</h4>
          <input type="number" placeholder="Número (ej: 1)" value={numJornada} onChange={e => setNumJornada(e.target.value)} required style={{ width: '100%', marginBottom: '0.5rem', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', borderRadius: '4px' }} />
          <button type="submit" disabled={loading} style={{ width: '100%', padding: '0.5rem', background: 'var(--primary)', color: 'black', border: 'none', borderRadius: '4px', fontWeight: 800, cursor: 'pointer' }}>Crear Jornada</button>
        </form>
      </div>

      {/* Columna Derecha: Partidos de la Jornada seleccionada */}
      <div>
        {selectedJornada ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3>Partidos de la Jornada {jornadas.find(j => j.id === selectedJornada)?.numero}</h3>
              <p style={{ fontSize: '0.8rem', color: '#a3a3a3' }}>Los resultados en estado 'Finalizado' automatizan la Clasificación.</p>
            </div>

            {/* Creador de Partidos */}
            <form onSubmit={handleAddPartido} className="form-grid-4" style={{ background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="input-group">
                <label>Equipo Local</label>
                <select value={localId} onChange={e => setLocalId(e.target.value)} required style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '0.6rem', borderRadius: '6px' }}>
                  <option value="">Selecciona...</option>
                  {equipos.map(eq => <option key={eq.id} value={eq.id}>{eq.nombre}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label>Equipo Visitante</label>
                <select value={visitanteId} onChange={e => setVisitanteId(e.target.value)} required style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '0.6rem', borderRadius: '6px' }}>
                  <option value="">Selecciona...</option>
                  {equipos.map(eq => <option key={eq.id} value={eq.id}>{eq.nombre}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label>Fecha y Hora</label>
                <input type="datetime-local" value={fechaPartido} onChange={e => setFechaPartido(e.target.value)} style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '0.6rem', borderRadius: '6px' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button type="submit" disabled={loading} style={{ width: '100%', padding: '0.8rem', background: 'rgba(255,255,255,0.1)', border: '1px dashed rgba(255,255,255,0.2)', color: 'white', fontWeight: 600, borderRadius: '6px', cursor: 'pointer' }}>
                  + Añadir Partido
                </button>
              </div>
            </form>

            {/* Listado de Partidos */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {partidos.length === 0 && <p style={{ color: '#666', textAlign: 'center', padding: '2rem' }}>No hay partidos en esta jornada.</p>}
              
              {partidos.map(p => {
                const localName = getTeamName(p.equipo_local_id);
                const visName = getTeamName(p.equipo_visitante_id);
                const localShield = getTeamShield(p.equipo_local_id);
                const visShield = getTeamShield(p.equipo_visitante_id);
                
                return (
                  <div key={p.id} style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid rgba(255,255,255,0.05)' }}>
                    
                    {/* Equipos */}
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem', fontWeight: 800 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, justifyContent: 'flex-end', textAlign: 'right' }}>
                        {localName} 
                        {localShield && <img src={localShield} alt="" style={{ width: 24, height: 24, objectFit: 'contain' }} />}
                      </div>
                      
                      {/* Marcador */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '8px' }}>
                        <input type="number" value={p.goles_local} onChange={e => {
                          const val = parseInt(e.target.value) || 0;
                          setPartidos(prev => prev.map(pt => pt.id === p.id ? { ...pt, goles_local: val } : pt));
                        }} style={{ width: '40px', background: 'transparent', border: 'none', color: 'white', fontWeight: 900, textAlign: 'center', fontSize: '1.2rem' }} />
                        <span style={{ color: '#666' }}>-</span>
                        <input type="number" value={p.goles_visitante} onChange={e => {
                          const val = parseInt(e.target.value) || 0;
                          setPartidos(prev => prev.map(pt => pt.id === p.id ? { ...pt, goles_visitante: val } : pt));
                        }} style={{ width: '40px', background: 'transparent', border: 'none', color: 'white', fontWeight: 900, textAlign: 'center', fontSize: '1.2rem' }} />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                         {visShield && <img src={visShield} alt="" style={{ width: 24, height: 24, objectFit: 'contain' }} />}
                         {visName}
                      </div>
                    </div>

                    {/* Controles */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginLeft: '2rem' }}>
                       <select value={p.estado} onChange={e => updatePartidoState(p.id, 'estado', e.target.value)} style={{ padding: '0.4rem', borderRadius: '4px', background: p.estado === 'finalizado' ? '#10b981' : p.estado === 'en_juego' ? '#ef4444' : 'rgba(255,255,255,0.1)', color: p.estado === 'programado' ? 'white' : 'black', fontWeight: 800, border: 'none' }}>
                         <option value="programado">Programado</option>
                         <option value="en_juego">Activo</option>
                         <option value="finalizado">Finalizado</option>
                       </select>
                       <button onClick={() => saveMatchScore(p.id, p.goles_local, p.goles_visitante)} style={{ background: 'var(--primary)', border: 'none', color: 'black', padding: '0.4rem 0.8rem', borderRadius: '4px', fontWeight: 800, cursor: 'pointer' }}>Guardar</button>
                       <button onClick={() => handleDeletePartido(p.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>🗑️</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#666' }}>
            Selecciona una jornada para ver sus partidos.
          </div>
        )}
      </div>
    </div>
  );
}
