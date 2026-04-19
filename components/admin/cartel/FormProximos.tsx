/**
 * components/admin/cartel/FormProximos.tsx
 * Form panel for the "Próximos Encontros" template.
 */

import React from "react";
import type { FormState } from "./types";
import { SectionLabel, Toggle } from "./Common";
import type { NextMatch } from "@/lib/cartel-draw";

interface Props {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  updateMatch: (i: number, patch: Partial<NextMatch>) => void;
  equipos: { id: string; nombre: string; escudo_url: string }[];
}

export const FormProximos: React.FC<Props> = ({ form, set, updateMatch, equipos }) => {
  return (
    <>
<SectionLabel>Configurar los 3 partidos</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {form.matches.map((m, i) => (
          <div key={i} style={{
            background: "rgba(255,255,255,0.02)",
            padding: "1rem",
            borderRadius: "0.6rem",
            border: "1px solid var(--border)"
          }}>
            <p style={{ margin: "0 0 0.8rem", fontSize: "0.75rem", fontWeight: 800, color: "var(--primary)" }}>PARTIDO {i + 1}</p>
            
            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "0.8rem", marginBottom: "0.8rem" }}>
              <div className="input-group">
                <label>Rival</label>
                <select 
                  value={m.rival}
                  onChange={e => {
                    const eq = equipos.find(ev => ev.nombre === e.target.value);
                    updateMatch(i, { rival: e.target.value, rivalEscudoUrl: eq?.escudo_url || "" });
                  }}
                >
                  <option value="">-- Seleccionar --</option>
                  {equipos
                    .filter(e => {
                      const dbCat = (e.categoria || "").toLowerCase();
                      const stateCat = (m.categoria || "").toLowerCase();
                      // Match "sen" for Senior/Sénior, "fem" for Femenino/Feminino, "vet" for Veteranos
                      return dbCat.startsWith(stateCat.substring(0, 3));
                    })
                    .map(e => <option key={e.id} value={e.nombre}>{e.nombre}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label>Categoría</label>
                <select value={m.categoria} onChange={e => updateMatch(i, { 
                categoria: e.target.value,
                rival: "",
                rivalEscudoUrl: ""
              })}>
                  <option value="Sénior">Sénior</option>
                  <option value="Feminino">Feminino</option>
                  <option value="Veteranos">Veteranos</option>
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8rem" }}>
              <div className="input-group">
                <label>Fecha</label>
                <input type="date" value={m.fecha}
                  onChange={e => updateMatch(i, { fecha: e.target.value })} />
              </div>
              <div className="input-group">
                <label>Localía</label>
                <div style={{ display: "flex", gap: "0.4rem" }}>
                  <Toggle label="LOCAL" active={m.santisoSide === "left"} onClick={() => updateMatch(i, { santisoSide: "left" })} />
                  <Toggle label="VISIT." active={m.santisoSide === "right"} onClick={() => updateMatch(i, { santisoSide: "right" })} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};
