import { claveNombre } from "@santiso/domain";
import type { SelectorMatch } from "@/components/admin/cartel/Common";
import type { NextMatch } from "@/lib/cartel/types";
import { matchDateInput, matchTimeInput } from "@/lib/match-date-time";

/** Todos los encuentros propios dentro de seis días del primero, por fecha, hasta cuatro. */
export function elegirAxenda(partidos: SelectorMatch[], hoy: Date): NextMatch[] {
  const desde = new Date(hoy);
  desde.setHours(0, 0, 0, 0);
  const propios = partidos
    .filter((p) => {
      const estado = claveNombre(p.estado ?? "programado");
      return (
        p.fecha &&
        new Date(p.fecha).getTime() >= desde.getTime() &&
        !["finalizado", "cancelado", "aplazado"].includes(estado) &&
        [p.equipo_local, p.equipo_visitante].some((e) =>
          claveNombre(e?.nombre ?? "").includes("santiso"),
        )
      );
    })
    .sort((a, b) => a.fecha!.localeCompare(b.fecha!) || a.id.localeCompare(b.id));
  const primero = propios[0];
  if (!primero) return [];
  const limite = new Date(primero.fecha!).getTime() + 6 * 86400000;
  return propios
    .filter((p) => new Date(p.fecha!).getTime() <= limite)
    .slice(0, 4)
    .map((p) => {
      const local = claveNombre(p.equipo_local?.nombre ?? "").includes("santiso");
      const rival = local ? p.equipo_visitante : p.equipo_local;
      return {
        partidoId: p.id,
        rival: rival?.nombre ?? "",
        rivalEscudoUrl: rival?.escudo_url ?? "",
        fecha: matchDateInput(p.fecha),
        hora: matchTimeInput(p.fecha),
        categoria: p.categoria ?? "Senior",
        santisoSide: local ? "left" : "right",
        lugar: p.campo?.nombre ?? p.lugar ?? "",
        competicion: p.competiciones?.nombre ?? p.competicion ?? p.jornada?.competicion ?? "",
        jornada: String(p.jornada?.numero ?? ""),
      };
    });
}
