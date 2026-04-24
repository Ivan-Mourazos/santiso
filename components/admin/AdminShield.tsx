"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { processAndUploadImage } from "@/lib/image-utils";
import BusyBanner from "./BusyBanner";

interface AdminShieldProps {
  showToast: (msg: string, type?: "success" | "error") => void;
  showConfirm: (msg: string, onConfirm: () => void) => void;
  compact?: boolean;
}

export default function AdminShield({ showToast, showConfirm, compact }: AdminShieldProps) {
  const [clubShield, setClubShield] = useState<string | null>(null);
  const [tempShieldFile, setTempShieldFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [busyProgress, setBusyProgress] = useState<number | undefined>(undefined);

  useEffect(() => {
    fetchClubShield();
  }, []);

  async function fetchClubShield() {
    setIsFetching(true);
    const { data } = supabase.storage.from("fotos").getPublicUrl(`escudo_club.webp?t=${Date.now()}`);
    if (data) setClubShield(data.publicUrl);
    setIsFetching(false);
  }

  function handleShieldSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setTempShieldFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      showToast("Previsualización lista. Pulsa 'Guardar' para aplicar.");
    }
  }

  async function confirmUploadShield() {
    if (!tempShieldFile) return;
    setBusyProgress(5);
    setLoading(true);
    try {
      const processed = await processAndUploadImage(tempShieldFile, (percent) => {
        setBusyProgress(percent * 0.6);
      });
      if (!processed) return;

      setBusyProgress(80);
      const { data, error } = await supabase.storage.from("fotos").upload("escudo_club.webp", processed, {
        upsert: true,
        contentType: 'image/webp'
      });

      if (error) throw error;

      setTempShieldFile(null);
      setPreviewUrl(null);
      setBusyProgress(95);
      fetchClubShield();
      showToast("Escudo oficial actualizado y aplicado");
    } catch (err) {
      console.error(err);
      showToast("Error de permisos: Revisa políticas SQL", "error");
    } finally {
      setLoading(false);
      setBusyProgress(undefined);
    }
  }

  if (compact) {
    return (
      <div className="shield-compact-trigger" style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', background: 'rgba(255,255,255,0.03)', padding: '0.4rem 0.6rem', borderRadius: '50px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="shield-hex" style={{ width: '32px', height: '32px', overflow: 'hidden', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyItems: 'center' }}>
             {(previewUrl || clubShield) && <img src={previewUrl || clubShield || ""} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
          </div>
          <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', margin: 0 }}>
             {loading || isFetching ? "..." : (previewUrl ? "Confirmar" : "Escudo")}
             {!previewUrl && <input type="file" className="hidden-input" accept="image/*" onChange={handleShieldSelect} style={{ display: 'none' }} />}
          </label>
          {previewUrl && !loading && (
            <button onClick={confirmUploadShield} style={{ background: 'var(--primary)', border: 'none', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="card full-width glass" style={{ marginBottom: '2rem' }}>
      <BusyBanner show={loading || isFetching} text={isFetching ? "Cargando escudo actual..." : "Procesando y subiendo escudo..."} progress={loading ? busyProgress : undefined} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3>Identidad del Club</h3>
          <p style={{ color: '#a3a3a3', fontSize: '0.9rem' }}>Este escudo sale en el Navbar y en tu marcador local.</p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          {/* Hexágono del escudo actual */}
          <div className="shield-preview-container">
            {(previewUrl || clubShield) && (previewUrl || clubShield) !== "" && (
              <img src={previewUrl || clubShield || ""} alt="Escudo Actual" style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label className="file-input-label">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
              Elegir Escudo
              <input type="file" className="hidden-input" accept="image/*" onChange={handleShieldSelect} />
            </label>
            
            {previewUrl && (
              <button 
                onClick={confirmUploadShield} 
                className="btn btn-primary" 
                disabled={loading}
                style={{ width: '100%', fontSize: '0.8rem', padding: '0.5rem' }}
              >
                {loading ? "Procesando..." : "Confirmar Cambio"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
