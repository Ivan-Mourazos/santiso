"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { processAndUploadImage } from "@/lib/image-utils";
import { v4 as uuidv4 } from "uuid";

interface Asset {
  id:      string;
  nombre:  string;
  tipo:    string;
  subtipo: string | null;
  url:     string;
  orden:   number;
}

interface Props {
  showToast: (msg: string, type?: "success" | "error") => void;
}

/** Strips accents + invalid storage-key characters → safe slug */
function sanitizeKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    || "asset";
}

// Keys for institutional logos
const INST_LOGOS = [
  { subtipo: "xunta", label: "Xunta de Galicia", hint: "Esquina superior" },
  { subtipo: "rfgf",  label: "RFGF",             hint: "Esquina superior" },
];

// Default template list for backgrounds
const TEMPLATE_LABELS: Record<string, string> = {
  partido:    "Cartel de Partido",
  resumo:     "Resumo da Xornada",
  cronoloxia: "Cronoloxía",
  proximos:   "Próximos Encontros",
  noso11:     "O Noso 11",
};

export default function AdminCartelAssets({ showToast }: Props) {
  const [assets, setAssets]   = useState<Asset[]>([]);
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  useEffect(() => { fetchAssets(); }, []);

  async function fetchAssets() {
    const { data } = await supabase
      .from("cartel_assets")
      .select("*")
      .order("orden", { ascending: true });
    if (data) setAssets(data as Asset[]);
  }

  // Generic upload helper
  async function uploadAsset(
    file: File,
    tipo: string,
    subtipo: string,
    nombre: string,
    orden = 0
  ) {
    const key = `${tipo}_${subtipo}`;
    setLoading(p => ({ ...p, [key]: true }));
    try {
      const processed = await processAndUploadImage(file);
      if (!processed) throw new Error("Error procesando imagen");

      const path = `cartel/${sanitizeKey(tipo)}/${sanitizeKey(subtipo)}-${uuidv4()}.webp`;
      const { data: upload, error: uploadErr } = await supabase.storage
        .from("fotos")
        .upload(path, processed, { upsert: true, contentType: "image/webp" });
      if (uploadErr) throw uploadErr;

      const { data: pUrl } = supabase.storage.from("fotos").getPublicUrl(path);
      const url = pUrl.publicUrl;

      // Check existing row to decide insert vs update
      const existing = assets.find(a => a.tipo === tipo && a.subtipo === subtipo);
      if (existing) {
        await supabase.from("cartel_assets").update({ url, nombre }).eq("id", existing.id);
      } else {
        await supabase.from("cartel_assets").insert([{ nombre, tipo, subtipo, url, orden }]);
      }

      showToast(`${nombre} actualizado correctamente`);
      fetchAssets();
    } catch (err: unknown) {
      console.error(err);
      showToast("Error al subir imagen", "error");
    } finally {
      setLoading(p => ({ ...p, [key]: false }));
    }
  }

  async function deleteAsset(id: string) {
    if (!confirm("¿Borrar este activo?")) return;
    await supabase.from("cartel_assets").delete().eq("id", id);
    showToast("Activo eliminado");
    fetchAssets();
  }

  async function moveOrder(id: string, dir: -1 | 1) {
    const sponsors = assets.filter(a => a.tipo === "logo_patrocinador").sort((a, b) => a.orden - b.orden);
    const idx = sponsors.findIndex(s => s.id === id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= sponsors.length) return;

    const a = sponsors[idx];
    const b = sponsors[swapIdx];
    await Promise.all([
      supabase.from("cartel_assets").update({ orden: b.orden }).eq("id", a.id),
      supabase.from("cartel_assets").update({ orden: a.orden }).eq("id", b.id),
    ]);
    fetchAssets();
  }

  // Collect categorised data
  const fondos     = assets.filter(a => a.tipo === "fondo");
  const instLogos  = assets.filter(a => a.tipo === "logo_institucional");
  const sponsors   = assets.filter(a => a.tipo === "logo_patrocinador").sort((a, b) => a.orden - b.orden);

  function getFondo(subtipo: string) { return fondos.find(f => f.subtipo === subtipo); }
  function getInst(subtipo: string)  { return instLogos.find(l => l.subtipo === subtipo); }

  // Upload input helper
  function UploadZone({
    label, hint, url, isLoading, onFile,
  }: {
    label: string; hint?: string; url?: string;
    isLoading: boolean;
    onFile: (f: File) => void;
  }) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        {url ? (
          <img src={url} alt={label}
            style={{ width: 56, height: 56, objectFit: "contain",
                     background: "rgba(255,255,255,0.04)", borderRadius: 8 }} />
        ) : (
          <div style={{ width: 56, height: 56, background: "rgba(255,255,255,0.04)",
                        borderRadius: 8, display: "flex", alignItems: "center",
                        justifyContent: "center", color: "#555", fontSize: 10 }}>
            Sin logo
          </div>
        )}
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 800, fontSize: "0.9rem", color: "white", margin: 0 }}>{label}</p>
          {hint && <p style={{ fontSize: "0.72rem", color: "#666", margin: "2px 0 6px" }}>{hint}</p>}
          <label className="file-input-label" style={{ width: "auto", padding: "0 1rem", height: 36 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
            </svg>
            {isLoading ? "Subiendo..." : "Subir / Actualizar"}
            <input type="file" className="hidden-input" accept="image/*"
              disabled={isLoading}
              onChange={e => { if (e.target.files?.[0]) onFile(e.target.files[0]); }} />
          </label>
        </div>
      </div>
    );
  }

  const sectionTitle = (txt: string) => (
    <p style={{ fontSize: "0.7rem", fontWeight: 800, textTransform: "uppercase",
                letterSpacing: "1.5px", color: "var(--primary)", margin: "1.8rem 0 1rem" }}>
      {txt}
    </p>
  );

  return (
    <div className="card glass">
      <h3>Activos del Generador de Carteles</h3>
      <p style={{ color: "#a3a3a3", fontSize: "0.85rem", marginTop: "0.25rem" }}>
        Sube aquí los logos y fondos. El generador los carga automáticamente.
      </p>

      {/* ── Logos institucionales ──────────────────────────────────────────── */}
      {sectionTitle("Logos Institucionales")}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        {INST_LOGOS.map(({ subtipo, label, hint }) => (
          <UploadZone
            key={subtipo}
            label={label}
            hint={hint}
            url={getInst(subtipo)?.url}
            isLoading={!!loading[`logo_institucional_${subtipo}`]}
            onFile={f => uploadAsset(f, "logo_institucional", subtipo, label)}
          />
        ))}
      </div>

      {/* ── Fondos por plantilla ───────────────────────────────────────────── */}
      {sectionTitle("Fondos de Plantillas")}
      <p style={{ color: "#666", fontSize: "0.8rem", marginTop: "-0.5rem", marginBottom: "1rem" }}>
        Cada plantilla puede tener su propio fondo. Si no se sube, usa el fondo por defecto <code>/fondo-cartel.png</code>.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        {Object.entries(TEMPLATE_LABELS).map(([subtipo, label]) => (
          <UploadZone
            key={subtipo}
            label={label}
            url={getFondo(subtipo)?.url}
            isLoading={!!loading[`fondo_${subtipo}`]}
            onFile={f => uploadAsset(f, "fondo", subtipo, label)}
          />
        ))}
      </div>

      {/* ── Patrocinadores ─────────────────────────────────────────────────── */}
      {sectionTitle("Patrocinadores (barra inferior)")}
      <p style={{ color: "#666", fontSize: "0.8rem", marginTop: "-0.5rem", marginBottom: "1rem" }}>
        El generador muestra los primeros 5 en orden. Usa ↑↓ para reordenar.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
        {sponsors.map((sp, i) => (
          <div key={sp.id} style={{
            display: "flex", alignItems: "center", gap: "1rem",
            background: "rgba(255,255,255,0.03)", borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.06)", padding: "0.75rem 1rem",
          }}>
            <span style={{ color: "var(--primary)", fontWeight: 900, fontSize: "0.85rem", width: 20 }}>
              {i + 1}
            </span>
            <img src={sp.url} alt={sp.nombre}
              style={{ width: 52, height: 36, objectFit: "contain",
                       background: "rgba(255,255,255,0.04)", borderRadius: 6 }} />
            <span style={{ flex: 1, fontWeight: 700, fontSize: "0.9rem" }}>{sp.nombre}</span>
            <div style={{ display: "flex", gap: "0.4rem" }}>
              <button onClick={() => moveOrder(sp.id, -1)} style={arrowBtn}>↑</button>
              <button onClick={() => moveOrder(sp.id, 1)}  style={arrowBtn}>↓</button>
              <button onClick={() => deleteAsset(sp.id)}
                className="btn-delete" style={{ padding: "0.3rem 0.6rem", fontSize: "0.72rem" }}>
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add new sponsor */}
      <div style={{ marginTop: "1rem" }}>
        <label className="file-input-label">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Añadir patrocinador
          <input type="file" className="hidden-input" accept="image/*"
            onChange={async e => {
              const file = e.target.files?.[0];
              if (!file) return;
              const nombre = prompt("Nombre del patrocinador:", file.name.replace(/\.[^.]+$/, ""));
              if (!nombre) return;
              const nextOrden = sponsors.length;
              await uploadAsset(file, "logo_patrocinador", nombre.toLowerCase().replace(/\s/g, "-"), nombre, nextOrden);
            }} />
        </label>
      </div>
    </div>
  );
}

const arrowBtn: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "white",
  width: 30, height: 30,
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: 800,
  fontSize: "0.9rem",
};
