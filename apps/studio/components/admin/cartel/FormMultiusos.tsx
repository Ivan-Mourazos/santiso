/**
 * components/admin/cartel/FormMultiusos.tsx
 * Form panel for the "Multiusos / Anuncio" template.
 */

import React from "react";
import { Field, Textarea } from "@/components/ui/foundation/Fields";
import { CategorySelector } from "./Common";
import { ImagenFormularioCartel } from "./ImagenFormularioCartel";
import styles from "./Formularios.module.css";
import { PlegableMovil } from "./PlegableMovil";
import type { FormState, MultiusosTema } from "./types";

interface Props {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  handleMultiusosFile: (num: 1 | 2, file: File | null) => void;
}

export const TEMAS: { id: MultiusosTema; label: string; icon: string }[] = [
  { id: "celebracion", label: "Celebración (títulos y ascensos)", icon: "🏆" },
  { id: "medico", label: "Parte médico", icon: "🏥" },
  { id: "fichaje", label: "Nueva incorporación", icon: "✍️" },
  { id: "despedida", label: "Agradecimiento o despedida", icon: "👋" },
  { id: "formal", label: "Aviso o comunicado", icon: "📢" },
];

export const FormMultiusos: React.FC<Props> = ({ form, set, handleMultiusosFile }) => {
  return (
    <div className={styles.formularioEditorial}>
      <CategorySelector value={form.categoria} onChange={(v: string) => set("categoria", v)} />

      <Field
        label="Título"
        placeholder="¡CAMPIÓNS DA COPA!"
        value={form.multiusosTitulo}
        onChange={(e) => set("multiusosTitulo", e.target.value)}
      />
      <Textarea
        label="Texto"
        rows={4}
        placeholder="Pasamos á seguinte fase do torneo. Parabéns a todo o equipo!"
        value={form.multiusosTexto}
        onChange={(e) => set("multiusosTexto", e.target.value)}
      />

      <PlegableMovil titulo="Imágenes">
        <div className={styles.formularioEditorial}>
          <p className={styles.ayudaImagenes}>
            Puedes añadir fotos o capturas de la clasificación y las eliminatorias.
          </p>
          <ImagenFormularioCartel
            etiqueta="Imagen principal (centro o izquierda)"
            subir="Subir Imagen 1"
            cambiar="Cambiar Imagen 1"
            url={form.multiusosImg1Url}
            onFile={(archivo) => handleMultiusosFile(1, archivo)}
            onQuitar={() => handleMultiusosFile(1, null)}
          />
          <ImagenFormularioCartel
            etiqueta="Segunda imagen (derecha)"
            subir="Subir Imagen 2"
            cambiar="Cambiar Imagen 2"
            url={form.multiusosImg2Url}
            onFile={(archivo) => handleMultiusosFile(2, archivo)}
            onQuitar={() => handleMultiusosFile(2, null)}
          />
        </div>
      </PlegableMovil>
    </div>
  );
};
