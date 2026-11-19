/**
 * Formulario del comunicado oficial, parte médico o loito: texto serio, escudo y firma. Sin
 * logos de patrocinadores ni de instituciones.
 */
import React, { useEffect } from "react";
import { Field, Select, Textarea } from "@/components/ui/foundation/Fields";
import styles from "./Formularios.module.css";
import type { FormState } from "./types";

interface Props {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
}

/** Hoy, en el formato del campo de fecha (aaaa-mm-dd), con la hora de aquí. */
function hoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const FormComunicado: React.FC<Props> = ({ form, set }) => {
  // Sin fecha elegida, la de hoy: casi siempre se publica el mismo día.
  const sinFecha = !form.comunicadoFecha;
  useEffect(() => {
    if (sinFecha) set("comunicadoFecha", hoy());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo cuando falta
  }, [sinFecha]);
  return (
    <div className={styles.formularioEditorial}>
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
      <div className={styles.dosCampos}>
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
    </div>
  );
};
