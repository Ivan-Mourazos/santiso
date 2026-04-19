/**
 * components/admin/cartel/FormProximos.tsx
 * Form panel for the "Próximos Encontros" template.
 */

import React from "react";
import type { FormState } from "./types";
import { SectionLabel } from "./Common";
import type { NextMatch } from "@/lib/cartel-draw";

interface Props {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  updateMatch: (i: number, patch: Partial<NextMatch>) => void;
}

export const FormProximos: React.FC<Props> = ({ form, set, updateMatch }) => {
  return (
    <>
      <div className="input-group" style={{ marginBottom: "1rem" }}>
        <label>Texto de categorías (Badge)</label>
        <input type="text" value={form.categoriasText}
          onChange={e => set("categoriasText", e.target.value)} />
      </div>

      <SectionLabel>Partidos destacados (Máx. 3)</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {form.matches.map((m, i) => (
          <div key={i} style={{
            background: "rgba(255,255,255,0.02)",
            padding: "0.8rem",
            borderRadius: "0.6rem",
            border: "1px solid var(--border)"
          }}>
            <div className="input-group" style={{ marginBottom: "0.6rem" }}>
              <label>Rival</label>
              <input type="text" placeholder="Rival" value={m.rival}
                onChange={e => updateMatch(i, { rival: e.target.value })} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", marginBottom: "0.6rem" }}>
              <div className="input-group">
                <label>Fecha</label>
                <input type="date" value={m.fecha}
                  onChange={e => updateMatch(i, { fecha: e.target.value })} />
              </div>
              <div className="input-group">
                <label>Hora</label>
                <input type="text" placeholder="18:00H" value={m.hora}
                  onChange={e => updateMatch(i, { hora: e.target.value })} />
              </div>
            </div>
            <div className="input-group">
              <label>Categoría</label>
              <input type="text" placeholder="Senior" value={m.categoria}
                onChange={e => updateMatch(i, { categoria: e.target.value })} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
};
