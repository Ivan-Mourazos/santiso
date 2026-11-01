"use client";
import ClasificacionesHistoricas from "./ClasificacionesHistoricas";
import { sinConexion } from "@/lib/resultado";
import { useCallback, useEffect, useState } from "react";
import { useStudio } from "@/components/studio/StudioContext";
import { Button } from "@/components/ui/foundation/Button";
import { EmptyState, LoadingState } from "@/components/ui/foundation/States";
import { cargarArchivoHistorico } from "@/lib/server/acciones/fichas-rfgf";
import { pedirPartidosHistoricosRfgf } from "@/lib/server/acciones/rfgf";
import type { ArchivoHistorico, GrupoDeArchivo } from "@/lib/server/consultas/fichas-rfgf";
import { Resultado, fechaCorta } from "./comunes";
import styles from "./Fichas.module.css";

/**
 * Archivo de temporadas pasadas: por temporada, los grupos en los que jugó el club y sus partidos
 * traídos de la federación. Los partidos de un grupo se piden aquí y llegan poco a poco.
 */
export default function Archivo({ categoria }: { categoria: string }) {
  const { acceso, showToast } = useStudio();
  const [archivo, setArchivo] = useState<ArchivoHistorico | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pidiendo, setPidiendo] = useState<string | null>(null);
  const cargar = useCallback(async () => {
    const r = await cargarArchivoHistorico();
    if (r.ok) setArchivo(r.datos);
    else setError(r.error);
  }, []);
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
  }, []);

  if (error) return <EmptyState title={error} />;
  if (!archivo) return <LoadingState title="Cargando el archivo…" />;
  const temporadas = archivo
    .map((t) => ({ ...t, grupos: t.grupos.filter((g) => g.categoria === categoria) }))
    .filter((t) => t.grupos.length > 0);
  if (temporadas.length === 0)
    return (
      <EmptyState
        title={`Sin temporadas pasadas de ${categoria} todavía`}
        detail="Se traen solas de la federación, poco a poco, en la copia de uso diario."
      />
    );
  const admin = acceso?.rol !== "tecnico";

  async function pedir(g: GrupoDeArchivo) {
    setPidiendo(g.codGrupo);
    const r = await pedirPartidosHistoricosRfgf(g.codGrupo);
    setPidiendo(null);
    if (!r.ok) return showToast(r.error, "error");
    showToast("Pedidos. Llegarán poco a poco, unas horas por temporada.");
    await cargar();
  }

  return (
    <div className={styles.ficha}>
      <ClasificacionesHistoricas temporadas={temporadas} />
      {temporadas.map((t, i) => (
        <details key={t.temporada} className={styles.temporada} open={i === 0}>
          <summary>
            {t.temporada}
            <small>
              {t.grupos.length} {t.grupos.length === 1 ? "competición" : "competiciones"}
            </small>
          </summary>
          <div className={styles.temporadaContenido}>
            {t.grupos.map((g) => (
              <section key={g.codGrupo} className={styles.grupoArchivo} aria-label={g.competicion}>
                <h4>
                  {g.competicion}
                  <small>
                    {g.grupo} · {g.conCifras} de {g.jugadores} jugadores con cifras
                    {/* Sin pedir no aporta nada: abajo ya sale el botón o «Sin partidos». */}
                    {g.archivo.estado !== "no_pedido" && ` · partidos: ${g.archivo.texto}`}
                  </small>
                </h4>
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
                ) : admin && g.archivo.estado === "no_pedido" ? (
                  <div className={styles.acciones}>
                    <Button
                      size="sm"
                      variant="secondary"
                      pending={pidiendo === g.codGrupo}
                      pendingLabel="Pidiendo…"
                      onClick={() => void pedir(g)}
                    >
                      Traer partidos
                    </Button>
                  </div>
                ) : (
                  <p className={styles.nota}>Sin partidos traídos todavía.</p>
                )}
                {admin && g.partidos.length > 0 && g.archivo.estado === "no_pedido" && (
                  <div className={styles.acciones}>
                    <Button
                      size="sm"
                      variant="secondary"
                      pending={pidiendo === g.codGrupo}
                      pendingLabel="Pidiendo…"
                      onClick={() => void pedir(g)}
                    >
                      Traer partidos
                    </Button>
                  </div>
                )}
              </section>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
