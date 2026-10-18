/**
 * Formulario del comunicado oficial, parte médico o loito: texto serio, escudo y firma. Sin
 * logos de patrocinadores ni de instituciones.
 */
import React from "react";
import { Field, Select, Textarea } from "@/components/ui/foundation/Fields";
import styles from "./Formularios.module.css";
import type { FormState } from "./types";

interface Props {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
}

export const FormComunicado: React.FC<Props> = ({ form, set }) => (
  <>
    <Select
      label="Qué es"
      value={form.comunicadoTipo}
      onChange={(e) => set("comunicadoTipo", e.target.value as FormState["comunicadoTipo"])}
    >
      <option value="oficial">Comunicado oficial</option>
      <option value="medico">Parte médico</option>
      <option value="loito">Loito</option>
    </Select>
    <Field
      label="Título"
      placeholder="Baixas para o resto da tempada"
      value={form.comunicadoTitulo}
      onChange={(e) => set("comunicadoTitulo", e.target.value)}
    />
    <Textarea
      label="Texto"
      hint="Deja una línea en blanco para separar párrafos."
      rows={7}
      value={form.comunicadoTexto}
      onChange={(e) => set("comunicadoTexto", e.target.value)}
    />
    <div className={styles.pareja}>
      <Field
        label="Fecha"
        type="date"
        value={form.comunicadoFecha}
        onChange={(e) => set("comunicadoFecha", e.target.value)}
      />
      <Field
        label="Firma"
        value={form.comunicadoFirma}
        onChange={(e) => set("comunicadoFirma", e.target.value)}
      />
    </div>
  </>
);
