"use client";

import { useEffect, useRef, useState } from "react";
import type { Seccion } from "@/lib/navigation/contexto";

/**
 * Las categorías con la convocatoria de la semana por hacer (la pestaña «Equipo» lleva directa a
 * ella). Se mira al abrir la app y al salir de Convocatoria, no en cada cambio de pantalla. Va por
 * `GET /api/avisos`, aparte de las acciones de la pantalla, para no hacerlas esperar. Si falla,
 * la pestaña abre su menú.
 */
export function useAvisos(seccion: Seccion | undefined) {
  const [porConvocar, setPorConvocar] = useState<ReadonlySet<string>>(new Set());
  const anterior = useRef<Seccion | undefined>(undefined);
  // Hasta la primera carga buena se sigue intentando en cada pantalla.
  const cargado = useRef(false);
  useEffect(() => {
    const previa = anterior.current;
    anterior.current = seccion;
    if (cargado.current && !(previa === "convocatoria" && seccion !== "convocatoria")) return;
    const control = new AbortController();
    void (async () => {
      const respuesta = await fetch("/api/avisos", { cache: "no-store", signal: control.signal });
      if (!respuesta.ok) return;
      const datos = (await respuesta.json()) as { porConvocar: string[] };
      cargado.current = true;
      setPorConvocar(new Set(datos.porConvocar));
    })().catch(() => undefined);
    return () => control.abort();
  }, [seccion]);
  return { porConvocar };
}
