/**
 * components/admin/cartel/FormResumo.tsx
 * Form panel for the "Resumo da Xornada" template.
 */

import React from "react";
import type { FormState } from "./types";
import { FormPartido } from "./FormPartido";
import { SectionLabel } from "./Common";

interface Props {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  equipos: { id: string; nombre: string; escudo_url: string }[];
  handleRivalSelect: (nombre: string) => void;
  handleRivalFile: (file: File) => void;
}

export const FormResumo: React.FC<Props> = (props) => {
  const { form, set } = props;
  return (
    <>
      <FormPartido {...props} />
      <SectionLabel>Resultado</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
        <div className="input-group">
          <label>Goles Santiso</label>
          <input type="text" inputMode="numeric" pattern="[0-9]*" value={form.golesLocal} onChange={e => set("golesLocal", e.target.value)} />
        </div>
        <div className="input-group">
          <label>Goles Rival</label>
          <input type="text" inputMode="numeric" pattern="[0-9]*" value={form.golesRival} onChange={e => set("golesRival", e.target.value)} />
        </div>
      </div>
    </>
  );
};
