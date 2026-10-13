"use client";

import { Button } from "@/components/ui/foundation/Button";
import type { ActaPorRevisar } from "@/lib/server/acciones/rfgf";
import styles from "./Jornada.module.css";

/** Qué puede hacer quien lo lee con cada tipo de problema. */
const QUE_HACER = {
  acta: "Si es un jugador nuevo, dalo de alta en Jugadores y reintenta; o mete el acta a mano desde Importar.",
  datos: "El marcador sí está guardado. Reintenta; si sigue igual, hay que enseñarle a leer ese acta.",
  red: "Suele pasar al pedir muchas seguidas. Espera unos minutos y reintenta; si no, se reintenta sola esta noche.",
} as const;

/**
 * Los partidos que no se pudieron traer bien de la federación: cuál es, por qué, qué hacer, el
 * acta para verla y un botón para volver a pedirla.
 */
export function ProblemasFederacion({
  actas,
  ocupado,
  onReintentar,
}: {
  actas: ActaPorRevisar[];
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
        {actas.map((acta) => (
          <li key={acta.codActa}>
            <span>
              <b>{acta.partido}.</b> {acta.motivo.replace(/[.]$/, "")}.{" "}
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
                onClick={() => onReintentar(acta.codActa)}
              >
                Reintentar
              </Button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
