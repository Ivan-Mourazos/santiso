"use client";

import { useState } from "react";
import { Button } from "@/components/ui/foundation/Button";
import type { PatrocinadorDto } from "@/lib/dto";
import {
  activadosSinLogo,
  LOGOS_EN_CARTEL,
  logosExcedentes,
  logosVisibles,
} from "@/lib/patrocinadores/modelo";
import { moverPatrocinador } from "@/lib/server/acciones/patrocinadores";
import styles from "./Patrocinadores.module.css";

interface Props {
  /** El catálogo completo; aquí se usa solo la parte activada, sin el filtro de la pantalla. */
  catalogo: PatrocinadorDto[];
  onCambiado: () => void;
  onError: (mensaje: string) => void;
}

/**
 * Qué se va a ver en la barra del cartel y en qué orden. La barra tiene cinco huecos
 * (`lib/cartel/shared.ts`): lo que pase de ahí se avisa en vez de desaparecer en silencio.
 */
export default function OrdenLogos({ catalogo, onCambiado, onError }: Props) {
  const [moviendo, setMoviendo] = useState(false);
  const enBarra = catalogo.filter((p) => p.en_carteles);
  const visibles = logosVisibles(catalogo);
  const excedentes = logosExcedentes(catalogo);
  const sinLogo = activadosSinLogo(catalogo);

  async function mover(id: string, direccion: -1 | 1) {
    if (moviendo) return;
    setMoviendo(true);
    try {
      const resultado = await moverPatrocinador(id, direccion);
      if (!resultado.ok) {
        onError(resultado.error);
        return;
      }
      onCambiado();
    } catch (error) {
      console.error(error);
      onError("No se pudo cambiar el orden. Comprueba la conexión.");
    } finally {
      setMoviendo(false);
    }
  }

  if (enBarra.length === 0) {
    return (
      <section className={styles.orden}>
        <h4>Barra del cartel</h4>
        <p className={styles.alcance}>
          Ningún logo activado. Marca «Mostrar en carteles» en la ficha de los que quieras.
        </p>
      </section>
    );
  }

  const conLogo = [...visibles, ...excedentes];

  return (
    <section className={styles.orden}>
      <h4>Barra del cartel</h4>
      <p className={styles.alcance}>
        Caben {LOGOS_EN_CARTEL} logos. Se pintan en este orden, de izquierda a derecha.
      </p>

      <ul className={styles.posiciones} aria-label="Orden de los logos">
        {conLogo.map((logo, indice) => {
          const sobra = indice >= LOGOS_EN_CARTEL;
          return (
            <li
              key={logo.id}
              className={`${styles.posicion} ${sobra ? styles.excedente : ""}`}
            >
              <span className={styles.hueco} aria-hidden="true">
                {sobra ? "—" : indice + 1}
              </span>
              {logo.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- media local servida por el route handler
                <img className={styles.logo} src={logo.logo_url} alt="" />
              ) : (
                <span className={styles.logo} aria-hidden="true" />
              )}
              <span>
                {logo.nombre}
                {sobra && " · no cabe en el cartel"}
              </span>
              <span className={styles.flechas}>
                <Button
                  variant="secondary"
                  disabled={moviendo || indice === 0}
                  aria-label={`Subir ${logo.nombre}`}
                  onClick={() => void mover(logo.id, -1)}
                >
                  ↑
                </Button>
                <Button
                  variant="secondary"
                  disabled={moviendo || indice === conLogo.length - 1}
                  aria-label={`Bajar ${logo.nombre}`}
                  onClick={() => void mover(logo.id, 1)}
                >
                  ↓
                </Button>
              </span>
            </li>
          );
        })}
      </ul>

      {excedentes.length > 0 && (
        <p role="status" className={styles.aviso} style={{ marginTop: "0.75rem" }}>
          {excedentes.length === 1
            ? "Hay 1 logo de más: no aparecerá en el cartel."
            : `Hay ${excedentes.length} logos de más: no aparecerán en el cartel.`}{" "}
          Súbelos de posición o desactívalos.
        </p>
      )}
      {sinLogo.length > 0 && (
        <p role="status" className={styles.aviso} style={{ marginTop: "0.75rem" }}>
          Sin imagen y por tanto fuera del cartel: {sinLogo.map((p) => p.nombre).join(", ")}.
        </p>
      )}
    </section>
  );
}
