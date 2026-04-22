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
  const [campos, setCampos] = useState<any[]>([]);
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
  const [campoId, setCampoId] = useState("");

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

    // Campos
    const { data: cData, error: cError } = await supabase.from("campos_futbol").select("*").order("nombre");
    if (cError) {
      console.error("Error cargando campos:", cError);
    } else if (cData) {
      console.log("Campos cargados correctamente:", cData.length);
      setCampos(cData);
    }
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
      campo_id: campoId || null,
      estado: "programado"
    }]);

    if (!error) {
      showToast("Partido añadido");
      setLocalId(""); setVisitanteId(""); setCampoId("");
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
    <div className="card glass full-width" style={{ padding: '2.5rem' }}>
      
      {/* BARRA DE HERRAMIENTAS SUPERIOR (TOOLBAR) */}
      <div style={{ 
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '2.5rem', 
        paddingBottom: '2.5rem', 
        marginBottom: '3rem', 
        borderBottom: '1px solid rgba(255,255,255,0.08)'
      }}>
        
        {/* Bloque Temporada */}
        <div className="control-group">
          <label style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1rem', display: 'block' }}>
            🏆 Gestión de Temporada
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 60px', gap: '0.8rem' }}>
            <select 
              value={temporadaActiva?.id || ""} 
              onChange={(e) => toggleTemporadaActiva(e.target.value)}
              style={{ height: '55px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '0 1.2rem', borderRadius: '12px', fontSize: '1rem', fontWeight: 600 }}
            >
              {temporadas.map(t => (
                <option key={t.id} value={t.id}>{t.nombre} {t.activa ? '(Activa)' : ''}</option>
              ))}
            </select>
            <input 
              type="text" 
              placeholder="Nueva..." 
              value={nuevaTemporadaNombre}
              onChange={e => setNuevaTemporadaNombre(e.target.value)}
              style={{ height: '55px', padding: '0 1rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '0.9rem', borderRadius: '12px' }}
            />
            <button onClick={handleCreateTemporada} className="btn-primary" style={{ height: '55px', borderRadius: '12px', fontSize: '1.5rem' }}>+</button>
          </div>
        </div>

        {/* Bloque Jornada */}
        <div className="control-group">
          <label style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1rem', display: 'block' }}>
            📅 Selección de Jornada
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 60px 60px', gap: '0.8rem' }}>
            <select 
              value={selectedJornada || ""} 
              onChange={(e) => setSelectedJornada(e.target.value)}
              style={{ height: '55px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '0 1.2rem', borderRadius: '12px', fontSize: '1rem', fontWeight: 700 }}
            >
              <option value="">Selecciona jornada...</option>
              {jornadas.map(j => (
                <option key={j.id} value={j.id}>Jornada {j.numero}</option>
              ))}
            </select>
            <input 
              type="number" 
              placeholder="Nº" 
              value={numJornada}
              onChange={e => setNumJornada(e.target.value)}
              style={{ height: '55px', padding: '0 1rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '1rem', borderRadius: '12px', textAlign: 'center' }}
            />
            <button onClick={handleCreateJornada} className="btn-primary" style={{ height: '55px', borderRadius: '12px', fontSize: '1.5rem' }}>+</button>
            {selectedJornada && (
              <button 
                onClick={() => handleDeleteJornada(selectedJornada)} 
                className="btn-delete-icon" 
                style={{ height: '55px', borderRadius: '12px', fontSize: '1.2rem', width: '100%' }}
              >
                🗑️
              </button>
            )}
          </div>
        </div>
      </div>

      {/* CUERPO PRINCIPAL: PARTIDOS */}
      <div style={{ width: '100%' }}>
        {selectedJornada ? (
          <>
            <div style={{ marginBottom: '2.5rem' }}>
              <h3 style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '-1px' }}>
                Partidos <span className="text-primary">Jornada {jornadas.find(j => j.id === selectedJornada)?.numero}</span>
              </h3>
              <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
                Configura los enfrentamientos, horarios y resultados finales.
              </p>
            </div>

            {/* Creador de Partidos */}
            <form onSubmit={handleAddPartido} className="form-grid-4" style={{ 
              background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%)', 
              padding: '2rem', 
              borderRadius: '20px', 
              marginBottom: '3rem', 
              border: '1px solid rgba(255,255,255,0.05)',
              alignItems: 'flex-end',
              gap: '1.5rem'
            }}>
              <div className="input-group">
                <label style={{ marginBottom: '0.8rem' }}>Equipo Local</label>
                <select value={localId} onChange={e => setLocalId(e.target.value)} required style={{ height: '50px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '0 1rem', borderRadius: '10px', width: '100%' }}>
                  <option value="">Selecciona...</option>
                  {equipos.map(eq => <option key={eq.id} value={eq.id}>{eq.nombre}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label style={{ marginBottom: '0.8rem' }}>Equipo Visitante</label>
                <select value={visitanteId} onChange={e => setVisitanteId(e.target.value)} required style={{ height: '50px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '0 1rem', borderRadius: '10px', width: '100%' }}>
                  <option value="">Selecciona...</option>
                  {equipos.map(eq => <option key={eq.id} value={eq.id}>{eq.nombre}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label style={{ marginBottom: '0.8rem' }}>Estadio / Campo</label>
                <select value={campoId} onChange={e => setCampoId(e.target.value)} style={{ height: '50px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '0 1rem', borderRadius: '10px', width: '100%' }}>
                  <option value="">Selecciona campo...</option>
                  {campos.map(c => <option key={c.id} value={c.id}>{c.nombre} ({c.poblacion})</option>)}
                </select>
              </div>
              <button type="submit" disabled={loading} style={{ height: '50px', background: 'var(--primary)', color: 'black', fontWeight: 900, borderRadius: '10px', cursor: 'pointer', border: 'none', width: '100%', textTransform: 'uppercase', letterSpacing: '1px' }}>
                + Añadir Partido
              </button>
            </form>

            {/* Listado de Partidos */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {partidos.length === 0 && <p style={{ color: '#666', textAlign: 'center', padding: '4rem', background: 'rgba(255,255,255,0.01)', borderRadius: '20px', border: '1px dashed rgba(255,255,255,0.1)' }}>No hay partidos registrados en esta jornada.</p>}
              
              {partidos.map(p => {
                const localName = getTeamName(p.equipo_local_id);
                const visName = getTeamName(p.equipo_visitante_id);
                const localShield = getTeamShield(p.equipo_local_id);
                const visShield = getTeamShield(p.equipo_visitante_id);
                
                return (
                  <div key={p.id} style={{ 
                    background: 'rgba(255,255,255,0.02)', 
                    padding: '2.5rem', 
                    borderRadius: '24px', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '2.5rem', 
                    border: '1px solid rgba(255,255,255,0.05)',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
                  }}>
                    
                    {/* SECCIÓN 1: MARCADOR Y EQUIPOS (GRANDE) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', width: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flex: 1, justifyContent: 'flex-end', textAlign: 'right' }}>
                        <span style={{ fontSize: '1.4rem', fontWeight: 800 }}>{localName}</span>
                        {localShield && <img src={localShield} alt="" style={{ width: 50, height: 50, objectFit: 'contain' }} />}
                      </div>
                      
                      {/* Marcador Central */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', background: 'rgba(0,0,0,0.5)', padding: '1rem 2rem', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <input 
                          type="number" 
                          value={p.goles_local ?? 0} 
                          onChange={e => {
                            const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                            setPartidos(prev => prev.map(pt => pt.id === p.id ? { ...pt, goles_local: val } : pt));
                          }} 
                          style={{ width: '80px', height: '60px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontWeight: 900, textAlign: 'center', fontSize: '2.5rem', borderRadius: '12px' }} 
                        />
                        <span style={{ color: 'var(--primary)', fontWeight: 900, fontSize: '2rem' }}>-</span>
                        <input 
                          type="number" 
                          value={p.goles_visitante ?? 0} 
                          onChange={e => {
                            const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                            setPartidos(prev => prev.map(pt => pt.id === p.id ? { ...pt, goles_visitante: val } : pt));
                          }} 
                          style={{ width: '80px', height: '60px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontWeight: 900, textAlign: 'center', fontSize: '2.5rem', borderRadius: '12px' }} 
                        />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flex: 1 }}>
                         {visShield && <img src={visShield} alt="" style={{ width: 50, height: 50, objectFit: 'contain' }} />}
                         <span style={{ fontSize: '1.4rem', fontWeight: 800 }}>{visName}</span>
                      </div>
                    </div>

                    {/* SECCIÓN 2: CONFIGURACIÓN (DETALLES) */}
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: '1fr 1fr 160px auto auto', 
                      alignItems: 'flex-end', 
                      gap: '1.5rem', 
                      background: 'rgba(255,255,255,0.01)', 
                      padding: '2rem', 
                      borderRadius: '16px',
                      border: '1px solid rgba(255,255,255,0.03)'
                    }}>
                        <div className="input-group">
                          <label style={{ fontSize: '0.7rem', color: '#666', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.6rem', display: 'block' }}>🏟️ Campo / Estadio</label>
                          <select 
                            value={p.campo_id || ""}
                            onChange={e => {
                              const val = e.target.value;
                              setPartidos(prev => prev.map(pt => pt.id === p.id ? { ...pt, campo_id: val } : pt));
                            }}
                            style={{ height: '45px', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0 1rem', fontSize: '0.95rem', width: '100%' }}
                          >
                            <option value="">Sin asignar</option>
                            {campos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                          </select>
                        </div>

                        <div className="input-group">
                          <label style={{ fontSize: '0.7rem', color: '#666', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.6rem', display: 'block' }}>⏰ Fecha y Hora</label>
                          <input 
                            type="datetime-local" 
                            value={p.fecha ? p.fecha.substring(0, 16) : ""}
                            onChange={e => {
                              const val = e.target.value;
                              setPartidos(prev => prev.map(pt => pt.id === p.id ? { ...pt, fecha: val } : pt));
                            }}
                            style={{ height: '45px', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0 1rem', fontSize: '0.95rem', width: '100%' }}
                          />
                        </div>

                       <div className="input-group">
                         <label style={{ fontSize: '0.7rem', color: '#666', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.6rem', display: 'block' }}>🏁 Estado</label>
                         <select value={p.estado} onChange={e => updatePartidoState(p.id, 'estado', e.target.value)} style={{ height: '45px', padding: '0 1rem', borderRadius: '8px', background: p.estado === 'finalizado' ? '#10b981' : p.estado === 'en_juego' ? '#ef4444' : 'rgba(255,255,255,0.1)', color: 'black', fontWeight: 900, border: 'none', fontSize: '0.9rem', width: '100%' }}>
                           <option value="programado">Programado</option>
                           <option value="en_juego">En Juego</option>
                           <option value="finalizado">Finalizado</option>
                         </select>
                       </div>

                       <button onClick={async () => {
                         const { error } = await supabase.from("partidos_liga").update({
                           goles_local: p.goles_local,
                           goles_visitante: p.goles_visitante,
                           fecha: p.fecha ? new Date(p.fecha).toISOString() : null,
                           campo_id: p.campo_id
                         }).eq("id", p.id);
                         if (!error) showToast("Cambios guardados");
                       }} style={{ height: '45px', background: 'var(--primary)', border: 'none', color: 'black', padding: '0 2rem', borderRadius: '8px', fontWeight: 900, cursor: 'pointer' }}>Guardar</button>
                       
                       <button onClick={() => handleDeletePartido(p.id)} style={{ height: '45px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '0 1rem', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}>🗑️</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', color: '#444', background: 'rgba(255,255,255,0.01)', borderRadius: '30px', border: '2px dashed rgba(255,255,255,0.05)' }}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ marginBottom: '1.5rem', opacity: 0.2 }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#666' }}>Panel de Control de Jornadas</h3>
            <p style={{ marginTop: '0.5rem' }}>Selecciona una jornada arriba para gestionar el calendario y los resultados.</p>
          </div>
        )}
      </div>
    </div>
  );
}
