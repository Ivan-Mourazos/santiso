"use client";

import { useEffect, useId, useRef } from "react";
import styles from "./Plantilla.module.css";

interface Props {
  /** Foto guardada de esta temporada, si la hay. */
  actual: string | null;
  archivo: File | null;
  onCambiar: (archivo: File | null) => void;
  /** «Foto de 2026/27»: la foto es de la temporada, no de la persona. */
  etiqueta: string;
  deshabilitado?: boolean;
}

/**
 * Elegir foto dentro del editor, con vista previa. No guarda nada por sí sola: la foto viaja con
 * el resto del formulario al pulsar Guardar.
 */
export default function FotoFormulario({
  actual,
  archivo,
  onCambiar,
  etiqueta,
  deshabilitado,
}: Props) {
  const id = useId();
  const imagenRef = useRef<HTMLImageElement>(null);

  // La URL temporal se revoca al cambiar de archivo o al cerrar: si no, cada foto elegida se
  // queda ocupando memoria mientras la pestaña siga abierta.
  useEffect(() => {
    if (!imagenRef.current) return;
    if (!archivo) {
      if (actual) imagenRef.current.src = actual;
      return;
    }
    const url = URL.createObjectURL(archivo);
    imagenRef.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [archivo, actual]);

  return (
    <div className={styles.fotoEditor}>
      {archivo || actual ? (
        // eslint-disable-next-line @next/next/no-img-element -- media local o URL temporal del navegador
        <img ref={imagenRef} className={styles.fotoGrande} src={actual ?? undefined} alt="" />
      ) : (
        <span className={styles.fotoGrande} aria-hidden="true" />
      )}
      <div className={styles.fotoControles}>
        <label htmlFor={id}>{etiqueta}</label>
        <input
          id={id}
          type="file"
          accept="image/*"
          disabled={deshabilitado}
          onChange={(e) => {
            onCambiar(e.target.files?.[0] ?? null);
            // Permite volver a elegir el mismo archivo después de quitarlo.
            e.currentTarget.value = "";
          }}
        />
        {archivo && (
          <p className={styles.alcance}>
            Nueva: {archivo.name}.{" "}
            <button type="button" onClick={() => onCambiar(null)} disabled={deshabilitado}>
              Quitar
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
