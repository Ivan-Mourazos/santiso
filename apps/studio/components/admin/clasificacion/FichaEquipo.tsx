"use client";

import { sinConexion } from "@/lib/resultado";
import Link from "next/link";
import { useEffect, useState } from "react";
import boton from "@/components/ui/foundation/Button.module.css";
import { fechaPartido } from "@/components/admin/jornada/TarjetaPartido";
import { Dialog } from "@/components/ui/foundation/Dialog";
import type { FilaClasificacion } from "@/lib/dto";
import { cargarFichaEquipo } from "@/lib/server/acciones/liga";
import type { FichaEquipo as Ficha } from "@/lib/server/consultas/partidos-liga";
import styles from "./Clasificacion.module.css";

const DATOS: { clave: keyof FilaClasificacion; nombre: string }[] = [
  { clave: "puntos", nombre: "Puntos" },
  { clave: "jugados", nombre: "Partidos jugados" },
  { clave: "ganados", nombre: "Ganados" },
  { clave: "empatados", nombre: "Empatados" },
  { clave: "perdidos", nombre: "Perdidos" },
  { clave: "golesFavor", nombre: "Goles a favor" },
  { clave: "golesContra", nombre: "Goles en contra" },
];

function letra(goles: number, golesRival: number) {
  return goles > golesRival ? "G" : goles < golesRival ? "P" : "E";
}

/**
 * Ficha de un equipo de la tabla, en una hoja: sus números, cómo llega (últimos cinco), lo que le
 * queda y quién le marca. Los números salen de la fila; lo demás se pide al abrirla.
 */
export default function FichaEquipo({
  competicionId,
  fila,
  puesto,
  onClose,
}: {
  competicionId: string;
  fila: FilaClasificacion | null;
  puesto: number;
  onClose: () => void;
}) {
  const [ficha, setFicha] = useState<{ id: string; datos: Ficha | null } | null>(null);
  const equipoId = fila?.equipoId ?? null;
  useEffect(() => {
    if (!equipoId) return;
    let vigente = true;
    void cargarFichaEquipo(competicionId, equipoId)
      .catch(sinConexion)
      .then((r) => {
        if (vigente) setFicha({ id: equipoId, datos: r.ok ? r.datos : null });
      });
    return () => {
      vigente = false;
    };
  }, [competicionId, equipoId]);
  const datos = ficha?.id === equipoId ? ficha.datos : undefined;

  return (
    <Dialog
      open={fila !== null}
      onClose={onClose}
      title={fila?.nombre ?? "Equipo"}
      closeLabel="Cerrar ficha"
      mobilePresentation="sheet"
      footer={
        <Link
          className={`${boton.button} ${boton.primary}`}
          href={`/admin/equipo?id=${encodeURIComponent(fila?.equipoId ?? "")}`}
          transitionTypes={["nav-forward"]}
        >
          Ver la ficha completa
        </Link>
      }
    >
      {fila && (
        <div className={styles.ficha}>
          <div className={styles.fichaCabecera}>
            {fila.escudoUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- media local
              <img src={fila.escudoUrl} alt="" />
            )}
            <p>
              <strong>{puesto}º</strong> · {fila.puntos} puntos
            </p>
          </div>
          <section aria-label={`Estadísticas de ${fila.nombre}`}>
            <dl className={styles.fichaDatos}>
              {DATOS.map((d) => (
                <div key={d.clave}>
                  <dt>{d.nombre}</dt>
                  <dd>{fila[d.clave]}</dd>
                </div>
              ))}
            </dl>
          </section>
          {datos === undefined ? (
            <p className={styles.fichaNota} role="status">
              Cargando partidos…
            </p>
          ) : datos === null ? null : (
            <>
              {datos.jugados.length > 0 && (
                <section className={styles.fichaBloque} aria-label="Últimos resultados">
                  <h3>Últimos resultados</h3>
                  <ol className={styles.forma} aria-label="Forma">
                    {datos.jugados.slice(0, 5).map((p) => (
                      <li key={p.id} data-r={letra(p.goles, p.golesRival)}>
                        {letra(p.goles, p.golesRival)}
                      </li>
                    ))}
                  </ol>
                  <ul className={styles.fichaPartidos}>
                    {datos.jugados.slice(0, 5).map((p) => (
                      <li key={p.id}>
                        <span>J{p.jornada}</span>
                        <span>
                          {p.casa ? "vs" : "en"} {p.rival}
                        </span>
                        <strong>
                          {p.goles}–{p.golesRival}
                        </strong>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {datos.pendientes.length > 0 && (
                <section className={styles.fichaBloque} aria-label="Próximos partidos">
                  <h3>Próximos partidos</h3>
                  <ul className={styles.fichaPartidos}>
                    {datos.pendientes.slice(0, 3).map((p) => (
                      <li key={p.id}>
                        <span>J{p.jornada}</span>
                        <span>
                          {p.casa ? "vs" : "en"} {p.rival}
                        </span>
                        <span>{fechaPartido(p.fecha).dia}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {datos.goleadores.length > 0 && (
                <section className={styles.fichaBloque} aria-label="Goleadores">
                  <h3>Goleadores</h3>
                  <ul className={styles.fichaPartidos}>
                    {datos.goleadores.slice(0, 5).map((g) => (
                      <li key={g.persona}>
                        <span>{g.persona}</span>
                        <strong>{g.goles}</strong>
                      </li>
                    ))}
                  </ul>
                  <p className={styles.fichaNota}>
                    {datos.tarjetas.amarillas} amarillas · {datos.tarjetas.rojas} rojas (según actas
                    de la federación)
                  </p>
                </section>
              )}
            </>
          )}
        </div>
      )}
    </Dialog>
  );
}
