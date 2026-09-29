"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Cartel } from "@/components/cartel2/Cartel";
import { Button } from "@/components/ui/foundation/Button";
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
import type { CartelTeam } from "./useCartelForm";

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
  equipos,
  showToast,
}: {
  tipo: TemplateId;
  form: FormState;
  recursos: AssetUrls;
  /** Equipos de las tres categorías: de aquí salen el escudo del Santiso y los marcados en 3D. */
  equipos: CartelTeam[];
  showToast: (msg: string, type?: "success" | "error") => void;
}) {
  const [composicion, setComposicion] = useState<Composicion>("diagonal");
  const [colores, setColores] = useState<Record<string, string>>({});
  const [foto, setFoto] = useState<string | null>(null);
  const [hueco, setHueco] = useState({ ancho: 0, alto: 0 });
  const [exportando, setExportando] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  const [altoPanel, setAltoPanel] = useState<number | null>(null);

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

  // El panel llega hasta el borde de abajo de la ventana desde donde empieza, para que el cartel
  // se vea entero nada más abrir la pantalla (y siga a la vista al desplazarse: es «sticky»).
  useEffect(() => {
    const nodo = panel.current;
    if (!nodo) return;
    const medir = () => {
      const arriba = nodo.getBoundingClientRect().top + window.scrollY;
      setAltoPanel(
        Math.max(420, window.innerHeight - Math.min(arriba, window.innerHeight / 2) - 16),
      );
    };
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);

  // La vista previa se ajusta al hueco (alto de la ventana y ancho de la columna): el cartel
  // se ve entero sin desplazarse.
  useEffect(() => {
    const nodo = caja.current;
    if (!nodo) return;
    const observador = new ResizeObserver(([entrada]) => {
      if (entrada) {
        setHueco({ ancho: entrada.contentRect.width, alto: entrada.contentRect.height });
      }
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
          escudosClub: Object.fromEntries(
            equipos
              .filter((e) => e.es_propio && e.escudo_url)
              .map((e) => [e.categoria, e.escudo_url]),
          ),
          escudosEn3d: equipos.filter((e) => e.escudo_3d && e.escudo_url).map((e) => e.escudo_url),
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
    [tipo, form, recursos, equipos, colores, composicion, foto],
  );
  const escala =
    hueco.ancho && hueco.alto
      ? Math.min(hueco.ancho / MEDIDAS.ancho, hueco.alto / MEDIDAS.alto)
      : 0;
  const margenIzquierdo = (hueco.ancho - MEDIDAS.ancho * escala) / 2;

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
    <section
      ref={panel}
      className={styles.piloto}
      aria-label="Previsualización del cartel"
      style={altoPanel ? { height: altoPanel } : undefined}
    >
      {/* Una sola fila: título, opciones de la plantilla y descarga. Deja el alto al cartel. */}
      <div className={styles.cabecera}>
        <h3>Previsualización</h3>
        <div className={styles.controles}>
          {tipo === "partido" && (
            <div className={styles.grupo} role="group" aria-label="Composición">
              {COMPOSICIONES.map((c) => (
                <Button
                  key={c.id}
                  size="sm"
                  variant={composicion === c.id ? "primary" : "secondary"}
                  aria-pressed={composicion === c.id}
                  onClick={() => setComposicion(c.id)}
                >
                  {c.nombre}
                </Button>
              ))}
            </div>
          )}
          {tipo === "resumo" && (
            <>
              <label className={styles.botonFoto}>
                {foto ? "Cambiar foto" : "Foto de fondo"}
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
            </>
          )}
          <Button size="sm" onClick={() => void descargar()} disabled={exportando}>
            {exportando ? "Generando…" : "Descargar PNG"}
          </Button>
        </div>
      </div>
      <div ref={caja} className={styles.vista}>
        {escala > 0 && (
          <div
            className={styles.escalado}
            style={{ left: margenIzquierdo, transform: `scale(${escala})` }}
            data-vista-cartel
          >
            <Cartel peticion={peticion} />
          </div>
        )}
      </div>
    </section>
  );
}
