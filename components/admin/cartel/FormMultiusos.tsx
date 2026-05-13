/**
 * components/admin/cartel/FormMultiusos.tsx
 * Form panel for the "Multiusos / Anuncio" template.
 */

import React from "react";
import type { FormState, MultiusosTema } from "./types";
import { CategorySelector, SectionLabel, Toggle } from "./Common";

interface Props {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  handleMultiusosFile: (num: 1 | 2, file: File | null) => void;
  jugadores: { id: string; nombre?: string | null; apodo?: string | null; categoria?: string | null; foto_url?: string | null }[];
  jugFileName: string;
  handleJugadorFile: (file: File) => void;
}

const TEMAS: { id: MultiusosTema; label: string; icon: string }[] = [
  { id: "celebracion", label: "🏆 Celebración (Títulos/Ascensos)", icon: "🏆" },
  { id: "medico", label: "🏥 Parte Médico", icon: "🏥" },
  { id: "fichaje", label: "✍️ Nova Incorporación", icon: "✍️" },
  { id: "despedida", label: "👋 Grazas / Despedida", icon: "👋" },
  { id: "formal", label: "📢 Aviso Formal / Comunicado", icon: "📢" },
];

export const FormMultiusos: React.FC<Props> = ({ form, set, handleMultiusosFile, jugadores, jugFileName, handleJugadorFile }) => {
  const getDisplayName = (j: any) => {
    if (!j) return "";
    if (j.apodo) return j.apodo;
    if (!j.nombre) return "";
    const parts = j.nombre.split(" ");
    return parts.length > 1 ? `${parts[0]} ${parts[1]}` : j.nombre;
  };
  const jugadoresCategoria = jugadores.filter(j => j.categoria === form.categoria);

  return (
    <>
      <CategorySelector value={form.categoria} onChange={(v: string) => set("categoria", v)} />

      <SectionLabel>Visibilidad de Activos</SectionLabel>
      <div style={{ display: "flex", gap: "0.8rem", marginBottom: "1.5rem" }}>
        <Toggle label="Logos y Patrocinadores" active={form.showAssets} onClick={() => set("showAssets", !form.showAssets)} />
      </div>

      <div className="input-group" style={{ marginBottom: "1.5rem" }}>
        <label>Tema / Estética Visual</label>
        <select
          value={form.multiusosTema}
          onChange={(e) => set("multiusosTema", e.target.value as MultiusosTema)}
          style={{
            width: "100%",
            background: "rgba(0,0,0,0.4)",
            color: "white",
            padding: "0.7rem",
            borderRadius: "8px",
            border: "1px solid rgba(255,255,255,0.15)",
            outline: "none",
            fontWeight: 600,
          }}
        >
          {TEMAS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="input-group" style={{ marginBottom: "1.2rem" }}>
        <label>Título Principal</label>
        <input
          type="text"
          placeholder="Ej: ¡CAMPIÓNS DA COPA!"
          value={form.multiusosTitulo}
          onChange={(e) => set("multiusosTitulo", e.target.value)}
          style={{ fontWeight: 800 }}
        />
      </div>

      <div className="input-group" style={{ marginBottom: "1.2rem" }}>
        <label>Texto / Descrición</label>
        <textarea
          rows={4}
          placeholder="Escribe o texto do comunicado ou aviso..."
          value={form.multiusosTexto}
          onChange={(e) => set("multiusosTexto", e.target.value)}
          style={{
            width: "100%",
            background: "rgba(0,0,0,0.3)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "8px",
            color: "white",
            padding: "0.8rem",
            fontFamily: "inherit",
            fontSize: "0.85rem",
            resize: "vertical",
          }}
        />
      </div>

      <SectionLabel>Jugador Destacado (Opcional)</SectionLabel>
      <p style={{ fontSize: "0.75rem", color: "#888", marginBottom: "1rem" }}>
        Sube o selecciona un jugador para integrarlo de forma gigante (heroica) en el diseño. Ideal para renovaciones, fichajes o MVP.
      </p>

      <div className="input-group" style={{ marginBottom: "1.2rem" }}>
        <label>Seleccionar de la Base de Datos</label>
        <select 
          onChange={e => {
            const url = e.target.value;
            set("jugadorFotoUrl", url);
            // resetear recortes
            set("jugadorXOffset", 0);
            set("jugadorYOffset", 0);
            set("jugadorZoom", 100);
          }}
          style={{ marginBottom: "0.5rem" }}
        >
          <option value="">-- Sin jugador o foto manual --</option>
          {jugadoresCategoria.map(j => {
            if (!j.foto_url) return null;
            return (
              <option key={j.id} value={j.foto_url}>
                {getDisplayName(j)}
              </option>
            );
          })}
        </select>
        <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.8rem" }}>O sube la foto manualmente (sin fondo):</label>
        <label className="file-input-label">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
          </svg>
          {jugFileName || "Subir foto del jugador"}
          <input type="file" className="hidden-input" accept="image/*"
            onChange={e => { if (e.target.files?.[0]) handleJugadorFile(e.target.files[0]); }} />
        </label>
      </div>

      {form.jugadorFotoUrl && (
        <div className="input-group" style={{ marginBottom: "1.2rem", background: "rgba(255,255,255,0.03)", padding: "1rem", borderRadius: "10px", border: "1px solid var(--border)" }}>
          <label style={{ color: "var(--primary)", fontSize: "0.75rem", marginBottom: "1rem", display: "block" }}>🎯 Ajustes de encuadre del jugador</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 40px", gap: "0.5rem", alignItems: "center", marginBottom: "0.8rem" }}>
            <label style={{ gridColumn: "1 / -1", fontSize: "0.7rem" }}>Horizontal (X)</label>
            <input type="range" min="-300" max="300" value={form.jugadorXOffset} onChange={e => set("jugadorXOffset", parseInt(e.target.value))} />
            <span style={{ fontSize: "0.7rem", textAlign: "right" }}>{form.jugadorXOffset}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 40px", gap: "0.5rem", alignItems: "center", marginBottom: "0.8rem" }}>
            <label style={{ gridColumn: "1 / -1", fontSize: "0.7rem" }}>Vertical (Y)</label>
            <input type="range" min="-300" max="300" value={form.jugadorYOffset} onChange={e => set("jugadorYOffset", parseInt(e.target.value))} />
            <span style={{ fontSize: "0.7rem", textAlign: "right" }}>{form.jugadorYOffset}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 40px", gap: "0.5rem", alignItems: "center" }}>
            <label style={{ gridColumn: "1 / -1", fontSize: "0.7rem" }}>Tamaño (Zoom %)</label>
            <input type="range" min="50" max="250" value={form.jugadorZoom} onChange={e => set("jugadorZoom", parseInt(e.target.value))} />
            <span style={{ fontSize: "0.7rem", textAlign: "right" }}>{form.jugadorZoom}%</span>
          </div>
        </div>
      )}

      <SectionLabel>Imágenes Enmarcadas (Opcional)</SectionLabel>
      <p style={{ fontSize: "0.75rem", color: "#888", marginBottom: "1rem" }}>
        Sube capturas (ej. tabla de clasificación, cuadrante de eliminatorias o foto de celebración). Se integrarán con bordes redondeados y sombras premium de forma automática.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div style={{ background: "rgba(255,255,255,0.02)", padding: "1rem", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.05)" }}>
          <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#ccc", marginBottom: "0.5rem" }}>
            📸 Imagen Principal (Centro o Izquierda)
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <label className="file-input-label" style={{ flex: 1, margin: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
              {form.multiusosImg1Url ? "Cambiar Imagen 1" : "Subir Imagen 1"}
              <input
                type="file"
                className="hidden-input"
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleMultiusosFile(1, e.target.files[0]);
                }}
              />
            </label>
            {form.multiusosImg1Url && (
              <button
                type="button"
                onClick={() => handleMultiusosFile(1, null)}
                style={{ background: "rgba(239, 68, 68, 0.2)", border: "none", color: "#ef4444", padding: "0.6rem", borderRadius: "6px", cursor: "pointer" }}
                title="Quitar"
              >
                ✕
              </button>
            )}
          </div>
          {form.multiusosImg1Url && (
            <img src={form.multiusosImg1Url} alt="" style={{ width: "100%", maxHeight: "120px", objectFit: "contain", marginTop: "0.8rem", borderRadius: "4px" }} />
          )}
        </div>

        <div style={{ background: "rgba(255,255,255,0.02)", padding: "1rem", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.05)" }}>
          <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#ccc", marginBottom: "0.5rem" }}>
            📸 Segunda Imagen (Derecha / Cuadrante secundario)
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <label className="file-input-label" style={{ flex: 1, margin: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
              {form.multiusosImg2Url ? "Cambiar Imagen 2" : "Subir Imagen 2"}
              <input
                type="file"
                className="hidden-input"
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleMultiusosFile(2, e.target.files[0]);
                }}
              />
            </label>
            {form.multiusosImg2Url && (
              <button
                type="button"
                onClick={() => handleMultiusosFile(2, null)}
                style={{ background: "rgba(239, 68, 68, 0.2)", border: "none", color: "#ef4444", padding: "0.6rem", borderRadius: "6px", cursor: "pointer" }}
                title="Quitar"
              >
                ✕
              </button>
            )}
          </div>
          {form.multiusosImg2Url && (
            <img src={form.multiusosImg2Url} alt="" style={{ width: "100%", maxHeight: "120px", objectFit: "contain", marginTop: "0.8rem", borderRadius: "4px" }} />
          )}
        </div>
      </div>
    </>
  );
};
