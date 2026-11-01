"use client";

import { useState } from "react";
import PlanCalendario from "@/components/admin/importar/PlanCalendario";
import { Button } from "@/components/ui/foundation/Button";
import {
  guardarCalendario,
  traerCalendarioRfgf,
  type CalendarioLeido,
} from "@/lib/server/acciones/calendario-pdf";
import { completarCompeticionRfgf } from "@/lib/server/acciones/rfgf";
import s from "./Federacion.module.css";

/**
 * Del enlace a la competición montada: trae de la federación equipos, jornadas y partidos,
 * enseña lo que va a crear y, al confirmar, lo crea y baja horarios, resultados y actas.
 */
export default function TraerCalendario({
  competicionId,
  sinPartidos,
  bloqueado,
  onOcupado,
  onHecho,
  showToast,
}: {
  competicionId: string;
  sinPartidos: boolean;
  /** Hay otra petición a la federación en marcha. */
  bloqueado: boolean;
  onOcupado: (ocupado: boolean) => void;
  onHecho: () => Promise<void>;
  showToast: (msg: string, type?: "success" | "error") => void;
}) {
  const [leido, setLeido] = useState<CalendarioLeido | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [creando, setCreando] = useState(false);

  async function ver() {
    setLeyendo(true);
    onOcupado(true);
    try {
      const r = await traerCalendarioRfgf(competicionId);
      if (r.ok) setLeido(r.datos);
      else showToast(r.error, "error");
    } catch {
      showToast("No se pudo hablar con la federación. Vuelve a intentarlo en un rato.", "error");
    } finally {
      setLeyendo(false);
      onOcupado(false);
    }
  }

  async function crear() {
    if (!leido) return;
    setCreando(true);
    onOcupado(true);
    try {
      const r = await guardarCalendario({ competicionId, plan: leido.plan });
      if (!r.ok) return showToast(r.error, "error");
      const { equipos, partidos } = r.datos;
      const completado = await completarCompeticionRfgf(competicionId);
      showToast(
        `Creados ${equipos} equipos y ${partidos} partidos.` +
          (completado.ok ? ` ${completado.datos}` : ` ${completado.error}`),
      );
      setLeido(null);
      await onHecho();
    } catch {
      showToast("No se pudo terminar. Mira lo creado y vuelve a intentarlo.", "error");
    } finally {
      setCreando(false);
      onOcupado(false);
    }
  }

  return (
    <section aria-label="Equipos y partidos de la competición">
      <details className={s.bloque} open={sinPartidos || leido !== null}>
        <summary>
          <h3>Equipos y partidos</h3>
        </summary>
        <div className={s.opcion}>
          <div>
            <strong>Traer de la federación</strong>
            <span>
              Equipos, jornadas y partidos de esta competición. Primero ves lo que se va a crear; lo
              que ya existe no se toca.
            </span>
          </div>
          <Button
            variant={sinPartidos ? "primary" : "secondary"}
            pending={leyendo}
            pendingLabel="Mirando…"
            disabled={bloqueado || creando}
            onClick={() => void ver()}
          >
            Traer equipos y partidos
          </Button>
        </div>
        {leido && (
          <PlanCalendario
            leido={leido}
            ocupado={bloqueado || creando}
            pendiente={creando}
            onAplicar={() => void crear()}
          />
        )}
      </details>
    </section>
  );
}
