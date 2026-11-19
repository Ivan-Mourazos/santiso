"use client";
import { TablaFinal } from "./ClasificacionesHistoricas";
import {
  esCopa,
  estadoClasificacion,
  filaSantiso,
  nombreCompeticion,
  ordenarCompeticiones,
} from "@/lib/archivo-historico";
import { sinConexion } from "@/lib/resultado";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/foundation/Button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/foundation/States";
import { cargarArchivoHistorico } from "@/lib/server/acciones/fichas-rfgf";
import type { ArchivoHistorico } from "@/lib/server/consultas/fichas-rfgf";
import { Resultado, fechaCorta } from "./comunes";
import styles from "./Fichas.module.css";

/**
 * Archivo de temporadas pasadas: por temporada, los grupos en los que jugó el club y sus partidos
 * traídos de la federación. Se completan solos; si falta alguno, se pide en Federación.
 */
export default function Archivo({ categoria }: { categoria: string }) {
  const [archivo, setArchivo] = useState<ArchivoHistorico | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    let vigente = true;
    void cargarArchivoHistorico()
      .catch(sinConexion)
      .then((r) => {
        if (!vigente) return;
        if (r.ok) setArchivo(r.datos);
        else setError(r.error);
      });
    return () => {
      vigente = false;
    };
  }, [intento]);

  if (error) {
    return (
      <ErrorState
        title="No se pudo cargar el archivo"
        detail={error}
        action={
          <Button
            variant="secondary"
            onClick={() => {
              setError(null);
              setIntento((previo) => previo + 1);
            }}
          >
            Reintentar
          </Button>
        }
      />
    );
  }
  if (!archivo) return <LoadingState title="Cargando el archivo…" />;
  const temporadas = archivo
    .map((t) => ({ ...t, grupos: t.grupos.filter((g) => g.categoria === categoria) }))
    .filter((t) => t.grupos.length > 0)
    .sort((a, b) => b.temporada.localeCompare(a.temporada));
  if (temporadas.length === 0)
    return (
      <EmptyState
        title={`Sin temporadas pasadas de ${categoria} todavía`}
        detail="Se traen solas de la federación, poco a poco, en la copia de uso diario."
      />
    );
  return (
    <div className={styles.ficha}>
      {temporadas.map((t, i) => (
        <details key={t.temporada} className={styles.temporada} open={i === 0}>
          <summary>
            {t.temporada}
            <small>
              {t.grupos.length} {t.grupos.length === 1 ? "competición" : "competiciones"}
            </small>
          </summary>
          <div className={styles.temporadaContenido}>
            {ordenarCompeticiones(t.grupos).map((g) => {
              const propio = filaSantiso(g);
              const c = g.clasificacion;
              const nombre = nombreCompeticion(g, t.grupos);
              return (
                <details key={g.codGrupo} className={styles.clasificacionHistorica}>
                  <summary>
                    <strong>{nombre}</strong>
                    <span>
                      {esCopa(g) && c?.estado === "leido" && c.ronda
                        ? `Llegó a ${c.ronda}`
                        : propio
                          ? `${propio.posicion}.º · ${propio.puntos} puntos · PJ ${propio.jugados} · G ${propio.ganados} · E ${propio.empatados} · P ${propio.perdidos} · GF ${propio.golesFavor} · GC ${propio.golesContra}`
                          : estadoClasificacion(g)}
                    </span>
                  </summary>
                  <div className={styles.detalleArchivo}>
                    {!esCopa(g) && c?.estado === "leido" && c.filas?.length ? (
                      <TablaFinal grupo={g} nombre={nombre} />
                    ) : null}
                    {g.partidos.length > 0 ? (
                      <ul className={styles.lista}>
                        {g.partidos.map((p) => (
                          <li key={p.id}>
                            <span>
                              {p.local} – {p.visitante}
                              <small>
                                J{p.jornada} · {fechaCorta(p.fecha ?? p.fechaNominal)}
                                {p.enlaceActa && (
                                  <>
                                    {" · "}
                                    <a
                                      className={styles.chipActa}
                                      href={p.enlaceActa}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      Acta
                                    </a>
                                  </>
                                )}
                              </small>
                            </span>
                            <span className={styles.marcador}>
                              {p.golesLocal ?? "–"}–{p.golesVisitante ?? "–"}
                              <Resultado r={p.resultado} />
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className={styles.nota}>Sin partidos traídos todavía.</p>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        </details>
      ))}
    </div>
  );
}
