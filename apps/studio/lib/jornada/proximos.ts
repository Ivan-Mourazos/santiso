import type { SelectorMatch } from "@/components/admin/cartel/Common";
import type { NextMatch } from "@/lib/cartel/types";
import { matchDateInput, matchTimeInput } from "@/lib/match-date-time";

/** Categorías del cartel «Próximos encuentros»: un hueco por cada una, en este orden. */
export const CATEGORIAS_PROXIMOS = ["Senior", "Veteranos"] as const;

const UN_DIA = 24 * 60 * 60 * 1000;

function normalizar(valor: string | null | undefined) {
  return (valor ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function clave3(valor: string | null | undefined) {
  return normalizar(valor).slice(0, 3);
}

function esSantiso(equipo: SelectorMatch["equipo_local"]) {
  return normalizar(equipo?.nombre).includes("santiso");
}

function pendiente(m: SelectorMatch) {
  return !["finalizado", "cancelado", "aplazado"].includes(normalizar(m.estado || "programado"));
}

function instante(m: SelectorMatch) {
  // `fecha` es hora de pared: sin zona, `Date` la toma como local.
  return m.fecha ? new Date(m.fecha).getTime() : Number.NaN;
}

export function huecoProximo(categoria: string): NextMatch {
  return {
    rival: "",
    rivalEscudoUrl: "",
    fecha: "",
    hora: "18:00",
    categoria,
    lugar: "",
    santisoSide: "right",
  };
}

/**
 * Los partidos del cartel «Próximos encuentros»: el siguiente pendiente del Santiso en cada
 * categoría, dentro de los 6 días desde el primero (la misma jornada: si un equipo descansa, no
 * coge el de la semana siguiente). Siempre un hueco por categoría; la que no juega queda sin
 * rival y el cartel no la dibuja. Los que juegan van por orden de fecha.
 */
export function elegirProximos(partidos: SelectorMatch[], hoy: Date): NextMatch[] {
  const desde = new Date(hoy);
  desde.setHours(0, 0, 0, 0);
  const futuros = partidos
    .filter(
      (m) =>
        pendiente(m) &&
        (esSantiso(m.equipo_local) || esSantiso(m.equipo_visitante)) &&
        instante(m) >= desde.getTime(),
    )
    .sort((a, b) => instante(a) - instante(b));
  const primero = futuros[0];
  const limite = primero ? instante(primero) + 6 * UN_DIA : Number.NEGATIVE_INFINITY;

  const elegidos = CATEGORIAS_PROXIMOS.map((categoria) => {
    const m = futuros.find(
      (p) => instante(p) <= limite && clave3(p.categoria) === clave3(categoria),
    );
    if (!m) return { orden: Number.POSITIVE_INFINITY, partido: huecoProximo(categoria) };
    const local = esSantiso(m.equipo_local);
    const rival = local ? m.equipo_visitante : m.equipo_local;
    const partido: NextMatch = {
      rival: rival?.nombre || "",
      rivalEscudoUrl: rival?.escudo_url || "",
      fecha: matchDateInput(m.fecha),
      hora: matchTimeInput(m.fecha),
      categoria,
      lugar: m.campo?.nombre || m.lugar || "",
      santisoSide: local ? "left" : "right",
    };
    return { orden: instante(m), partido };
  });
  return elegidos.sort((a, b) => a.orden - b.orden).map((e) => e.partido);
}
