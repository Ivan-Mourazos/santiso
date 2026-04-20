"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { processAndUploadImage } from "@/lib/image-utils";
import { v4 as uuidv4 } from "uuid";

interface AdminEquiposProps {
  showToast: (msg: string, type?: "success" | "error") => void;
  showConfirm: (msg: string, onConfirm: () => void) => void;
  categoria: string;
}

export default function AdminEquipos({ showToast, showConfirm, categoria }: AdminEquiposProps) {
  const [equipos, setEquipos] = useState<any[]>([]);
  const [nombreEquipo, setNombreEquipo] = useState("");
  const [escudoEquipo, setEscudoEquipo] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchEquipos();
  }, [categoria]);

  async function fetchEquipos() {
    const { data } = await supabase.from("equipos").select("*").eq("categoria", categoria).order("nombre", { ascending: true });
    if (data) setEquipos(data);
    else setEquipos([]);
  }

  const resetForm = () => {
    setNombreEquipo("");
    setEscudoEquipo(null);
    setEditingId(null);
  };

  const startEdit = (equipo: any) => {
    setNombreEquipo(equipo.nombre);
    setEditingId(equipo.id);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombreEquipo) return;
    setLoading(true);

    try {
      let url = "";
      
      // Si estamos editando, buscamos el equipo actual para ver si ya tiene logo
      if (editingId) {
        const current = equipos.find(eq => eq.id === editingId);
        url = current?.escudo_url || "";
      }

      // Si hay un archivo nuevo, lo subimos
      if (escudoEquipo) {
        const processed = await processAndUploadImage(escudoEquipo);
        if (processed) {
          const fileName = `escudos/${uuidv4()}.webp`;
          const { data } = await supabase.storage.from("fotos").upload(fileName, processed);
          if (data) {
            const { data: pUrl } = supabase.storage.from("fotos").getPublicUrl(fileName);
            url = pUrl.publicUrl;
          }
        }
      }

      if (editingId) {
        // ACTUALIZAR
        const { error } = await supabase.from("equipos")
          .update({ nombre: nombreEquipo, escudo_url: url })
          .eq("id", editingId);
        
        if (!error) {
          showToast("Equipo actualizado correctamente");
          resetForm();
          fetchEquipos();
        }
      } else {
        // INSERTAR
        const { error } = await supabase.from("equipos").insert([{ 
          nombre: nombreEquipo, 
          escudo_url: url,
          categoria: categoria
        }]);

        if (!error) {
          showToast("Equipo añadido (" + categoria + ")");
          resetForm();
          fetchEquipos();
        }
      }
    } catch (err) {
      console.error(err);
      showToast("Error en la operación", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteEquipo(id: string) {
    showConfirm("¿Borrar este equipo de la librería?", async () => {
      await supabase.from("equipos").delete().eq("id", id);
      fetchEquipos();
      showToast("Equipo eliminado");
    });
  }

  return (
    <div className="card glass">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h3>Librería de Equipos ({categoria})</h3>
          <p style={{ color: '#a3a3a3', fontSize: '0.85rem' }}>Gestiona los clubes rivales y sus escudos. No necesitas meter aquí tus propios puntos, se calculan solos.</p>
        </div>
        {editingId && (
          <button onClick={resetForm} className="btn-delete" style={{ padding: '0.4rem 1rem' }}>Cancelar Edición</button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="admin-form" style={{ background: editingId ? 'rgba(250, 204, 21, 0.05)' : '', padding: editingId ? '1.5rem' : '', borderRadius: '1rem', transition: 'all 0.3s' }}>
        <div className="form-grid-3">
          <div className="input-group">
            <label>Nombre del Equipo</label>
            <input type="text" placeholder="Ej: Racing de Ferrol" value={nombreEquipo} onChange={(e) => setNombreEquipo(e.target.value)} required />
          </div>
          <div className="input-group">
            <label>Escudo {editingId ? "(Opcional)" : ""}</label>
            <div className="file-input-group">
              <label className="file-input-label">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                {escudoEquipo ? escudoEquipo.name.substring(0, 15) + "..." : editingId ? "Cambiar Escudo" : "Elegir Escudo"}
                <input type="file" className="hidden-input" accept="image/*" onChange={(e) => setEscudoEquipo(e.target.files?.[0] || null)} />
              </label>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%' }}>
              {loading ? "Procesando..." : editingId ? "Guardar Cambios" : "Añadir Equipo"}
            </button>
          </div>
        </div>
      </form>

      <div style={{ marginTop: '2.5rem' }}>
        <h4 style={{ marginBottom: '1rem', fontSize: '0.9rem', color: '#666', textTransform: 'uppercase', letterSpacing: '1px' }}>Equipos Registrados</h4>
        <div className="equipos-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {equipos.map(e => (
            <div key={e.id} className="admin-item glass shadow-sm" style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              padding: '0.75rem 1.2rem', 
              border: editingId === e.id ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.05)',
              borderRadius: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ width: '32px', height: '32px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {e.escudo_url ? <img src={e.escudo_url} alt={e.nombre} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <span style={{ fontSize: '0.5rem' }}>Logo</span>}
                </div>
                <span style={{ fontSize: '1rem', fontWeight: 800, color: 'white' }}>{e.nombre}</span>
              </div>
              <div style={{ display: 'flex', gap: '15px' }}>
                <button onClick={() => startEdit(e)} className="text-secondary" style={{ fontSize: '0.8rem', fontWeight: 600, background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}>Editar</button>
                <div style={{ width: '1px', height: '15px', background: 'rgba(255,255,255,0.1)' }}></div>
                <button onClick={() => handleDeleteEquipo(e.id)} className="text-red" style={{ fontSize: '0.8rem', fontWeight: 600, background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>Borrar</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
