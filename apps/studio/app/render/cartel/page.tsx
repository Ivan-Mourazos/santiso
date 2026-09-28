"use client";

import { useEffect, useState } from "react";
import { CartelPartido } from "@/components/cartel2/CartelPartido";
import type { PeticionCartel } from "@/lib/cartel2/modelo";

declare global {
  interface Window {
    /** Lo llama la exportación a PNG (Chromium local) para pintar un cartel. */
    __pintarCartel?: (peticion: PeticionCartel) => void;
  }
}

/**
 * Página que solo pinta un cartel, para fotografiarlo. No es una pantalla del panel: la abre
 * `renderizarCartel` en un Chromium local, le pasa los datos y espera a `data-listo`, que se
 * pone cuando las fuentes y todas las imágenes han cargado.
 */
export default function PaginaRenderCartel() {
  const [peticion, setPeticion] = useState<PeticionCartel | null>(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    window.__pintarCartel = (nueva) => {
      setListo(false);
      setPeticion(nueva);
    };
    return () => {
      delete window.__pintarCartel;
    };
  }, []);

  useEffect(() => {
    if (!peticion) return;
    let vigente = true;
    void (async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((img) => img.decode().catch(() => undefined)));
      if (vigente) setListo(true);
    })();
    return () => {
      vigente = false;
    };
  }, [peticion]);

  if (!peticion) return null;
  return (
    <div data-listo={listo ? "" : undefined} style={{ display: "inline-block" }}>
      {/* El botón de las herramientas de Next (solo en desarrollo) no debe salir en la foto. */}
      <style>{"nextjs-portal{display:none!important}"}</style>
      <CartelPartido datos={peticion.datos} composicion={peticion.composicion} />
    </div>
  );
}
