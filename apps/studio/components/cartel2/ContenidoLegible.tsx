"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { erroresDeLectura } from "@/lib/cartel2/lectura";
import s from "./ContenidoLegible.module.css";

/**
 * El PNG lo pinta un Chromium y allí se decide si el contenido cabe. En el navegador solo se
 * adelanta ese aviso cuando el motor es el mismo: Safari (y todo navegador de iPhone) mide el
 * texto distinto y avisaba de carteles que sí cabían. Allí manda la respuesta del servidor.
 */
function mideComoElExportador() {
  return /Chrome\//u.test(navigator.userAgent);
}

/** Conserva todos los datos; una pieza desbordada muestra aviso y no se puede exportar. */
export function ContenidoLegible({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [noCabe, setNoCabe] = useState(false);
  useEffect(() => {
    let vigente = true;
    const comprobar = async () => {
      if (!mideComoElExportador()) return;
      await document.fonts.ready;
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      const cartel = ref.current?.closest("[data-cartel]");
      if (vigente && cartel) setNoCabe(erroresDeLectura(cartel).length > 0);
    };
    void comprobar();
    return () => {
      vigente = false;
    };
  }, [children]);
  return (
    <div
      ref={ref}
      className={noCabe ? s.noCabe : s.contenido}
      data-lectura-error={noCabe || undefined}
    >
      {children}
      {noCabe && (
        <aside className={s.aviso} data-cartel-aviso role="alert">
          <strong>O CONTIDO NON CABE</strong>
          <p>Reduce datos ou prepara dúas láminas. Non se exportará un cartel recortado.</p>
        </aside>
      )}
    </div>
  );
}
