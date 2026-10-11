"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import styles from "./FiltrosMovil.module.css";

const CONSULTA = "(max-width: 900px)";

function suscribir(avisar: () => void) {
  const consulta = window.matchMedia(CONSULTA);
  consulta.addEventListener("change", avisar);
  return () => consulta.removeEventListener("change", avisar);
}

/** Cierto en pantallas de móvil. En el servidor no se sabe: se pinta como escritorio. */
export function useEsMovil() {
  return useSyncExternalStore(
    suscribir,
    () => window.matchMedia(CONSULTA).matches,
    () => false,
  );
}

/**
 * En escritorio pinta los filtros tal cual. En móvil los guarda en una hoja inferior y deja
 * a la vista una sola línea con lo elegido, para que los filtros no se coman la pantalla.
 */
export function FiltrosMovil({
  resumen,
  titulo = "Filtros",
  children,
}: {
  /** Lo elegido ahora, en una línea: «2026/27 · Tercera · J1». */
  resumen: string;
  titulo?: string;
  children: ReactNode;
}) {
  const movil = useEsMovil();
  const [abierto, setAbierto] = useState(false);
  if (!movil) return <>{children}</>;
  return (
    <>
      <button
        type="button"
        className={styles.resumen}
        aria-haspopup="dialog"
        aria-label={`${titulo}: ${resumen}`}
        onClick={(evento) => {
          // Safari no enfoca los botones al tocarlos: conserva el destino de retorno.
          evento.currentTarget.focus();
          setAbierto(true);
        }}
      >
        <span>{resumen}</span>
        <svg
          aria-hidden="true"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 6h16M7 12h10M10 18h4" />
        </svg>
      </button>
      <Dialog
        open={abierto}
        onClose={() => setAbierto(false)}
        title={titulo}
        mobilePresentation="sheet"
        footer={<Button onClick={() => setAbierto(false)}>Listo</Button>}
      >
        <div className={styles.campos}>{children}</div>
      </Dialog>
    </>
  );
}
