/**
 * components/admin/cartel/FormMultiusos.tsx
 * Form panel for the "Multiusos / Anuncio" template.
 */

import React from "react";
import { Field, Select, Textarea } from "@/components/ui/foundation/Fields";
import { CategorySelector, SectionLabel } from "./Common";
import { Button } from "@/components/ui/foundation/Button";
import styles from "./Formularios.module.css";
import { PlegableMovil } from "./PlegableMovil";
import type { FormState, MultiusosTema } from "./types";

interface Props {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  handleMultiusosFile: (num: 1 | 2, file: File | null) => void;
}

const TEMAS: { id: MultiusosTema; label: string; icon: string }[] = [
  { id: "celebracion", label: "🏆 Celebración (Títulos/Ascensos)", icon: "🏆" },
  { id: "medico", label: "🏥 Parte Médico", icon: "🏥" },
  { id: "fichaje", label: "✍️ Nova Incorporación", icon: "✍️" },
  { id: "despedida", label: "👋 Grazas / Despedida", icon: "👋" },
  { id: "formal", label: "📢 Aviso Formal / Comunicado", icon: "📢" },
];

export const FormMultiusos: React.FC<Props> = ({
  form,
  set,
  handleMultiusosFile,
}) => {
  return (
    <>
      <CategorySelector value={form.categoria} onChange={(v: string) => set("categoria", v)} />

      <div className={styles.campo}>
        <Select
          label="Tema visual"
          value={form.multiusosTema}
          onChange={(e) => set("multiusosTema", e.target.value as MultiusosTema)}
        >
          {TEMAS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </Select>
      </div>

      <div className={styles.campo}>
        <Field
          label="Título"
          placeholder="¡CAMPIÓNS DA COPA!"
          value={form.multiusosTitulo}
          onChange={(e) => set("multiusosTitulo", e.target.value)}
        />
      </div>

      <div className={styles.campo}>
        <Textarea
          label="Texto"
          rows={4}
          placeholder="Pasamos á seguinte fase do torneo. Parabéns a todo o equipo!"
          value={form.multiusosTexto}
          onChange={(e) => set("multiusosTexto", e.target.value)}
        />
      </div>

      <PlegableMovil titulo="Imágenes">
        <SectionLabel>Imágenes Enmarcadas (Opcional)</SectionLabel>
        <p style={{ fontSize: "0.75rem", color: "#888", marginBottom: "1rem" }}>
          Sube capturas (ej. tabla de clasificación, cuadrante de eliminatorias o foto de
          celebración). Se integrarán con bordes redondeados y sombras premium de forma automática.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div
            style={{
              background: "rgba(255,255,255,0.02)",
              padding: "1rem",
              borderRadius: "10px",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <label
              style={{
                display: "block",
                fontSize: "0.8rem",
                fontWeight: 700,
                color: "#ccc",
                marginBottom: "0.5rem",
              }}
            >
              📸 Imagen Principal (Centro o Izquierda)
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <label className="file-input-label" style={{ flex: 1, margin: 0 }}>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
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
                <Button size="sm" variant="danger"
                  onClick={() => handleMultiusosFile(1, null)}
                  
                  title="Quitar"
                >
                  ✕
                </Button>
              )}
            </div>
            {form.multiusosImg1Url && (
              // eslint-disable-next-line @next/next/no-img-element -- vista previa en memoria
              <img
                src={form.multiusosImg1Url}
                alt=""
                style={{
                  width: "100%",
                  maxHeight: "120px",
                  objectFit: "contain",
                  marginTop: "0.8rem",
                  borderRadius: "4px",
                }}
              />
            )}
          </div>

          <div
            style={{
              background: "rgba(255,255,255,0.02)",
              padding: "1rem",
              borderRadius: "10px",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <label
              style={{
                display: "block",
                fontSize: "0.8rem",
                fontWeight: 700,
                color: "#ccc",
                marginBottom: "0.5rem",
              }}
            >
              📸 Segunda Imagen (Derecha / Cuadrante secundario)
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <label className="file-input-label" style={{ flex: 1, margin: 0 }}>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
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
                <Button size="sm" variant="danger"
                  onClick={() => handleMultiusosFile(2, null)}
                  
                  title="Quitar"
                >
                  ✕
                </Button>
              )}
            </div>
            {form.multiusosImg2Url && (
              // eslint-disable-next-line @next/next/no-img-element -- vista previa en memoria
              <img
                src={form.multiusosImg2Url}
                alt=""
                style={{
                  width: "100%",
                  maxHeight: "120px",
                  objectFit: "contain",
                  marginTop: "0.8rem",
                  borderRadius: "4px",
                }}
              />
            )}
          </div>
        </div>
      </PlegableMovil>
    </>
  );
};
