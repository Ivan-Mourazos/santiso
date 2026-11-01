/**
 * Formulario de O Nadal do Santiso: la lotaría (sorteo, número, precio y puntos de venda) y,
 * si ese año lo hay, el sorteo do Baúl. Sin patrocinadores ni logos: solo el escudo del club.
 */
import React from "react";
import { Button } from "@/components/ui/foundation/Button";
import { Field, Select, Textarea } from "@/components/ui/foundation/Fields";
import { Toggle } from "./Common";
import styles from "./Formularios.module.css";
import type { FormState, FotoLoteria } from "./types";

interface Props {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  handleLoteriaFile: (campo: FotoLoteria, file: File | null) => void;
}

/** Botón para subir (o quitar) una de las fotos de la lotaría. */
const SubirFoto: React.FC<{
  etiqueta: string;
  texto: string;
  url: string;
  onFile: (file: File | null) => void;
}> = ({ etiqueta, texto, url, onFile }) => (
  <div className={styles.campo}>
    <span className={styles.etiqueta}>{etiqueta}</span>
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <label className="file-input-label" style={{ flex: 1, margin: 0 }}>
        {url ? "Cambiar la foto" : texto}
        <input
          type="file"
          className="hidden-input"
          accept="image/*"
          onChange={(e) => {
            const fichero = e.target.files?.[0];
            e.target.value = "";
            if (fichero) onFile(fichero);
          }}
        />
      </label>
      {url && (
        <Button size="sm" variant="danger" onClick={() => onFile(null)} title="Quitar">
          ✕
        </Button>
      )}
    </div>
  </div>
);

export const FormLoteria: React.FC<Props> = ({ form, set, handleLoteriaFile }) => (
  <>
    <Field
      label="Título"
      placeholder="Xa está dispoñible"
      value={form.loteriaTitulo}
      onChange={(e) => set("loteriaTitulo", e.target.value)}
    />
    <Field
      label="Subtítulo"
      hint="Vacío, sale el sorteo y su día: «Lotaría de Nadal 2026 · Sorteo do 22 de decembro»."
      value={form.loteriaSubtitulo}
      onChange={(e) => set("loteriaSubtitulo", e.target.value)}
    />
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
      placeholder="14712"
      inputMode="numeric"
      value={form.loteriaNumeros}
      onChange={(e) => set("loteriaNumeros", e.target.value)}
    />
    <SubirFoto
      etiqueta="Foto del décimo"
      texto="Subir foto o escaneo del décimo"
      url={form.loteriaDecimoFoto}
      onFile={(f) => handleLoteriaFile("loteriaDecimoFoto", f)}
    />
    <div className={styles.pareja}>
      <Field
        label="Precio total (€)"
        placeholder="22"
        inputMode="decimal"
        value={form.loteriaPrezo}
        onChange={(e) => set("loteriaPrezo", e.target.value)}
      />
      <Field
        label="Juega (€)"
        hint="El resto sale como donativo."
        placeholder="20"
        inputMode="decimal"
        value={form.loteriaXoga}
        onChange={(e) => set("loteriaXoga", e.target.value)}
      />
    </div>
    <Textarea
      label="Puntos de venda"
      hint="Un sitio por línea."
      placeholder={"A Barbería de Iago\nCafetaría Solaina\nCampo de fútbol (días de partido)"}
      rows={6}
      value={form.loteriaPuntos}
      onChange={(e) => set("loteriaPuntos", e.target.value)}
    />
    <Textarea
      label="Otras formas de comprarla"
      hint="Sale debajo de los puntos de venda."
      rows={2}
      value={form.loteriaNota}
      onChange={(e) => set("loteriaNota", e.target.value)}
    />
    <div className={styles.interruptores}>
      <Toggle
        label="Sorteo do Baúl"
        active={form.loteriaBaul}
        onClick={() => set("loteriaBaul", !form.loteriaBaul)}
      />
    </div>
    {form.loteriaBaul && (
      <>
        <SubirFoto
          etiqueta="Foto del baúl"
          texto="Subir la foto del baúl"
          url={form.loteriaBaulFoto}
          onFile={(f) => handleLoteriaFile("loteriaBaulFoto", f)}
        />
        <Textarea
          label="Cómo participar"
          hint="Una línea por cosa. Si acaba en «:», sale como apartado en amarillo."
          placeholder={
            "Rifas individuais:\nÁ venda a través de tod@s @s xogadores/as do club.\nAsina o teu número:\nCadros de firmas en Cafetaría Solaina e Casa Suárez."
          }
          rows={6}
          value={form.loteriaBaulTexto}
          onChange={(e) => set("loteriaBaulTexto", e.target.value)}
        />
      </>
    )}
  </>
);
