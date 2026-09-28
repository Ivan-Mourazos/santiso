"use client";

import { useEffect, useRef, useState } from "react";
import { CartelPartido } from "@/components/cartel2/CartelPartido";
import { Button } from "@/components/ui/foundation/Button";
import { Select } from "@/components/ui/foundation/Fields";
import { getSantisoName } from "@/lib/cartel/shared";
import { AMARILLO_SANTISO, aHex, COLOR_RIVAL_RESERVA, colorDominante } from "@/lib/cartel2/color";
import {
  COMPOSICIONES,
  datosDeFormulario,
  MEDIDAS,
  type Composicion,
  type PeticionCartel,
} from "@/lib/cartel2/modelo";
import styles from "./PilotoPartido.module.css";
import type { AssetUrls, FormState } from "./types";

/** Color dominante de un escudo, leído en un lienzo pequeño; `null` si no se puede. */
async function colorDeEscudo(url: string): Promise<string | null> {
  if (!url) return null;
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch {
    return null;
  }
  const lado = 64;
  const lienzo = document.createElement("canvas");
  lienzo.width = lado;
  lienzo.height = lado;
  const ctx = lienzo.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, lado, lado);
  const color = colorDominante(ctx.getImageData(0, 0, lado, lado).data);
  return color ? aHex(color) : null;
}

/** Un escudo subido a mano es un `blob:` que el Chromium de la exportación no puede abrir. */
async function aUrlExportable(url: string | null): Promise<string | null> {
  if (!url?.startsWith("blob:")) return url;
  const blob = await (await fetch(url)).blob();
  return await new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result));
    lector.onerror = () => reject(lector.error);
    lector.readAsDataURL(blob);
  });
}

/**
 * Piloto del motor nuevo de carteles (HTML/CSS → PNG con Chromium local) para «Cartel de
 * partido». Usa el mismo formulario que el cartel actual; la vista previa es el propio cartel
 * escalado, y el PNG lo genera `/api/carteles/png` con los mismos datos.
 */
export default function PilotoPartido({
  form,
  recursos,
  showToast,
}: {
  form: FormState;
  recursos: AssetUrls;
  showToast: (msg: string, type?: "success" | "error") => void;
}) {
  const [composicion, setComposicion] = useState<Composicion>("diagonal");
  const [colorRival, setColorRival] = useState<string | null>(null);
  const [ancho, setAncho] = useState(0);
  const [exportando, setExportando] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  // Color del rival: se lee de su escudo cada vez que cambia.
  useEffect(() => {
    let vigente = true;
    void colorDeEscudo(form.rivalEscudoUrl).then((c) => {
      if (vigente) setColorRival(c);
    });
    return () => {
      vigente = false;
    };
  }, [form.rivalEscudoUrl]);

  // La vista previa se escala al ancho disponible.
  useEffect(() => {
    const nodo = caja.current;
    if (!nodo) return;
    const observador = new ResizeObserver(([entrada]) => {
      if (entrada) setAncho(entrada.contentRect.width);
    });
    observador.observe(nodo);
    return () => observador.disconnect();
  }, []);

  const escala = ancho ? ancho / MEDIDAS.ancho : 0;
  const datos = datosDeFormulario(
    form,
    {
      escudoClub: recursos.santiso,
      nombreClub: getSantisoName(form.categoria),
      patrocinadores: recursos.sponsors,
      institucionales: (recursos.xuntaIsLeft
        ? [recursos.xunta, recursos.rfgf]
        : [recursos.rfgf, recursos.xunta]
      ).filter(Boolean),
    },
    // El club juega de amarillo y negro; el cartel pinta su lado en negro con luz amarilla.
    { club: aHex(AMARILLO_SANTISO), rival: colorRival ?? aHex(COLOR_RIVAL_RESERVA) },
  );

  async function descargar() {
    setExportando(true);
    try {
      const peticion: PeticionCartel = {
        plantilla: "partido",
        composicion,
        datos: {
          ...datos,
          local: { ...datos.local, escudo: await aUrlExportable(datos.local.escudo) },
          visitante: { ...datos.visitante, escudo: await aUrlExportable(datos.visitante.escudo) },
        },
      };
      const respuesta = await fetch("/api/carteles/png", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(peticion),
      });
      if (!respuesta.ok) throw new Error(String(respuesta.status));
      const url = URL.createObjectURL(await respuesta.blob());
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = `partido-${form.fecha || "sin-fecha"}-${composicion}.png`;
      enlace.click();
      URL.revokeObjectURL(url);
      showToast("Cartel descargado");
    } catch {
      showToast("No se pudo generar el PNG. Vuelve a intentarlo.", "error");
    } finally {
      setExportando(false);
    }
  }

  return (
    <section className={styles.piloto} aria-label="Cartel nuevo (piloto)">
      <div className={styles.cabecera}>
        <div>
          <h3>Cartel nuevo · piloto</h3>
          <p>Mismos datos del formulario. Elige la composición.</p>
        </div>
        <Button onClick={() => void descargar()} disabled={exportando}>
          {exportando ? "Generando…" : "Descargar PNG"}
        </Button>
      </div>
      <div className={styles.opciones}>
        <Select
          label="Composición"
          value={composicion}
          onChange={(e) => setComposicion(e.target.value as Composicion)}
        >
          {COMPOSICIONES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </Select>
      </div>
      <div
        ref={caja}
        className={styles.vista}
        style={{ height: escala ? MEDIDAS.alto * escala : undefined }}
      >
        {escala > 0 && (
          <div
            className={styles.escalado}
            style={{ transform: `scale(${escala})` }}
            data-vista-cartel
          >
            <CartelPartido datos={datos} composicion={composicion} />
          </div>
        )}
      </div>
    </section>
  );
}
