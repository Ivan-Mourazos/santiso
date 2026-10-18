/**
 * Formulario del cartel de fichaje, renovación o vuelta: foto completa (la que se quiera) y
 * texto. Sin logos.
 */
import React from "react";
import { Field, Select, Textarea } from "@/components/ui/foundation/Fields";
import { Deslizador, Toggle } from "./Common";
import styles from "./Formularios.module.css";
import type { FormState } from "./types";

interface Props {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  jugFileName: string;
  handleJugadorFile: (file: File) => void;
}

export const FormFichaxe: React.FC<Props> = ({ form, set, jugFileName, handleJugadorFile }) => (
  <>
    <Select
      label="Qué es"
      value={form.fichaxeTipo}
      onChange={(e) => set("fichaxeTipo", e.target.value as FormState["fichaxeTipo"])}
    >
      <option value="fichaxe">Nova incorporación</option>
      <option value="renovacion">Renovación</option>
      <option value="volta">Volve a casa</option>
    </Select>
    <div className={styles.pareja}>
      <Field
        label="Nombre"
        placeholder="Hugo"
        value={form.fichaxeNombre}
        onChange={(e) => set("fichaxeNombre", e.target.value)}
      />
      <Field
        label="Apellidos o apodo (en grande)"
        placeholder="Cea Amor"
        value={form.fichaxeApellido}
        onChange={(e) => set("fichaxeApellido", e.target.value)}
      />
    </div>
    <Field
      label="Detalle"
      placeholder="Centrocampista · chega do C.D. Arzúa"
      value={form.fichaxeDetalle}
      onChange={(e) => set("fichaxeDetalle", e.target.value)}
    />
    <Textarea
      label="Frase (opcional)"
      rows={2}
      value={form.fichaxeFrase}
      onChange={(e) => set("fichaxeFrase", e.target.value)}
    />

    <div className={styles.campo}>
      <span className={styles.etiqueta}>Foto</span>
      <label className="file-input-label">
        {jugFileName ? `Cambiar foto (${jugFileName})` : "Subir la foto del jugador"}
        <input
          type="file"
          className="hidden-input"
          accept="image/*"
          onChange={(e) => {
            const fichero = e.target.files?.[0];
            e.target.value = "";
            if (fichero) handleJugadorFile(fichero);
          }}
        />
      </label>
    </div>
    {form.jugadorFotoUrl && (
      <div className={styles.encuadre}>
        <h5>Encuadre de la foto</h5>
        <Deslizador
          label="Desplazamiento horizontal"
          min={0}
          max={1}
          step={0.01}
          value={form.jugadorXOffset}
          onChange={(v) => set("jugadorXOffset", v)}
          extremos={["Izquierda", "Derecha"]}
        />
        <Deslizador
          label="Desplazamiento vertical"
          min={0}
          max={1}
          step={0.01}
          value={form.jugadorYOffset}
          onChange={(v) => set("jugadorYOffset", v)}
          extremos={["Arriba", "Abajo"]}
        />
        <Deslizador
          label="Zoom"
          min={1}
          max={4}
          step={0.01}
          value={Math.max(1, form.jugadorZoom)}
          onChange={(v) => set("jugadorZoom", v)}
        />
      </div>
    )}
    <div className={styles.interruptores}>
      <Toggle
        label="Escudo pequeño arriba"
        active={form.fichaxeConEscudo}
        onClick={() => set("fichaxeConEscudo", !form.fichaxeConEscudo)}
      />
    </div>
  </>
);
