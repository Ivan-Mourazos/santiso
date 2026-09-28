"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Cartel } from "@/components/cartel2/Cartel";
import { Button } from "@/components/ui/foundation/Button";
import { Select } from "@/components/ui/foundation/Fields";
import { aHex, COLOR_RIVAL_RESERVA, colorDominante } from "@/lib/cartel2/color";
import { peticionDeFormulario } from "@/lib/cartel2/formulario";
import {
  COMPOSICIONES,
  MEDIDAS,
  type Composicion,
  type PeticionCartel,
} from "@/lib/cartel2/modelo";
import styles from "./PilotoCartel.module.css";
import type { AssetUrls, FormState, TemplateId } from "./types";

/** Color dominante de un escudo, leído en un lienzo pequeño; `null` si no se puede. */
async function colorDeEscudo(url: string): Promise<string | null> {
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

/** Una imagen subida a mano (`blob:`) pasa a `data:`, que el Chromium de la exportación sí abre. */
async function aDataUrl(url: string): Promise<string> {
  const blob = await (await fetch(url)).blob();
  return await new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result));
    lector.onerror = () => reject(lector.error);
    lector.readAsDataURL(blob);
  });
}

async function exportable<T>(valor: T): Promise<T> {
  if (typeof valor === "string")
    return (valor.startsWith("blob:") ? await aDataUrl(valor) : valor) as T;
  if (Array.isArray(valor)) return (await Promise.all(valor.map((v) => exportable(v)))) as T;
  if (valor && typeof valor === "object") {
    const salida: Record<string, unknown> = {};
    for (const [clave, v] of Object.entries(valor)) salida[clave] = await exportable(v);
    return salida as T;
  }
  return valor;
}

/** Escudos del formulario cuyo color hace falta: el rival y los de «Próximos». */
function escudosDelFormulario(form: FormState) {
  return [form.rivalEscudoUrl, ...form.matches.map((m) => m.rivalEscudoUrl)].filter(Boolean);
}

/**
 * Cartel del motor nuevo (HTML/CSS → PNG con Chromium local) para cualquier plantilla. Usa el
 * mismo formulario que el cartel actual; la vista previa es el propio cartel escalado y el PNG
 * lo genera `/api/carteles/png` con los mismos datos.
 */
export default function PilotoCartel({
  tipo,
  form,
  recursos,
  showToast,
}: {
  tipo: TemplateId;
  form: FormState;
  recursos: AssetUrls;
  showToast: (msg: string, type?: "success" | "error") => void;
}) {
  const [composicion, setComposicion] = useState<Composicion>("diagonal");
  const [colores, setColores] = useState<Record<string, string>>({});
  const [foto, setFoto] = useState<string | null>(null);
  const [ancho, setAncho] = useState(0);
  const [exportando, setExportando] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  // Colores de los escudos del formulario, leídos una vez por URL.
  const pendientes = escudosDelFormulario(form).filter((u) => !(u in colores));
  const clavePendientes = pendientes.join("|");
  useEffect(() => {
    if (!clavePendientes) return;
    let vigente = true;
    void Promise.all(
      clavePendientes.split("|").map(async (u) => [u, await colorDeEscudo(u)] as const),
    ).then((leidos) => {
      if (!vigente) return;
      setColores((antes) => {
        const despues = { ...antes };
        for (const [u, c] of leidos) despues[u] = c ?? aHex(COLOR_RIVAL_RESERVA);
        return despues;
      });
    });
    return () => {
      vigente = false;
    };
  }, [clavePendientes]);

  // La foto de fondo se libera al cambiarla o al salir.
  useEffect(() => {
    return () => {
      if (foto) URL.revokeObjectURL(foto);
    };
  }, [foto]);

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

  const peticion: PeticionCartel = useMemo(
    () =>
      peticionDeFormulario(
        tipo,
        form,
        {
          escudoClub: recursos.santiso,
          patrocinadores: recursos.sponsors,
          institucionales: (recursos.xuntaIsLeft
            ? [recursos.xunta, recursos.rfgf]
            : [recursos.rfgf, recursos.xunta]
          ).filter(Boolean),
        },
        {
          color: (url) => (url && colores[url]) || aHex(COLOR_RIVAL_RESERVA),
          composicion,
          foto,
        },
      ),
    [tipo, form, recursos, colores, composicion, foto],
  );
  const escala = ancho ? ancho / MEDIDAS.ancho : 0;

  async function descargar() {
    setExportando(true);
    try {
      const respuesta = await fetch("/api/carteles/png", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(await exportable(peticion)),
      });
      if (!respuesta.ok) throw new Error(String(respuesta.status));
      const url = URL.createObjectURL(await respuesta.blob());
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = `${peticion.plantilla}-${form.fecha || "cartel"}.png`;
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
          <p>Mismos datos del formulario.</p>
        </div>
        <Button onClick={() => void descargar()} disabled={exportando}>
          {exportando ? "Generando…" : "Descargar PNG"}
        </Button>
      </div>
      {(tipo === "partido" || tipo === "resumo") && (
        <div className={styles.opciones}>
          {tipo === "partido" && (
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
          )}
          {tipo === "resumo" && (
            <div className={styles.foto}>
              <label>
                Foto de fondo (opcional)
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const fichero = e.target.files?.[0];
                    setFoto(fichero ? URL.createObjectURL(fichero) : null);
                  }}
                />
              </label>
              {foto && (
                <Button variant="secondary" size="sm" onClick={() => setFoto(null)}>
                  Quitar foto
                </Button>
              )}
            </div>
          )}
        </div>
      )}
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
            <Cartel peticion={peticion} />
          </div>
        )}
      </div>
    </section>
  );
}
