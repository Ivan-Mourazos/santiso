"use client";

/* eslint-disable @next/next/no-img-element -- media local servida por el route handler */
import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/foundation/Dialog";
import { LoadingState } from "@/components/ui/foundation/States";
import {
  papelEnPartido,
  resultadoDePartido,
  totalesDeFicha,
  type FichaJugador as Ficha,
} from "@/lib/estadisticas/ficha";
import { cargarFichaJugador } from "@/lib/server/acciones/estadisticas";
import styles from "./Estadisticas.module.css";

interface Props {
  jugadorId: string;
  /** Nombre que ya se ve en la tabla, para titular el diálogo mientras carga. */
  nombre: string;
  categoria: string;
  temporadaId: string;
  competicionId: string | null;
  onCerrar: () => void;
}

const fechaCorta = (fecha: string | null) =>
  fecha ? `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}` : "—";

/**
 * Ficha de un jugador: su temporada partido a partido (rival, resultado, si fue titular, goles
 * y tarjetas), en el mismo ámbito que la tabla (temporada, categoría y competición elegida).
 */
export default function FichaJugador({
  jugadorId,
  nombre,
  categoria,
  temporadaId,
  competicionId,
  onCerrar,
}: Props) {
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    void cargarFichaJugador(jugadorId, categoria, temporadaId, competicionId).then((r) => {
      if (!vigente) return;
      if (r.ok) setFicha(r.datos);
      else setError(r.error);
    });
    return () => {
      vigente = false;
    };
  }, [jugadorId, categoria, temporadaId, competicionId]);

  const totales = ficha ? totalesDeFicha(ficha.partidos) : null;

  return (
    <Dialog open onClose={onCerrar} title={nombre} description={`Ficha · ${categoria}`}>
      {error ? (
        <p className={styles.nota}>{error}</p>
      ) : !ficha || !totales ? (
        <LoadingState title="Cargando ficha…" />
      ) : (
        <div className={styles.ficha}>
          <header className={styles.fichaCabecera}>
            {ficha.jugador.fotoUrl ? (
              <img className={styles.fichaFoto} src={`${ficha.jugador.fotoUrl}?ancho=480`} alt="" />
            ) : (
              <span className={styles.fichaFoto} aria-hidden="true" />
            )}
            <div>
              <strong>{ficha.jugador.nombre}</strong>
              <span>
                {[
                  ficha.jugador.apodo,
                  ficha.jugador.dorsal === null ? null : `Dorsal ${ficha.jugador.dorsal}`,
                  ficha.jugador.posicion,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
          </header>

          <dl className={styles.fichaTotales}>
            {(
              [
                ["Convocado", totales.convocados],
                ["Titular", totales.titularidades],
                ["Jugados", totales.jugados],
                ["Goles", totales.goles],
                ["Amarillas", totales.amarillas],
                ["Rojas", totales.rojas],
              ] as const
            ).map(([etiqueta, valor]) => (
              <div key={etiqueta}>
                <dt>{etiqueta}</dt>
                <dd>{valor}</dd>
              </div>
            ))}
          </dl>

          {ficha.partidos.length === 0 ? (
            <p className={styles.nota}>Todavía no ha estado convocado en ningún partido con acta.</p>
          ) : (
            <ul className={styles.fichaPartidos} aria-label="Partidos">
              {ficha.partidos.map((p) => {
                const resultado = resultadoDePartido(p);
                return (
                  <li key={p.partidoId} data-jugo={p.jugo}>
                    <div className={styles.fichaPartido}>
                      <strong>
                        {p.local ? "vs" : "en"} {p.rival}
                      </strong>
                      <span>
                        {fechaCorta(p.fecha)} · J{p.jornada} · {p.competicion}
                      </span>
                    </div>
                    {resultado && (
                      <span className={styles.fichaResultado} data-letra={resultado[0]}>
                        {resultado}
                      </span>
                    )}
                    <div className={styles.fichaHechos}>
                      <span>{papelEnPartido(p)}</span>
                      {p.goles > 0 && <span>⚽ {p.goles}</span>}
                      {p.golesPropia > 0 && <span>En propia: {p.golesPropia}</span>}
                      {p.amarillas > 0 && <span className={styles.amarilla}>Amarilla</span>}
                      {p.rojas > 0 && <span className={styles.roja}>Roja</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </Dialog>
  );
}
