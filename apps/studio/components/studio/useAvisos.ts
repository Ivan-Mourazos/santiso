"use client";

import { useEffect, useState } from "react";
import { hoyLocal } from "@/lib/jornada/semana";
import { partidoEnMesa, progresoPartido } from "@/lib/jornada/vestiario";
import { pestanasConAviso } from "@/lib/navigation/avisos";
import type { Seccion } from "@/lib/navigation/contexto";
import type { IdPestana } from "@/lib/navigation/menu";
import { cargarCartelesPartido } from "@/lib/server/acciones/carteles-guardados";
import { cargarPantallaJornada } from "@/lib/server/acciones/jornada";

/**
 * Las pestañas con algo pendiente de nuestros partidos de la semana: lo mismo que Inicio llama
 * «siguiente paso». Se recalcula al cambiar de pantalla, para que el punto se apague al hacerlo.
 * Si falla la carga, simplemente no hay puntos.
 */
export function useAvisos(seccion: Seccion | undefined, conCarteles: boolean) {
  const [avisos, setAvisos] = useState<ReadonlySet<IdPestana>>(new Set());
  useEffect(() => {
    let vigente = true;
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
      const guardados = carteles?.ok ? carteles.datos : {};
      setAvisos(
        pestanasConAviso(
          partidos.map(({ categoria, p }) =>
            progresoPartido(p, momento, categoria, guardados[p.id] ?? {}, conCarteles),
          ),
        ),
      );
    })().catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, [seccion, conCarteles]);
  return avisos;
}
