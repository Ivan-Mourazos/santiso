/**
 * components/admin/cartel/FormClasificacion.tsx
 * Form panel for the "Clasificación / Copa" template.
 */

import React, { useEffect, useState } from "react";
import type { FormState } from "./types";
import { CategorySelector, SectionLabel, Toggle } from "./Common";
import { useCompeticiones } from "@/lib/useCompeticiones";
import { getClasificacionData } from "@/lib/cartel/clasificacion-data";

interface Props {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
}

export const FormClasificacion: React.FC<Props> = ({ form, set }) => {
  const { competicionesEnCategoria } = useCompeticiones(form.categoria);
  const [loading, setLoading] = useState(false);
  const [competicionId, setCompeticionId] = useState("");

  // Auto-select a competition that belongs to the current category.
  useEffect(() => {
    const firstCompetitionId = competicionesEnCategoria[0]?.id || "";
    const selectedExists = competicionesEnCategoria.some((c) => c.id === competicionId);

    if (!selectedExists) {
      setCompeticionId(firstCompetitionId);
    }
  }, [competicionesEnCategoria, competicionId]);

  // Fetch data when competition changes
  useEffect(() => {
    if (!competicionId || !form.categoria) {
      set("clasificacionData", []);
      return;
    }

    let isMounted = true;
    setLoading(true);

    getClasificacionData(form.categoria, competicionId)
      .then((data) => {
        if (!isMounted) return;
        const comp = competicionesEnCategoria.find(c => c.id === competicionId);
        set("clasificacionTipo", comp?.formato === "eliminatoria" ? "copa" : "liga");
        set("clasificacionNombre", comp?.nombre || "");
        set("clasificacionData", data.equipos);
      })
      .catch(() => {
        if (!isMounted) return;
        set("clasificacionData", []);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.categoria, competicionId, competicionesEnCategoria]);

  return (
    <>
      <CategorySelector value={form.categoria} onChange={(v: string) => set("categoria", v)} />

      <SectionLabel>Visibilidad de Activos</SectionLabel>
      <div style={{ display: "flex", gap: "0.8rem", marginBottom: "1.5rem" }}>
        <Toggle label="Logos y Patrocinadores" active={form.showAssets} onClick={() => set("showAssets", !form.showAssets)} />
      </div>

      <div className="input-group" style={{ marginBottom: "1.2rem" }}>
        <label>Competición a renderizar</label>
        <select
          value={competicionId}
          onChange={(e) => setCompeticionId(e.target.value)}
          style={{ width: "100%", padding: "0.75rem", borderRadius: "8px", background: "rgba(0,0,0,0.4)", color: "white", border: "1px solid var(--border)", outline: "none" }}
        >
          {competicionesEnCategoria.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre} {c.formato === "eliminatoria" ? "(Eliminatorias)" : "(Liga)"}
            </option>
          ))}
        </select>
      </div>

      <SectionLabel>Previsualización de Datos</SectionLabel>
      <div style={{ background: "rgba(255,255,255,0.03)", padding: "1rem", borderRadius: "10px", border: "1px solid var(--border)", fontSize: "0.8rem", color: "#ccc" }}>
        {loading ? (
          <p>Cargando clasificación...</p>
        ) : (
          form.clasificacionData && form.clasificacionData.length > 0 ? (
            <p>
              Se cargaron <strong>{form.clasificacionData.length}</strong>{" "}
              {form.clasificacionTipo === "copa" ? "rondas para este cuadro." : "equipos para esta tabla."}
            </p>
          ) : (
            <p style={{ color: "#f87171" }}>No hay datos para esta categoría y competición.</p>
          )
        )}
      </div>

      <div className="input-group" style={{ marginBottom: "1rem", marginTop: "2rem" }}>
        <label>Santiso en el cartel (Logos Superiores)</label>
        <div style={{ display: "flex", gap: "0.6rem" }}>
          <button 
            onClick={() => set("santisoSide", "left")}
            style={{ flex: 1, padding: "0.6rem", background: form.santisoSide === "left" ? "var(--primary)" : "rgba(255,255,255,0.05)", color: form.santisoSide === "left" ? "#000" : "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>
            ← Izquierda
          </button>
          <button 
            onClick={() => set("santisoSide", "right")}
            style={{ flex: 1, padding: "0.6rem", background: form.santisoSide === "right" ? "var(--primary)" : "rgba(255,255,255,0.05)", color: form.santisoSide === "right" ? "#000" : "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>
            Derecha →
          </button>
        </div>
      </div>
    </>
  );
};
