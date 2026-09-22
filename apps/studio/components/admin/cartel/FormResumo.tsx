/**
 * components/admin/cartel/FormResumo.tsx
 * Form panel for the "Resumo da Xornada" template.
 */

import React from "react";
import { Field } from "@/components/ui/foundation/Fields";
import type { CompetenciaRow } from "@/lib/competition";
import { SectionLabel, MatchSelector } from "./Common";
import type { SelectorMatch } from "./Common";
import { FormPartido } from "./FormPartido";
import styles from "./Formularios.module.css";
import type { FormState } from "./types";

interface Props {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  equipos: { id: string; nombre: string; escudo_url: string }[];
  handleRivalSelect: (nombre: string) => void;
  handleRivalFile: (file: File) => void;
  dbMatches: SelectorMatch[];
  loadMatchFromDb: (m: SelectorMatch) => void;
  campos: { id: string; nombre: string; poblacion: string }[];
  competiciones: CompetenciaRow[];
}

export const FormResumo = (props: Props & { tipo: string }) => {
  const { form, set, tipo, dbMatches, loadMatchFromDb } = props;
  return (
    <>
      <MatchSelector
        dbMatches={dbMatches}
        onSelect={loadMatchFromDb}
        categoria={form.categoria}
        competicionId={form.competicion_id}
        tipo={tipo}
        santisoOnly
      />
      <FormPartido {...props} tipo={tipo} />
      <SectionLabel>Resultado</SectionLabel>
      <div className={styles.pareja}>
        <Field
          label="Goles del local"
          inputMode="numeric"
          pattern="[0-9]*"
          value={form.golesLocal}
          onChange={(e) => set("golesLocal", e.target.value)}
        />
        <Field
          label="Goles del visitante"
          inputMode="numeric"
          pattern="[0-9]*"
          value={form.golesRival}
          onChange={(e) => set("golesRival", e.target.value)}
        />
      </div>

      <div className={styles.casillaBloque}>
        <label className={styles.casilla}>
          <input
            type="checkbox"
            className={styles.check}
            checked={form.showCarouselIndicator}
            onChange={(e) => set("showCarouselIndicator", e.target.checked)}
          />
          Mostrar indicador de carrusel (Instagram)
        </label>
        <p className={styles.aviso}>Añade un texto sutil abajo para invitar a deslizar.</p>
      </div>
    </>
  );
};
