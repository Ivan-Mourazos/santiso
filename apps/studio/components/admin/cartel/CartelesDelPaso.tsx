"use client";
/* eslint-disable @next/next/no-img-element -- PNG guardado en /media, sin optimizador */
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/foundation/Button";
import type { PeticionCartel } from "@/lib/cartel2/modelo";
import {
  conLogos,
  estadoPaso,
  NOMBRE_FORMATO,
  PASOS,
  type CartelGuardado,
  type LogosElegidos,
  type PasoCartel,
} from "@/lib/cartel2/pasos";
import s from "./CartelesDelPaso.module.css";

function cuando(iso: string) {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "";
  const dia = fecha.toLocaleDateString("es-ES", { day: "numeric", month: "numeric" });
  const hora = fecha.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  return `el ${dia} a las ${hora}`;
}

/**
 * Los carteles guardados de un paso del partido. «Generar» los hace todos a la vez (publicación
 * e historia si el paso tiene las dos) y quedan guardados: al volver se abren sin regenerar. Si
 * cambian los datos con los que se hicieron, se avisa y se ofrece actualizarlos; mientras tanto
 * sigue guardado el anterior.
 */
export function CartelesDelPaso({
  partidoId,
  paso,
  guardados: iniciales,
  preparar,
  motivo,
  showToast,
  onCambio,
}: {
  partidoId: string;
  paso: PasoCartel;
  guardados: CartelGuardado[];
  /** Las peticiones de cada formato del paso, en el orden de `PASOS[paso].formatos`. */
  preparar: () => Promise<PeticionCartel[] | null>;
  /** Por qué todavía no se puede generar (falta algún dato). Vacío si se puede. */
  motivo?: string | null;
  showToast: (msg: string, type?: "success" | "error") => void;
  onCambio?: (guardados: CartelGuardado[]) => void;
}) {
  const [guardados, setGuardados] = useState(iniciales);
  const [generando, setGenerando] = useState(false);
  const [logos, setLogos] = useState<LogosElegidos>({ institucionales: true, patrocinadores: true });
  // Los PNG ya descargados como fichero: compartir en iOS solo funciona justo tras el toque,
  // sin esperar a la red, así que se bajan antes.
  const [ficheros, setFicheros] = useState<Record<string, File>>({});
  const compartiendo = useRef(false);
  const estado = estadoPaso(guardados);
  const { nombre } = PASOS[paso];

  useEffect(() => {
    let vigente = true;
    void Promise.all(
      guardados.map(async (g) => {
        const respuesta = await fetch(g.url, { cache: "no-store" });
        if (!respuesta.ok) throw new Error(String(respuesta.status));
        const nombreFichero = `${paso}-${g.formato}.png`;
        return [g.url, new File([await respuesta.blob()], nombreFichero, { type: "image/png" })] as const;
      }),
    )
      .then((pares) => {
        if (vigente) setFicheros(Object.fromEntries(pares));
      })
      .catch(() => {
        // Sin fichero, «Guardar o compartir» descarga desde la URL: sigue funcionando.
      });
    return () => {
      vigente = false;
    };
  }, [guardados, paso]);

  async function generar() {
    setGenerando(true);
    try {
      const preparadas = await preparar();
      if (!preparadas) return;
      const peticiones = preparadas.map((p) => conLogos(p, logos));
      const respuesta = await fetch("/api/carteles/guardar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ partidoId, paso, peticiones }),
      });
      if (!respuesta.ok) {
        const aviso = (await respuesta.json().catch(() => null)) as { error?: string } | null;
        showToast(aviso?.error ?? "No se pudo generar el cartel. Vuelve a intentarlo.", "error");
        return;
      }
      const nuevos = (await respuesta.json()) as CartelGuardado[];
      setGuardados(nuevos);
      onCambio?.(nuevos);
      showToast(estado === "pendiente" ? "Cartel generado y guardado" : "Cartel actualizado");
    } catch {
      showToast("No se pudo generar el cartel. Vuelve a intentarlo.", "error");
    } finally {
      setGenerando(false);
    }
  }

  function descargar(g: CartelGuardado) {
    const enlace = document.createElement("a");
    const fichero = ficheros[g.url];
    const url = fichero ? URL.createObjectURL(fichero) : g.url;
    enlace.href = url;
    enlace.download = `${paso}-${g.formato}.png`;
    enlace.click();
    if (fichero) setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function compartir(g: CartelGuardado) {
    const fichero = ficheros[g.url];
    if (compartiendo.current) return;
    if (!fichero || !navigator.canShare?.({ files: [fichero] })) {
      descargar(g);
      return;
    }
    compartiendo.current = true;
    try {
      await navigator.share({ files: [fichero] });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) descargar(g);
    } finally {
      compartiendo.current = false;
    }
  }

  return (
    <section className={s.panel} aria-label={`${nombre}: carteles guardados`} data-estado={estado}>
      <p className={s.estado} role="status">
        {estado === "pendiente" && "Todavía sin generar."}
        {estado === "hecho" && `✓ Generado ${cuando(guardados[0]!.generadoEn)}.`}
        {estado === "desactualizado" &&
          "⚠ Han cambiado los datos desde que se generó. Sigue guardado el anterior hasta que lo actualices."}
      </p>
      {guardados.length > 0 && (
        <div className={s.imagenes}>
          {guardados.map((g) => (
            <figure key={g.formato} className={s.imagen} data-formato={g.formato}>
              <img src={g.url} alt={`${nombre} · ${NOMBRE_FORMATO[g.formato]}`} />
              <figcaption>{NOMBRE_FORMATO[g.formato]}</figcaption>
              <div className={s.acciones}>
                <Button onClick={() => void compartir(g)}>Guardar o compartir</Button>
                <Button variant="secondary" onClick={() => descargar(g)}>
                  Descargar
                </Button>
              </div>
            </figure>
          ))}
        </div>
      )}
      <fieldset className={s.logos}>
        <legend>Logos del cartel</legend>
        <label>
          <input
            type="checkbox"
            checked={logos.institucionales}
            onChange={(e) => setLogos({ ...logos, institucionales: e.target.checked })}
          />
          Federación y Xunta (arriba)
        </label>
        <label>
          <input
            type="checkbox"
            checked={logos.patrocinadores}
            onChange={(e) => setLogos({ ...logos, patrocinadores: e.target.checked })}
          />
          Patrocinadores (abajo)
        </label>
      </fieldset>
      {motivo && <p className={s.motivo}>{motivo}</p>}
      <Button
        className={s.generar}
        variant={estado === "hecho" ? "secondary" : "primary"}
        pending={generando}
        pendingLabel="Generando…"
        disabled={Boolean(motivo)}
        onClick={() => void generar()}
      >
        {estado === "pendiente"
          ? "Generar cartel"
          : estado === "desactualizado"
            ? "Actualizar cartel"
            : "Volver a generar"}
      </Button>
    </section>
  );
}
