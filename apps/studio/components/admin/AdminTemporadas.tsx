"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase-browser";
import BusyBanner from "./BusyBanner";

interface AdminTemporadasProps {
  showToast: (msg: string, type?: "success" | "error") => void;
  showConfirm: (msg: string, onConfirm: () => void) => void;
}

export default function AdminTemporadas({ showToast, showConfirm }: AdminTemporadasProps) {
  const [temporadas, setTemporadas] = useState<any[]>([]);
  const [nombre, setNombre] = useState("");
  const [loading, setLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [busyText, setBusyText] = useState("Cargando temporadas...");

  useEffect(() => {
    fetchTemporadas();
  }, []);

  async function fetchTemporadas() {
    setIsFetching(true);
    const { data } = await supabase.from("temporadas").select("*").order("created_at", { ascending: false });
    if (data) setTemporadas(data);
    setIsFetching(false);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre) return;
    setBusyText("Creando temporada...");
    setLoading(true);

    const { error } = await supabase.from("temporadas").insert([{ nombre, activa: temporadas.length === 0 }]);
    
    if (!error) {
      showToast("Temporada creada");
      setNombre("");
      fetchTemporadas();
    } else {
      showToast("Error al crear", "error");
    }
    setLoading(false);
  }

  async function setActiva(id: string) {
    setBusyText("Activando temporada...");
    setLoading(true);
    // Desactivar todas
    await supabase.from("temporadas").update({ activa: false }).neq("id", id);
    // Activar seleccionada
    const { error } = await supabase.from("temporadas").update({ activa: true }).eq("id", id);
    
    if (!error) {
      showToast("Temporada activa actualizada");
      fetchTemporadas();
    }
    setLoading(false);
  }

  return (
    <div className="card glass full-width">
      <BusyBanner show={loading || isFetching} text={isFetching ? "Cargando temporadas..." : busyText} />
      <form onSubmit={handleAdd} className="form-grid-3" style={{ marginBottom: '2rem' }}>
        <div className="input-group">
          <label>Nombre de Temporada</label>
          <input type="text" placeholder="Ej: 2024/25" value={nombre} onChange={e => setNombre(e.target.value)} required />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%' }}>+ Nueva Temporada</button>
        </div>
      </form>

      <div className="equipos-list">
        {temporadas.map(t => (
          <div key={t.id} className="admin-item glass" style={{ border: t.activa ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontWeight: 800 }}>{t.nombre} {t.activa && <span className="text-primary">(ACTIVA)</span>}</div>
            {!t.activa && (
              <button onClick={() => setActiva(t.id)} className="btn-confirm" style={{ padding: '0.4rem 0.8rem', fontSize: '0.7rem' }}>Activar</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
