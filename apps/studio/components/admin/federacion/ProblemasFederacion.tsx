"use client";

import { Button } from "@/components/ui/foundation/Button";
import type { ActaPorRevisar } from "@/lib/server/acciones/rfgf";
import styles from "./ProblemasFederacion.module.css";

/** Qué puede hacer quien lo lee con cada tipo de problema. */
const QUE_HACER = {
  acta: "Si es un jugador nuevo, dalo de alta en Jugadores y reintenta.",
  datos: "El marcador sí está guardado. Reintenta; si sigue igual, hay que enseñarle a leer ese acta.",
  red: "Suele pasar al pedir muchas seguidas. Espera unos minutos y reintenta; si no, se reintenta sola esta noche.",
} as const;

const ESTADO = { acta: "Acta por revisar", datos: "Faltan datos", red: "Error de red" } as const;
const FECHA = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "numeric" });

/**
 * Los partidos que no se pudieron traer bien de la federación: cuál es, por qué, qué hacer, el
 * acta para verla y un botón para volver a pedirla.
 */
export function ProblemasFederacion({
  actas,
  contexto,
  reintentando,
  ocupado,
  onReintentar,
}: {
  actas: ActaPorRevisar[];
  contexto: ReadonlyMap<string, { jornada: number; fecha: string | null }>;
  reintentando: string | null;
  ocupado: boolean;
  onReintentar: (codActa: string) => void;
}) {
  if (actas.length === 0) return null;
  return (
    <div className={styles.rfgfAviso} role="alert">
      <strong>
        {actas.length === 1
          ? "Hay un partido que la federación no me dejó traer bien"
          : `Hay ${actas.length} partidos que la federación no me dejó traer bien`}
      </strong>
      <ul>
        {actas.map((acta) => {
          const dato = contexto.get(acta.codActa);
          return (
            <li key={acta.codActa}>
              <div className={styles.incidenciaMeta}>
                <span>{dato ? `J${dato.jornada}` : "—"}</span>
                <span>{dato?.fecha ? FECHA.format(new Date(dato.fecha)) : "—"}</span>
                <strong>{ESTADO[acta.tipo]}</strong>
              </div>
              <span className={styles.incidenciaTexto}>
                <b>{acta.partido}.</b> {acta.motivo.replace(/[.]$/, "")}.
                <em>{QUE_HACER[acta.tipo]}</em>
              </span>
              <span className={styles.rfgfAcciones}>
                {acta.enlace && (
                  <a href={acta.enlace} target="_blank" rel="noreferrer">
                    Ver acta
                  </a>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={ocupado}
                  pending={reintentando === acta.codActa}
                  pendingLabel="Trayendo…"
                  onClick={() => onReintentar(acta.codActa)}
                >
                  Reintentar
                </Button>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
