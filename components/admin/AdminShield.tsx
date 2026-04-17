"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { processAndUploadImage } from "@/lib/image-utils";

interface AdminShieldProps {
  showToast: (msg: string, type?: "success" | "error") => void;
}

export default function AdminShield({ showToast }: AdminShieldProps) {
  const [clubShield, setClubShield] = useState<string | null>(null);
  const [tempShieldFile, setTempShieldFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchClubShield();
  }, []);

  async function fetchClubShield() {
    const { data } = supabase.storage.from("fotos").getPublicUrl(`escudo_club.webp?t=${Date.now()}`);
    if (data) setClubShield(data.publicUrl);
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
    setLoading(true);
    try {
      const processed = await processAndUploadImage(tempShieldFile);
      if (!processed) return;

      const { data, error } = await supabase.storage.from("fotos").upload("escudo_club.webp", processed, {
        upsert: true,
        contentType: 'image/webp'
      });

      if (error) throw error;

      setTempShieldFile(null);
      setPreviewUrl(null);
      fetchClubShield();
      showToast("Escudo oficial actualizado y aplicado");
    } catch (err) {
      console.error(err);
      showToast("Error de permisos: Revisa políticas SQL", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card full-width glass" style={{ marginBottom: '2rem' }}>
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
