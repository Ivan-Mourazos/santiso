"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { processAndUploadImage } from "@/lib/image-utils";
import { v4 as uuidv4 } from "uuid";

interface AdminEquiposProps {
  showToast: (msg: string, type?: "success" | "error") => void;
}

export default function AdminEquipos({ showToast }: AdminEquiposProps) {
  const [equipos, setEquipos] = useState<any[]>([]);
  const [nombreEquipo, setNombreEquipo] = useState("");
  const [escudoEquipo, setEscudoEquipo] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchEquipos();
  }, []);

  async function fetchEquipos() {
    const { data } = await supabase.from("equipos").select("*").order("nombre", { ascending: true });
    if (data) setEquipos(data);
  }

  async function handleAddEquipo(e: React.FormEvent) {
    e.preventDefault();
    if (!nombreEquipo) return;
    setLoading(true);

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
      showToast("Equipo añadido a la librería");
    }
    setLoading(false);
  }

  async function handleDeleteEquipo(id: string) {
    if (!confirm("¿Borrar este equipo? Se desvinculará de sus partidos.")) return;
    await supabase.from("equipos").delete().eq("id", id);
    fetchEquipos();
    showToast("Equipo eliminado");
  }

  return (
    <div className="card glass">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h3>Librería de Equipos Rivales</h3>
          <p style={{ color: '#a3a3a3', fontSize: '0.9rem' }}>Gestiona los escudos de los equipos contra los que juegas.</p>
        </div>
      </div>

      <form onSubmit={handleAddEquipo} className="admin-form">
        <div className="form-grid-3">
          <div className="input-group">
            <label>Nombre del Equipo</label>
            <input type="text" placeholder="Ej: Racing de Ferrol" value={nombreEquipo} onChange={(e) => setNombreEquipo(e.target.value)} required />
          </div>
          <div className="input-group">
            <label>Escudo (Cualquier formato → Auto-1:1)</label>
            <div className="file-input-group">
              <label className="file-input-label">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                {escudoEquipo ? escudoEquipo.name.substring(0, 15) + "..." : "Elegir Escudo Rival"}
                <input type="file" className="hidden-input" accept="image/*" onChange={(e) => setEscudoEquipo(e.target.files?.[0] || null)} />
              </label>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', padding: '0.8rem' }}>
              {loading ? "Añadiendo..." : "Añadir Equipo"}
            </button>
          </div>
        </div>
      </form>

      <div className="equipos-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
        {equipos.map(e => (
          <div key={e.id} className="admin-item" style={{ padding: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {e.escudo_url && e.escudo_url !== "" && <img src={e.escudo_url} alt={e.nombre} style={{ width: '30px', height: '30px', objectFit: 'contain' }} />}
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{e.nombre}</span>
            </div>
            <button onClick={() => handleDeleteEquipo(e.id)} className="text-red" style={{ fontSize: '0.7rem' }}>Eliminar</button>
          </div>
        ))}
      </div>
    </div>
  );
}
