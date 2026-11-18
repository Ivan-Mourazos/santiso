"use client";
/* eslint-disable @next/next/no-img-element -- PNG guardado en /media, sin optimizador */
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/foundation/Button";
import { Dialog } from "@/components/ui/foundation/Dialog";
import { archivosActuales, estadoCarrusel } from "@/lib/cartel2/despues";
import type { PeticionCartel } from "@/lib/cartel2/modelo";
import { estadoPaso, PASOS, PASOS_DESPUES, type CartelGuardado } from "@/lib/cartel2/pasos";
import { compartirArchivos, descargarArchivos } from "./compartirArchivos";
import s from "./CartelesDelPaso.module.css";

type PasoDespues = (typeof PASOS_DESPUES)[number];
export type GuardadosDespues = Record<PasoDespues, CartelGuardado[]>;

/** Nombre de cada imagen del carrusel, en su orden. */
const FICHERO: Record<PasoDespues, string> = {
  resultado: "1-resultado.png",
  noso11: "2-o-noso-11.png",
};

/**
 * Lo de después del partido, que se publica junto: el Resultado y O Noso 11 en un carrusel.
 * «Generar» hace y guarda los dos; «Compartir» los entrega a la vez, en orden, con
 * el texto de Instagram. Si cambian los datos, se avisa y se ofrece actualizarlos.
 */
export function PaqueteDespues({
  partidoId,
  guardados: iniciales,
  preparar,
  firma,
  antesDeGuardar,
  texto,
  motivo,
  showToast,
  onCambio,
}: {
  partidoId: string;
  guardados: GuardadosDespues;
  /** Las peticiones de las dos imágenes, o `null` si aún no se puede. */
  preparar: () => Promise<Record<PasoDespues, PeticionCartel> | null>;
  /** Lo que hay que guardar antes (la colocación de O Noso 11); `false` si falló. */
  antesDeGuardar?: () => Promise<boolean>;
  firma: string;
  texto: string;
  motivo?: string | null;
  showToast: (msg: string, type?: "success" | "error") => void;
  onCambio?: (guardados: GuardadosDespues) => void;
}) {
  const [guardados, setGuardados] = useState(iniciales);
  const [generando, setGenerando] = useState(false);
  const [compartiendo, setCompartiendo] = useState(false);
  const [viendo, setViendo] = useState<{ paso: PasoDespues; url: string } | null>(null);
  // Los PNG ya bajados: compartir en iOS solo funciona justo tras el toque, sin esperar a la red.
  const [descargados, setDescargados] = useState<{ clave: string; archivos: File[] } | null>(null);
  const [firmaGenerada, setFirmaGenerada] = useState(firma);
  const bloqueo = useRef(false);

  const estados = PASOS_DESPUES.map((p) => estadoPaso(guardados[p]));
  const estado = estadoCarrusel(estados, firma, firmaGenerada);
  const urls = PASOS_DESPUES.map((p) => guardados[p][0]?.url ?? null);
  const claveUrls = urls.join("|");
  const ficheros = archivosActuales(descargados, claveUrls);

  useEffect(() => {
    if (estado === "pendiente") return;
    let vigente = true;
    void Promise.all(
      PASOS_DESPUES.map(async (paso) => {
        const url = guardados[paso][0]!.url;
        const respuesta = await fetch(url, { cache: "no-store" });
        if (!respuesta.ok) throw new Error(String(respuesta.status));
        return new File([await respuesta.blob()], FICHERO[paso], { type: "image/png" });
      }),
    )
      .then((lista) => {
        if (vigente) setDescargados({ clave: claveUrls, archivos: lista });
      })
      .catch(() => {
        if (vigente) setDescargados(null);
      });
    return () => {
      vigente = false;
    };
    // `claveUrls` resume `guardados`: solo se vuelven a bajar si cambian los PNG.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveUrls, estado]);

  async function generar() {
    if (bloqueo.current) return;
    bloqueo.current = true;
    setGenerando(true);
    const firmaEnviada = firma;
    try {
      const peticiones = await preparar();
      if (!peticiones) return;
      if (antesDeGuardar && !(await antesDeGuardar())) return;
      const nuevos = { ...guardados };
      for (const paso of PASOS_DESPUES) {
        const respuesta = await fetch("/api/carteles/guardar", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ partidoId, paso, peticiones: [peticiones[paso]] }),
        });
        if (!respuesta.ok) {
          const aviso = (await respuesta.json().catch(() => null)) as { error?: string } | null;
          showToast(
            `${PASOS[paso].nombre}: ${aviso?.error ?? "no se pudo generar. Vuelve a intentarlo."}`,
            "error",
          );
          return;
        }
        nuevos[paso] = (await respuesta.json()) as CartelGuardado[];
        setGuardados({ ...nuevos });
      }
      setFirmaGenerada(firmaEnviada);
      onCambio?.(nuevos);
      showToast(estado === "pendiente" ? "Carrusel generado y guardado" : "Carrusel actualizado");
    } catch {
      showToast("No se pudo generar el carrusel. Vuelve a intentarlo.", "error");
    } finally {
      bloqueo.current = false;
      setGenerando(false);
    }
  }

  async function compartir() {
    if (!ficheros || bloqueo.current) return;
    bloqueo.current = true;
    setCompartiendo(true);
    try {
      await compartirArchivos(ficheros, "UD Santiso", texto);
    } finally {
      bloqueo.current = false;
      setCompartiendo(false);
    }
  }

  return (
    <section className={s.panel} aria-label="Después del partido: carrusel" data-estado={estado}>
      <p className={s.estado} role="status">
        {estado === "pendiente" && "Todavía sin generar."}
        {estado === "hecho" && "✓ Carrusel generado: Resultado y O Noso 11."}
        {estado === "desactualizado" &&
          "⚠ Han cambiado los datos desde que se generó. Sigue guardado el anterior hasta que lo actualices."}
      </p>
      {estado !== "pendiente" && (
        <ul className={s.formatos} aria-label="Imágenes del carrusel">
          {PASOS_DESPUES.map((paso, i) => (
            <li key={paso} className={s.formatoFila}>
              <span>
                {i + 1}. {PASOS[paso].nombre}
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setViendo({ paso, url: urls[i]! })}
                aria-label={`Ver en grande: ${PASOS[paso].nombre}`}
              >
                Ver
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => ficheros?.[i] && descargarArchivos([ficheros[i]])}
                disabled={!ficheros || generando}
                aria-label={`Descargar: ${PASOS[paso].nombre}`}
              >
                Descargar
              </Button>
            </li>
          ))}
        </ul>
      )}
      {motivo && <p className={s.motivo}>{motivo}</p>}
      <div className={s.acciones}>
        <Button
          variant={estado === "hecho" ? "secondary" : "primary"}
          onClick={() => void generar()}
          disabled={generando || compartiendo || Boolean(motivo)}
        >
          {generando
            ? "Generando…"
            : estado === "pendiente"
              ? "Generar carrusel"
              : "Actualizar carrusel"}
        </Button>
        {estado !== "pendiente" && (
          <>
            <Button
              onClick={() => void compartir()}
              disabled={!ficheros || compartiendo || generando}
            >
              {compartiendo ? "Abriendo…" : "Compartir"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => ficheros && descargarArchivos(ficheros)}
              disabled={!ficheros || generando}
            >
              Descargar los 2
            </Button>
          </>
        )}
      </div>
      <Dialog
        open={viendo !== null}
        onClose={() => setViendo(null)}
        title={viendo ? PASOS[viendo.paso].nombre : ""}
      >
        {viendo && (
          <img
            className={s.grande}
            src={viendo.url}
            alt={`${PASOS[viendo.paso].nombre} · Publicación`}
          />
        )}
      </Dialog>
    </section>
  );
}
