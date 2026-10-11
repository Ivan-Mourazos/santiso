"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/foundation/Button";
import type { FormatoCartel } from "@/lib/cartel2/modelo";
import { paqueteAxenda } from "@/lib/cartel2/axenda";
import { peticionDeFormulario } from "@/lib/cartel2/formulario";
import { recursosDeCartel } from "@/lib/cartel2/recursos";
import { elegirAxenda } from "@/lib/cartel2/seleccion-axenda";
import { cargarPreviasCartel } from "@/lib/server/acciones/previa-cartel";
import type { NextMatch } from "@/lib/cartel/types";
import type { SelectorMatch } from "./Common";
import type { CartelTeam } from "./useCartelForm";
import type { FormState, AssetUrls } from "./types";
import { colorDeEscudo, exportable } from "./PilotoCartel";
import s from "./PaqueteAxenda.module.css";

export function PaqueteAxenda({
  form,
  formato,
  recursos,
  equipos,
  dbMatches,
  setMatches,
  texto,
  showToast,
}: {
  form: FormState;
  formato: FormatoCartel;
  recursos: AssetUrls;
  equipos: CartelTeam[];
  dbMatches: SelectorMatch[];
  setMatches: (matches: NextMatch[]) => void;
  texto: string;
  showToast: (m: string, t?: "success" | "error") => void;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [paquete, setPaquete] = useState<{ clave: string; archivos: File[] } | null>(null);
  const [compartiendo, setCompartiendo] = useState(false);
  const bloqueo = useRef(false);
  const generacion = useRef(0);
  useEffect(
    () => () => {
      generacion.current++;
    },
    [],
  );
  const logos = recursosDeCartel(equipos, recursos);
  const clave = JSON.stringify([form.matches, formato, logos]);
  const listo = paquete?.clave === clave ? paquete.archivos : null;

  async function preparar() {
    if (bloqueo.current) return;
    const matches = form.matches.some((m) => m.rival.trim())
      ? form.matches
      : elegirAxenda(dbMatches, new Date());
    if (!matches.some((m) => m.rival.trim())) {
      showToast(
        "No hay partidos para preparar. Rellena un rival o elige los próximos encuentros.",
        "error",
      );
      return;
    }
    bloqueo.current = true;
    setOcupado(true);
    const turno = ++generacion.current;
    const claveNueva = JSON.stringify([matches, formato, logos]);
    setMatches(matches);
    try {
      const ids = matches.filter((m) => m.rival.trim() && m.partidoId).map((m) => m.partidoId!);
      const lectura = ids.length
        ? await cargarPreviasCartel(ids)
        : { ok: true as const, datos: {} };
      if (!lectura.ok) throw new Error(lectura.error);
      const urls = [...new Set(matches.map((m) => m.rivalEscudoUrl).filter(Boolean))];
      const colores = Object.fromEntries(
        await Promise.all(urls.map(async (u) => [u, await colorDeEscudo(u)])),
      );
      const portada = peticionDeFormulario("proximos", { ...form, matches }, logos, {
        composicion: "diagonal",
        foto: null,
        formato,
        previas: lectura.datos,
        color: (u) => (u && colores[u]) || "#64748b",
      });
      if (portada.plantilla !== "proximos") return;
      const archivos: File[] = [];
      for (const lamina of paqueteAxenda(portada)) {
        const respuesta = await fetch("/api/carteles/png", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(await exportable(lamina.peticion)),
        });
        if (!respuesta.ok) throw new Error("No se pudo generar el carrusel. Vuelve a prepararlo.");
        archivos.push(new File([await respuesta.blob()], lamina.nombre, { type: "image/png" }));
      }
      if (turno === generacion.current) {
        setPaquete({ clave: claveNueva, archivos });
        showToast("Carrusel listo para descargar o compartir.");
      }
    } catch (e) {
      if (turno === generacion.current)
        showToast(e instanceof Error ? e.message : "No se pudo preparar el carrusel.", "error");
    } finally {
      bloqueo.current = false;
      if (turno === generacion.current) setOcupado(false);
    }
  }
  function descargar(archivos: File[]) {
    for (const archivo of archivos) {
      const url = URL.createObjectURL(archivo);
      const a = document.createElement("a");
      a.href = url;
      a.download = archivo.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }
  async function compartir() {
    if (!listo || bloqueo.current) return;
    bloqueo.current = true;
    setCompartiendo(true);
    try {
      if (navigator.share && navigator.canShare?.({ files: listo }))
        await navigator.share({ files: listo, title: "Axenda UD Santiso", text: texto });
      else descargar(listo);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) descargar(listo);
    } finally {
      bloqueo.current = false;
      setCompartiendo(false);
    }
  }
  return (
    <section className={s.paquete} aria-label="Carrusel Axenda">
      <h4>Axenda en carrusel</h4>
      <p>
        Portada y una lámina por partido. Si aún no rellenaste rivales, prepara los partidos de esta
        jornada.
      </p>
      <div className={s.acciones}>
        <Button onClick={() => void preparar()} disabled={ocupado || compartiendo}>
          {ocupado ? "Preparando carrusel…" : "Preparar carrusel Axenda"}
        </Button>
        {listo && (
          <>
            <Button onClick={() => void compartir()} disabled={compartiendo}>
              {compartiendo ? "Compartiendo…" : "Compartir carrusel"}
            </Button>
            <Button variant="secondary" onClick={() => descargar(listo)} disabled={compartiendo}>
              Descargar carrusel
            </Button>
          </>
        )}
      </div>
      {listo && (
        <>
          <p>{listo.length} imágenes listas. También puedes descargarlas por separado.</p>
          <div className={s.archivos}>
            {listo.map((f) => (
              <Button key={f.name} variant="secondary" onClick={() => descargar([f])}>
                {f.name}
              </Button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
