"use client";

import { useStudio } from "@/components/studio/StudioContext";
import { TarjetasMenu } from "@/components/studio/TarjetasMenu";
import { seccionesDelMenu, type Seccion } from "@/lib/navigation/contexto";
import { MENU, gruposVisibles } from "@/lib/navigation/menu";

/** Carteles sin plantilla elegida: las mismas tarjetas que la hoja de la pestaña «Carteles». */
export default function CatalogoCarteles() {
  const { acceso } = useStudio();
  const carteles = MENU.find((p) => p.id === "carteles")!;
  const visibles = new Set<Seccion>(seccionesDelMenu(acceso).map((s) => s.id));
  return (
    <TarjetasMenu
      grupos={gruposVisibles(carteles, visibles, acceso?.rol === "tecnico")}
      titulo="h2"
    />
  );
}
