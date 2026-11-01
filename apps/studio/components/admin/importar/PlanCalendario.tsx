"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/foundation/Button";
import type { CalendarioLeido } from "@/lib/server/acciones/calendario-pdf";
import styles from "./Importar.module.css";

function Dato({
  valor,
  etiqueta,
  tono,
}: {
  valor: number;
  etiqueta: string;
  tono?: "bien" | "neutro" | "mal";
}) {
  return (
    <p className={styles.dato} data-tono={tono}>
      <strong>{valor}</strong>
      <span>{etiqueta}</span>
    </p>
  );
}

/** ¿Hay algo que crear? */
export const hayQueCrear = ({ resumen }: CalendarioLeido["plan"]) =>
  resumen.equiposNuevos + resumen.jornadasNuevas + resumen.crucesNuevos > 0;

/** Qué se va a crear a partir de un calendario, antes de escribir nada. */
export default function PlanCalendario({
  leido,
  ocupado,
  pendiente = false,
  onAplicar,
}: {
  leido: CalendarioLeido;
  ocupado: boolean;
  pendiente?: boolean;
  onAplicar: () => void;
}) {
  const { plan } = leido;
  const { resumen } = plan;
  const porJornada = useMemo(() => {
    const mapa = new Map<number, typeof plan.cruces>();
    for (const cruce of plan.cruces) {
      mapa.set(cruce.jornada, [...(mapa.get(cruce.jornada) ?? []), cruce]);
    }
    return [...mapa.entries()].sort((a, b) => a[0] - b[0]);
  }, [plan]);
  const nadaQueHacer = !hayQueCrear(plan);

  return (
    <section aria-label="Plan de importación">
      <h4 className={styles.titulo}>{leido.competicion}</h4>
      <p className={styles.nota}>Temporada {leido.temporada}</p>

      <div className={styles.resumen}>
        <Dato valor={resumen.equiposNuevos} etiqueta="equipos nuevos" tono="bien" />
        <Dato valor={resumen.equiposExistentes} etiqueta="equipos ya estaban" tono="neutro" />
        <Dato valor={resumen.jornadasNuevas} etiqueta="jornadas nuevas" />
        <Dato valor={resumen.crucesNuevos} etiqueta="partidos nuevos" tono="bien" />
        <Dato valor={resumen.crucesExistentes} etiqueta="partidos ya estaban" tono="neutro" />
        {resumen.crucesSinEquipo > 0 && (
          <Dato valor={resumen.crucesSinEquipo} etiqueta="sin equipo" tono="mal" />
        )}
      </div>

      {plan.sinResolver.length > 0 && (
        <div className={styles.avisos} role="status">
          <p>
            Estos nombres podrían ser dos equipos distintos y no se ha elegido ninguno. Sus partidos
            no se crearán hasta aclararlo en «Equipos»:
          </p>
          <p>
            <strong>{plan.sinResolver.join(" · ")}</strong>
          </p>
        </div>
      )}

      <div className={styles.accion}>
        <Button
          onClick={onAplicar}
          disabled={ocupado || nadaQueHacer}
          pending={pendiente}
          pendingLabel="Creando…"
        >
          {nadaQueHacer ? "Nada que crear" : "Crear equipos y partidos"}
        </Button>
      </div>

      {plan.equiposNuevos.length > 0 && (
        <details>
          <summary>Equipos que se van a crear ({plan.equiposNuevos.length})</summary>
          <p className={styles.nota}>{plan.equiposNuevos.map((e) => e.nombre).join(" · ")}</p>
        </details>
      )}
      {plan.parecidos.length > 0 && (
        <details>
          <summary>Equipos reconocidos con otro nombre ({plan.parecidos.length})</summary>
          <ul>
            {plan.parecidos.map((p) => (
              <li key={p.federacion}>
                {p.federacion} → {p.equipo}
              </li>
            ))}
          </ul>
        </details>
      )}

      <details>
        <summary>Partidos por jornada</summary>
        <div className={styles.jornadas}>
          {porJornada.map(([numero, cruces]) => (
            <div key={numero}>
              <h5 className={styles.titulo}>Jornada {numero}</h5>
              <ul>
                {cruces.map((cruce, indice) => (
                  <li key={`${numero}-${indice}`} data-estado={cruce.estado}>
                    {cruce.estado === "nuevo" ? "+" : cruce.estado === "existe" ? "=" : "!"}{" "}
                    {cruce.localNombre} vs {cruce.visitanteNombre}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}
