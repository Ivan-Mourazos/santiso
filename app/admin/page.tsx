"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { processAndUploadImage } from "@/lib/image-utils";
import { v4 as uuidv4 } from "uuid";

export default function AdminPage() {
  const [nombre, setNombre] = useState("");
  const [dorsal, setDorsal] = useState("");
  const [posicion, setPosicion] = useState("");
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [jugadores, setJugadores] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Category State
  const [categoria, setCategoria] = useState("Senior");

  // States for Matches (existing states...)
  const [rival, setRival] = useState("");
  const [fecha, setFecha] = useState("");
  const [lugar, setLugar] = useState("");
  const [rivalEscudoFile, setRivalEscudoFile] = useState<File | null>(null);
  const [partidos, setPartidos] = useState<any[]>([]);

  // States for News (existing states...)
  const [titulo, setTitulo] = useState("");
  const [contenido, setContenido] = useState("");
  const [noticias, setNoticias] = useState<any[]>([]);
  const [clubShield, setClubShield] = useState<string | null>(null);
  const [tempShieldFile, setTempShieldFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [equipos, setEquipos] = useState<any[]>([]);
  const [nombreEquipo, setNombreEquipo] = useState("");
  const [escudoEquipo, setEscudoEquipo] = useState<File | null>(null);

  const [loadingShield, setLoadingShield] = useState(false);
  const [loadingEquipos, setLoadingEquipos] = useState(false);
  const [loadingPartido, setLoadingPartido] = useState(false);
  const [loadingJugador, setLoadingJugador] = useState(false);
  const [loading, setLoading] = useState(false); // General loading for News
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    fetchJugadores();
    fetchPartidos();
    fetchNoticias();
    fetchClubShield();
    fetchEquipos();
  }, [categoria]);

  async function fetchEquipos() {
    const { data } = await supabase.from("equipos").select("*").order("nombre", { ascending: true });
    if (data) setEquipos(data);
  }

  async function handleAddEquipo(e: React.FormEvent) {
    e.preventDefault();
    if (!nombreEquipo) return;
    setLoadingEquipos(true);

    let url = "";
    if (escudoEquipo) {
      const processed = await processAndUploadImage(escudoEquipo);
      if (processed) {
        const fileName = `escudos/${uuidv4()}.webp`;
        const { data, error } = await supabase.storage.from("fotos").upload(fileName, processed);
        if (data) {
          const { data: pUrl } = supabase.storage.from("fotos").getPublicUrl(fileName);
          url = pUrl.publicUrl;
        }
      }
    }

    const { error } = await supabase.from("equipos").insert([{ 
      nombre: nombreEquipo, 
      escudo_url: url 
    }]);

    if (!error) {
      setNombreEquipo("");
      setEscudoEquipo(null);
      fetchEquipos();
      alert("Equipo añadido correctamente");
    }
    setLoadingEquipos(false);
  }

  async function handleDeleteEquipo(id: string) {
    if (!confirm("¿Borrar este equipo? Se desvinculará de sus partidos.")) return;
    await supabase.from("equipos").delete().eq("id", id);
    fetchEquipos();
  }

  async function fetchClubShield() {
     // Cache busting con timestamp para ver el cambio al instante
     const { data } = supabase.storage.from("fotos").getPublicUrl(`escudo_club.webp?t=${Date.now()}`);
     if (data) setClubShield(data.publicUrl);
  }

  function handleSelectShield(file: File) {
    setTempShieldFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function confirmUploadShield() {
    if (!tempShieldFile) return;
    setLoadingShield(true);
    
    try {
      const processed = await processAndUploadImage(tempShieldFile);
      if (!processed) return;

      // Borramos primero lo anterior por si acaso
      await supabase.storage.from("fotos").remove(["escudo_club.webp"]);

      // Subimos con el nombre fijo
      const { error } = await supabase.storage
        .from("fotos")
        .upload("escudo_club.webp", processed, { upsert: true });

      if (error) throw error;
      
      setTempShieldFile(null);
      setPreviewUrl(null);
      fetchClubShield();
      alert("Escudo oficial actualizado y aplicado a toda la web.");
    } catch (err) {
      console.error(err);
      alert("Error de permisos: Asegúrate de ejecutar el SQL de políticas de Storage.");
    } finally {
      setLoadingShield(false);
    }
  }

  async function fetchJugadores() {
    const { data } = await supabase.from("jugadores").select("*").eq("categoria", categoria).order("dorsal", { ascending: true });
    if (data) setJugadores(data);
  }

  async function fetchPartidos() {
    const { data } = await supabase.from("partidos").select("*").eq("categoria", categoria).order("fecha", { ascending: true });
    if (data) setPartidos(data);
  }

  async function fetchNoticias() {
    const { data } = await supabase.from("noticias").select("*").eq("categoria", categoria).order("fecha", { ascending: false });
    if (data) setNoticias(data);
  }

  async function uploadToStorage(file: File) {
    setUploadingImage(true);
    const processedFile = await processAndUploadImage(file);
    if (!processedFile) {
      setUploadingImage(false);
      return null;
    }

    const { data, error } = await supabase.storage
      .from("fotos")
      .upload(processedFile.name, processedFile);

    if (error) {
       console.error("Error subiendo a storage:", error);
       setUploadingImage(false);
       return null;
    }

    const { data: { publicUrl } } = supabase.storage.from("fotos").getPublicUrl(data.path);
    setUploadingImage(false);
    return publicUrl;
  }

  async function handleAddJugador(e: React.FormEvent) {
    e.preventDefault();
    setLoadingJugador(true);
    
    let foto_url = "";
    if (fotoFile) {
      const url = await uploadToStorage(fotoFile);
      if (url) foto_url = url;
    }

    if (editingId) {
      // Editar
      const updateData: any = { nombre, dorsal: parseInt(dorsal), posicion, categoria };
      if (foto_url) updateData.foto_url = foto_url;
      
      await supabase.from("jugadores").update(updateData).eq("id", editingId);
      setEditingId(null);
    } else {
      // Insertar
      await supabase.from("jugadores").insert([{ nombre, dorsal: parseInt(dorsal), posicion, categoria, foto_url }]);
    }

    setNombre(""); setDorsal(""); setPosicion(""); setFotoFile(null);
    fetchJugadores();
    setLoadingJugador(false);
  }

  function startEditJugador(j: any) {
    setNombre(j.nombre);
    setDorsal(j.dorsal.toString());
    setPosicion(j.posicion);
    setEditingId(j.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleAddPartido(e: React.FormEvent) {
    e.preventDefault();
    setLoadingPartido(true);

    let rival_escudo_url = "";
    if (rivalEscudoFile) {
      const url = await uploadToStorage(rivalEscudoFile);
      if (url) rival_escudo_url = url;
    }

    await supabase.from("partidos").insert([{ rival, fecha, lugar, categoria, rival_escudo_url }]);
    setRival(""); setFecha(""); setLugar(""); setRivalEscudoFile(null);
    fetchPartidos();
    setLoadingPartido(false);
  }

  async function handleAddNoticia(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await supabase.from("noticias").insert([{ titulo, contenido, categoria }]);
    setTitulo(""); setContenido("");
    fetchNoticias();
    setLoading(false);
  }

  async function deleteJugador(id: string) {
    await supabase.from("jugadores").delete().eq("id", id);
    fetchJugadores();
  }

  async function deletePartido(id: string) {
    await supabase.from("partidos").delete().eq("id", id);
    fetchPartidos();
  }

  async function deleteNoticia(id: string) {
    await supabase.from("noticias").delete().eq("id", id);
    fetchNoticias();
  }

  return (
    <main className="admin-container">
      <div className="container">
        <header className="admin-header">
          <div>
            <h1>Admin <span className="text-primary">Santiso</span></h1>
            <p className="admin-subtitle">Gestionando: <strong className="text-primary">{categoria}</strong></p>
          </div>
          <div className="admin-nav">
            <div className="category-tabs">
              <button className={categoria === 'Senior' ? 'active' : ''} onClick={() => setCategoria('Senior')}>Senior</button>
              <button className={categoria === 'Femenino' ? 'active' : ''} onClick={() => setCategoria('Femenino')}>Femenino</button>
              <button className={categoria === 'Veteranos' ? 'active' : ''} onClick={() => setCategoria('Veteranos')}>Veteranos</button>
            </div>
            <Link href="/" className="btn-back">← Web</Link>
          </div>
        </header>

        <section className="admin-grid">
          {/* Fila 1: Configuración Global */}
          <div className="card full-width glass" style={{ marginBottom: '2rem' }}>
            <h3>Escudo Oficial del Club</h3>
            <div className="admin-form" style={{ flexDirection: 'row', alignItems: 'center', gap: '2rem' }}>
               {clubShield && <img src={clubShield} alt="Escudo Actual" style={{ width: '80px', height: '80px', objectFit: 'contain', border: '1px solid #333', padding: '10px', borderRadius: '10px' }} />}
               <div className="file-input" style={{ flex: 1 }}>
                {!previewUrl ? (
                  <label className="file-input-label">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                    Elegir Escudo del Club
                    <input type="file" className="hidden-input" accept="image/*" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleSelectShield(file);
                    }} />
                  </label>
                ) : (
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <img src={previewUrl} alt="Previsualización" style={{ width: '60px', height: '60px', objectFit: 'contain', border: '2px solid var(--primary)', borderRadius: '10px' }} />
                    <button onClick={confirmUploadShield} className="btn btn-primary" disabled={loadingShield}>
                      {loadingShield ? "Subiendo..." : "Confirmar Cambio"}
                    </button>
                    <button onClick={() => { setPreviewUrl(null); setTempShieldFile(null); }} className="btn btn-outline" style={{ color: '#ff4444' }}>Cancelar</button>
                  </div>
                )}
                <p className="admin-subtitle">Este es el escudo que sale en el Navbar y en tu marcador local.</p>
               </div>
            </div>
          </div>

          {/* Gestión de Equipos */}
          <div className="card full-width glass" style={{ marginBottom: '2rem' }}>
            <h3>Librería de Equipos Rivales</h3>
            <div className="admin-form" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1rem', marginBottom: '2rem' }}>
              <input type="text" placeholder="Nombre del Equipo Rival" value={nombreEquipo} onChange={(e) => setNombreEquipo(e.target.value)} />
              <div className="file-input-group">
                <label className="file-input-label">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                  {escudoEquipo ? escudoEquipo.name : "Subir Escudo 1:1"}
                  <input type="file" className="hidden-input" accept="image/*" onChange={(e) => setEscudoEquipo(e.target.files?.[0] || null)} />
                </label>
              </div>
              <button onClick={handleAddEquipo} className="btn btn-primary" disabled={loadingEquipos}>
                {loadingEquipos ? "Procesando..." : "Añadir Equipo"}
              </button>
            </div>
            
            <div className="table-responsive" style={{ maxHeight: '300px', overflowY: 'auto' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Escudo (Auto-1:1)</th>
                    <th>Nombre</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {equipos.map(e => (
                    <tr key={e.id}>
                      <td>{e.escudo_url && <img src={e.escudo_url} alt={e.nombre} style={{ width: '40px', height: '40px', objectFit: 'contain', background: '#111', borderRadius: '5px' }} />}</td>
                      <td>{e.nombre}</td>
                      <td>
                        <button onClick={() => handleDeleteEquipo(e.id)} className="btn-delete">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Gestión de Partidos */}
          <div className="card full-width glass" style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3>Gestión de Partidos</h3>
              <p className="admin-subtitle">Programa los próximos encuentros</p>
            </div>
            <form onSubmit={handleAddPartido} className="admin-horizontal-form">
              <div className="form-grid-3">
                <div className="input-group">
                  <label>Fecha</label>
                  <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
                </div>
                <div className="input-group">
                  <label>Rival</label>
                  <select value={rival} onChange={(e) => setRival(e.target.value)} required>
                    <option value="">Seleccionar Rival...</option>
                    {equipos.map(e => (
                      <option key={e.id} value={e.nombre}>{e.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="input-group">
                  <label>Escudo (Opcional)</label>
                  <div className="file-input-group">
                    <label className="file-input-label" style={{ padding: '0.6rem' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                      {rivalEscudoFile ? rivalEscudoFile.name.substring(0, 15) + "..." : "Subir Escudo"}
                      <input type="file" className="hidden-input" accept="image/*" onChange={(e) => setRivalEscudoFile(e.target.files?.[0] || null)} />
                    </label>
                  </div>
                </div>
              </div>
              <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" disabled={loadingPartido} className="btn btn-primary" style={{ padding: '1rem 3rem' }}>
                  {loadingPartido ? "Ubicando..." : "Guardar Partido"}
                </button>
              </div>
            </form>
          </div>

          {/* Gestión de Jugadores */}
          <div className="card full-width glass" style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3>{editingId ? "Editar Jugador" : "Nuevo Jugador"}</h3>
              <p className="admin-subtitle">Añade o edita miembros de la plantilla</p>
            </div>
            <form onSubmit={handleAddJugador} className="admin-horizontal-form">
              <div className="form-grid-4">
                <div className="input-group" style={{ flex: 2 }}>
                  <label>Nombre Completo</label>
                  <input type="text" placeholder="Ej: Juan Pérez" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
                </div>
                <div className="input-group">
                  <label>Dorsal</label>
                  <input type="number" placeholder="00" value={dorsal} onChange={(e) => setDorsal(e.target.value)} required />
                </div>
                <div className="input-group">
                  <label>Posición</label>
                  <select value={posicion} onChange={(e) => setPosicion(e.target.value)} required>
                    <option value="">Posición...</option>
                    <option value="Portero">Portero</option>
                    <option value="Defensa">Defensa</option>
                    <option value="Centrocampista">Centrocampista</option>
                    <option value="Delantero">Delantero</option>
                  </select>
                </div>
                <div className="input-group">
                  <label>Foto</label>
                  <div className="file-input-group">
                    <label className="file-input-label" style={{ padding: '0.6rem' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                      {fotoFile ? "Foto Lista" : "Subir Foto"}
                      <input type="file" className="hidden-input" accept="image/*" onChange={(e) => setFotoFile(e.target.files?.[0] || null)} />
                    </label>
                  </div>
                </div>
              </div>
              <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                {editingId && <button type="button" onClick={() => { setEditingId(null); setNombre(""); setDorsal(""); setPosicion(""); }} className="btn btn-outline">Cancelar</button>}
                <button type="submit" className="btn btn-primary" disabled={loadingJugador || uploadingImage} style={{ padding: '1rem 3rem' }}>
                  {uploadingImage ? "Procesando..." : loadingJugador ? "Guardando..." : editingId ? "Actualizar Jugador" : "Guardar Jugador"}
                </button>
              </div>
            </form>
          </div>

          {/* Form Noticias */}
          <div className="card full-width">
            <h3>Nueva Noticia</h3>
            <form onSubmit={handleAddNoticia} className="admin-form">
              <input type="text" placeholder="Título de la noticia" value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
              <textarea placeholder="Contenido de la noticia..." value={contenido} onChange={(e) => setContenido(e.target.value)} required rows={4}></textarea>
              <button type="submit" className="btn btn-primary" disabled={loading}>Publicar Noticia</button>
            </form>
          </div>
        </section>

        <section className="lists-grid">
          <div>
            <h3>Fichajes</h3>
            <div className="list">
              {jugadores.map((j) => (
                <div key={j.id} className="admin-item">
                  <span>{j.dorsal}. {j.nombre}</span>
                  <div className="admin-item-actions">
                    <button onClick={() => startEditJugador(j)} className="btn-edit">Editar</button>
                    <button onClick={() => deleteJugador(j.id)} className="text-red">X</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3>Calendario</h3>
            <div className="list">
              {partidos.map((p) => (
                <div key={p.id} className="admin-item">
                  <span>vs {p.rival} ({new Date(p.fecha).toLocaleDateString()})</span>
                  <button onClick={() => deletePartido(p.id)} className="text-red">X</button>
                </div>
              ))}
            </div>
          </div>
          <div className="full-width">
            <h3>Últimas Noticias</h3>
            <div className="list">
              {noticias.map((n) => (
                <div key={n.id} className="admin-item">
                  <span>{n.titulo} ({new Date(n.fecha).toLocaleDateString()})</span>
                  <button onClick={() => deleteNoticia(n.id)} className="text-red">Borrar</button>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <style jsx>{`
        .admin-container { padding: 4rem 0; min-height: 100vh; background: #000; }
        .admin-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 3rem; flex-wrap: wrap; gap: 1rem; }
        .admin-subtitle { color: #a3a3a3; font-size: 0.9rem; margin-top: 0.25rem; }
        .admin-nav { display: flex; align-items: center; gap: 2rem; }
        .category-tabs { display: flex; background: var(--secondary); padding: 0.25rem; border-radius: 0.5rem; border: 1px solid var(--border); }
        .category-tabs button { background: transparent; border: none; color: white; padding: 0.5rem 1rem; border-radius: 0.4rem; cursor: pointer; font-weight: 700; font-family: inherit; transition: all 0.2s; }
        .category-tabs button.active { background: var(--primary); color: black; }
        .admin-grid, .lists-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 3rem; }
        @media (max-width: 768px) { .admin-grid, .lists-grid { grid-template-columns: 1fr; } }
        .card { background: var(--secondary); padding: 2rem; border-radius: 1rem; border: 1px solid var(--border); }
        .full-width { grid-column: 1 / -1; }
        .admin-form { display: flex; flex-direction: column; gap: 1rem; margin-top: 1rem; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        input, select, textarea { padding: 1rem; border-radius: 0.5rem; border: 1px solid var(--border); background: #000; color: white; font-family: inherit; }
        .btn { padding: 1rem; border-radius: 0.5rem; font-weight: 700; cursor: pointer; border: none; }
        .btn-primary { background: var(--primary); color: black; }
        .list { margin-top: 1rem; display: flex; flex-direction: column; gap: 0.5rem; }
        .admin-item { background: #1a1a1a; padding: 1rem; border-radius: 0.5rem; display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--border); }
        .admin-item-actions { display: flex; gap: 1rem; align-items: center; }
        .form-actions { display: flex; gap: 1rem; }
        .btn-edit { background: transparent; border: 1px solid #525252; color: #a3a3a3; padding: 0.25rem 0.75rem; border-radius: 0.25rem; cursor: pointer; font-size: 0.8rem; }
        .btn-edit:hover { border-color: var(--primary); color: var(--primary); }
        .text-red { color: #ef4444; background: none; border: none; cursor: pointer; font-weight: bold; }
        .btn-back { color: var(--primary); font-weight: bold; }
        .btn-delete {
          background: rgba(220, 38, 38, 0.1);
          color: #ef4444;
          border: 1px solid rgba(220, 38, 38, 0.2);
          padding: 0.5rem 1rem;
          border-radius: 0.5rem;
          font-size: 0.75rem;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          transition: all 0.2s;
        }
        .btn-delete:hover {
          background: #dc2626;
          color: white;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(220, 38, 38, 0.4);
        }

        /* Custom File Inputs */
        .file-input-group { position: relative; display: flex; flex-direction: column; gap: 0.5rem; }
        .file-input-label {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          background: rgba(255,255,255,0.03);
          border: 1px dashed rgba(255,255,255,0.2);
          padding: 1rem;
          border-radius: 0.75rem;
          cursor: pointer;
          transition: all 0.2s;
          color: #a3a3a3;
          font-weight: 600;
          font-size: 0.85rem;
        }
        .file-input-label:hover {
          border-color: var(--primary);
          background: rgba(250, 204, 21, 0.05);
          color: white;
        }
        .file-input-label svg { color: var(--primary); }
        .hidden-input { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0; }

        /* Horizontal Form Grids */
        .form-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1.5rem; width: 100%; }
        .form-grid-4 { display: grid; grid-template-columns: 2fr 0.5fr 1fr 1fr; gap: 1.5rem; width: 100%; }
        .input-group { display: flex; flex-direction: column; gap: 0.5rem; }
        .input-group label { font-size: 0.75rem; font-weight: 800; text-transform: uppercase; color: var(--primary); letter-spacing: 1px; }
        
        @media (max-width: 1024px) {
          .form-grid-3, .form-grid-4 { grid-template-columns: 1fr; gap: 1rem; }
        }
      `}</style>
    </main>
  );
}
