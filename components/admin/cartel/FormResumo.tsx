/**
 * components/admin/cartel/FormResumo.tsx
 * Form panel for the "Resumo da Xornada" template.
 */

import React from "react";
import type { FormState } from "./types";
import { FormPartido } from "./FormPartido";
import { SectionLabel, MatchSelector } from "./Common";

interface Props {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  equipos: { id: string; nombre: string; escudo_url: string }[];
  handleRivalSelect: (nombre: string) => void;
  handleRivalFile: (file: File) => void;
  dbMatches: any[];
  loadMatchFromDb: (m: any) => void;
}

export const FormResumo = (props: Props) => {
  const { form, set, dbMatches, loadMatchFromDb } = props;
  return (
    <>
      <MatchSelector dbMatches={dbMatches} onSelect={loadMatchFromDb} categoria={form.categoria} />
      <FormPartido {...props} />
      <SectionLabel>Resultado</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
        <div className="input-group">
          <label>Goles Local</label>
          <input type="text" inputMode="numeric" pattern="[0-9]*" value={form.golesLocal} onChange={e => set("golesLocal", e.target.value)} />
        </div>
        <div className="input-group">
          <label>Goles Visitante</label>
          <input type="text" inputMode="numeric" pattern="[0-9]*" value={form.golesRival} onChange={e => set("golesRival", e.target.value)} />
        </div>
      </div>

      <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', color: '#ccc' }}>
          <input 
            type="checkbox" 
            checked={form.showCarouselIndicator} 
            onChange={e => set("showCarouselIndicator", e.target.checked)} 
            style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
          />
          Mostrar indicador de carrusel (Instagram)
        </label>
        <p style={{ fontSize: '0.7rem', color: '#666', marginTop: '5px', marginLeft: '28px' }}>
          Añade un texto sutil en la parte inferior para guiar al usuario a deslizar.
        </p>
      </div>
    </>
  );
};
