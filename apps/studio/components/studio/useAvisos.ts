"use client";

import { useEffect, useRef, useState } from "react";
import type { Seccion } from "@/lib/navigation/contexto";
import type { IdPestana } from "@/lib/navigation/menu";

/** Las pantallas donde se hace un paso del partido: al salir de ellas el aviso puede cambiar. */
const PANTALLAS_DE_PASO: ReadonlySet<Seccion> = new Set<Seccion>([
  "carteles",
  "convocatoria",
  "alineacion",
  "actas",
  "calendario",
]);

/**
 * Las pestañas con algo pendiente de nuestros partidos de la semana: lo mismo que Inicio llama
 * «siguiente paso»; y las categorías con la convocatoria por hacer. Se mira al abrir la app y al
 * salir de una pantalla donde se hace un paso, para que el punto se apague al hacerlo; no en
 * cada cambio de pantalla. Va por `GET /api/avisos`, aparte de las acciones de la pantalla, para
 * no hacerlas esperar. Si falla, no hay puntos.
 */
export function useAvisos(seccion: Seccion | undefined, conCarteles: boolean) {
  const [avisos, setAvisos] = useState<ReadonlySet<IdPestana>>(new Set());
  // Las categorías con la convocatoria de la semana sin hacer.
  const [porConvocar, setPorConvocar] = useState<ReadonlySet<string>>(new Set());
  const anterior = useRef<Seccion | undefined>(undefined);
  // Hasta la primera carga buena se sigue intentando en cada pantalla.
  const cargado = useRef(false);
  useEffect(() => {
    const previa = anterior.current;
    anterior.current = seccion;
    if (cargado.current && !(previa && previa !== seccion && PANTALLAS_DE_PASO.has(previa))) return;
    const control = new AbortController();
    void (async () => {
      const respuesta = await fetch(`/api/avisos?carteles=${conCarteles ? 1 : 0}`, {
        cache: "no-store",
        signal: control.signal,
      });
      if (!respuesta.ok) return;
      const datos = (await respuesta.json()) as { pestanas: IdPestana[]; porConvocar: string[] };
      cargado.current = true;
      setAvisos(new Set(datos.pestanas));
      setPorConvocar(new Set(datos.porConvocar));
    })().catch(() => undefined);
    return () => control.abort();
  }, [seccion, conCarteles]);
  return { avisos, porConvocar };
}
