"use client";

import { useEffect, useRef, useState } from "react";
import { hoyLocal } from "@/lib/jornada/semana";
import { partidoEnMesa, progresoPartido, trasPartido } from "@/lib/jornada/vestiario";
import { categoriasPorConvocar, pestanasConAviso } from "@/lib/navigation/avisos";
import type { Seccion } from "@/lib/navigation/contexto";
import type { IdPestana } from "@/lib/navigation/menu";
import { cargarCartelesPartido } from "@/lib/server/acciones/carteles-guardados";
import { cargarPantallaJornada } from "@/lib/server/acciones/jornada";

/** Las pantallas donde se hace un paso del partido: al salir de ellas el aviso puede cambiar. */
const PANTALLAS_DE_PASO: ReadonlySet<Seccion> = new Set<Seccion>([
  "carteles",
  "convocatoria",
  "alineacion",
  "actas",
  "calendario",
]);

/**
 * Las acciones del servidor van de una en una: el aviso espera a que la pantalla cargue lo suyo
 * para no ponerse delante.
 */
const ESPERA_MS = 2000;

/**
 * Las pestañas con algo pendiente de nuestros partidos de la semana: lo mismo que Inicio llama
 * «siguiente paso». Se mira al abrir la app y al salir de una pantalla donde se hace un paso, para
 * que el punto se apague al hacerlo; no en cada cambio de pantalla. Si falla, no hay puntos.
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
    let vigente = true;
    const reloj = setTimeout(() => {
      void (async () => {
        const pantalla = await cargarPantallaJornada(hoyLocal());
        if (!vigente || !pantalla.ok) return;
        const { momento, categorias } = pantalla.datos;
        const partidos = categorias.flatMap((c) => {
          const p = partidoEnMesa(c.proximo, c.ultimo, momento);
          return p ? [{ categoria: c.categoria, p }] : [];
        });
        const carteles = conCarteles
          ? await cargarCartelesPartido(partidos.map(({ p }) => p.id))
          : null;
        if (!vigente) return;
        cargado.current = true;
        const guardados = carteles?.ok ? carteles.datos : {};
        setPorConvocar(
          categoriasPorConvocar(
            partidos.map(({ categoria, p }) => ({
              categoria,
              despues: trasPartido(p, momento),
              convocados: p.preparacion.convocatoria,
            })),
          ),
        );
        setAvisos(
          pestanasConAviso(
            partidos.map(({ categoria, p }) =>
              progresoPartido(p, momento, categoria, guardados[p.id] ?? {}, conCarteles),
            ),
          ),
        );
      })().catch(() => undefined);
    }, ESPERA_MS);
    return () => {
      vigente = false;
      clearTimeout(reloj);
    };
  }, [seccion, conCarteles]);
  return { avisos, porConvocar };
}
