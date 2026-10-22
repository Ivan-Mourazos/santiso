/**
 * Formulario de la lotaría do club: sorteo, número(s), papeleta y dónde comprarla. Lleva los
 * patrocinadores, pero no los logos de la RFGF ni de la Xunta.
 */
import React from "react";
import { Field, Select, Textarea } from "@/components/ui/foundation/Fields";
import styles from "./Formularios.module.css";
import type { FormState } from "./types";

interface Props {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
}

export const FormLoteria: React.FC<Props> = ({ form, set }) => (
  <>
    <div className={styles.pareja}>
      <Select
        label="Sorteo"
        value={form.loteriaSorteo}
        onChange={(e) => set("loteriaSorteo", e.target.value as FormState["loteriaSorteo"])}
      >
        <option value="nadal">Nadal (22 de decembro)</option>
        <option value="neno">Neno (6 de xaneiro)</option>
      </Select>
      <Field
        label="Año de Nadal"
        type="number"
        inputMode="numeric"
        value={String(form.loteriaAnio)}
        onChange={(e) => {
          const anio = Number(e.target.value);
          if (anio >= 2000 && anio <= 2100) set("loteriaAnio", anio);
        }}
      />
    </div>
    <Field
      label="Número"
      hint="Cinco cifras. Si el club juega dos, sepáralos con una coma."
      placeholder="12345"
      inputMode="numeric"
      value={form.loteriaNumeros}
      onChange={(e) => set("loteriaNumeros", e.target.value)}
    />
    <Field
      label="Título (opcional)"
      placeholder="Xa tes a túa?"
      value={form.loteriaTitulo}
      onChange={(e) => set("loteriaTitulo", e.target.value)}
    />
    <div className={styles.pareja}>
      <Field
        label="Precio papeleta (€)"
        placeholder="5"
        inputMode="decimal"
        value={form.loteriaPrezo}
        onChange={(e) => set("loteriaPrezo", e.target.value)}
      />
      <Field
        label="Juega (€)"
        placeholder="4"
        inputMode="decimal"
        value={form.loteriaXoga}
        onChange={(e) => set("loteriaXoga", e.target.value)}
      />
    </div>
    <Textarea
      label="Dónde comprarla"
      hint="Un sitio por línea."
      placeholder={"Bar do campo\nCalquera xogador do club"}
      rows={4}
      value={form.loteriaPuntos}
      onChange={(e) => set("loteriaPuntos", e.target.value)}
    />
  </>
);
