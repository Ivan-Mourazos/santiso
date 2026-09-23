"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/foundation/Button";
import { prepararImagen } from "@/lib/imagen-cliente";
import { guardarLogoAjuste } from "@/lib/server/acciones/ajustes-cartel";
import styles from "./Ajustes.module.css";

interface Props {
  /** Clave del ajuste donde queda apuntada la imagen (`club.escudo`, `cartel.logo_xunta`…). */
  clave: string;
  titulo: string;
  /** Dónde sale esta imagen hoy, dicho en claro. */
  descripcion: string;
  actual: string | null;
  onGuardada: (url: string) => void;
  onError: (mensaje: string) => void;
}

/**
 * Una imagen apuntada desde un ajuste. Elegir no guarda: se ve la vista previa y se confirma o
 * se cancela. Así un clic en falso no cambia el escudo de todos los carteles.
 */
export default function ImagenAjuste({
  clave,
  titulo,
  descripcion,
  actual,
  onGuardada,
  onError,
}: Props) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [pendiente, setPendiente] = useState(false);
  const guardando = useRef(false);
  const entrada = useRef<HTMLInputElement>(null);
  const imagen = useRef<HTMLImageElement>(null);
  const id = useId();
  const vistaPrevia = archivo !== null;

  // La vista previa se escribe directamente en la imagen, como en `FotoFormulario`: así la URL
  // de objeto se libera al cambiar de archivo o al salir, sin pasar por el estado.
  useEffect(() => {
    if (!imagen.current) return;
    if (!archivo) {
      if (actual) imagen.current.src = actual;
      return;
    }
    const url = URL.createObjectURL(archivo);
    imagen.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [archivo, actual]);

  function descartar() {
    setArchivo(null);
    if (entrada.current) entrada.current.value = "";
  }

  async function guardar() {
    if (!archivo || guardando.current) return;
    guardando.current = true;
    setPendiente(true);
    try {
      const cuerpo = new FormData();
      cuerpo.set("imagen", await prepararImagen(archivo));
      const resultado = await guardarLogoAjuste(clave, cuerpo);
      if (!resultado.ok) {
        onError(resultado.error);
        return;
      }
      descartar();
      onGuardada(resultado.datos);
    } catch (error) {
      console.error(error);
      onError(`No se pudo guardar «${titulo}». La imagen anterior sigue puesta.`);
    } finally {
      guardando.current = false;
      setPendiente(false);
    }
  }

  const hayImagen = vistaPrevia || Boolean(actual);

  return (
    <section className={styles.imagen} aria-labelledby={`${id}-titulo`}>
      <div className={styles.miniatura}>
        {hayImagen ? (
          // eslint-disable-next-line @next/next/no-img-element -- media local o vista previa en memoria
          <img
            ref={imagen}
            src={actual ?? undefined}
            alt={vistaPrevia ? `Vista previa de ${titulo}` : titulo}
          />
        ) : (
          <span>Sin imagen</span>
        )}
      </div>
      <div className={styles.imagenTexto}>
        <h4 id={`${id}-titulo`}>{titulo}</h4>
        <p>{descripcion}</p>
        {vistaPrevia ? (
          <div className={styles.acciones}>
            <p role="status" className={styles.previa}>
              Vista previa: todavía no se ha guardado.
            </p>
            <Button onClick={() => void guardar()} pending={pendiente}>
              Guardar
            </Button>
            <Button variant="secondary" onClick={descartar} disabled={pendiente}>
              Cancelar
            </Button>
          </div>
        ) : (
          <label className="file-input-label">
            {actual ? "Cambiar imagen" : "Subir imagen"}
            <input
              ref={entrada}
              type="file"
              className="hidden-input"
              accept="image/*"
              aria-label={`${actual ? "Cambiar" : "Subir"} ${titulo}`}
              onChange={(e) => {
                const elegido = e.target.files?.[0];
                if (elegido) setArchivo(elegido);
              }}
            />
          </label>
        )}
      </div>
    </section>
  );
}
