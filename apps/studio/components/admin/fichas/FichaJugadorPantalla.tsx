"use client";
/* eslint-disable @next/next/no-img-element -- fotos de la media local */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useStudio } from "@/components/studio/StudioContext";
import { Button } from "@/components/ui/foundation/Button";
import { EmptyState, LoadingState } from "@/components/ui/foundation/States";
import {
  cargarFichaCompletaDeJugador,
  traerTemporadasJugador,
} from "@/lib/server/acciones/fichas-rfgf";
import type { FichaCompletaDeJugador } from "@/lib/server/consultas/fichas-rfgf";
import { CuadrosCifras, Resultado, fechaCorta } from "./comunes";
import styles from "./Fichas.module.css";
import { iniciales } from "@/lib/iniciales";

/** «34 años», a día de hoy; `null` sin fecha de nacimiento. */
function edad(nacimiento: string | null) {
  if (!nacimiento) return null;
  const nacio = new Date(nacimiento);
  if (Number.isNaN(nacio.getTime())) return null;
  const hoy = new Date();
  const cumplido =
    hoy.getMonth() > nacio.getMonth() ||
    (hoy.getMonth() === nacio.getMonth() && hoy.getDate() >= nacio.getDate());
  return `${hoy.getFullYear() - nacio.getFullYear() - (cumplido ? 0 : 1)} años`;
}

/**
 * Ficha de un jugador: sus datos, su temporada partido a partido, todas sus temporadas con las
 * cifras oficiales de la federación y los otros equipos en los que se le ha visto en actas.
 */
export default function FichaJugadorPantalla({ jugadorId }: { jugadorId: string | null }) {
  const { acceso, showToast } = useStudio();
  const [estado, setEstado] = useState<{
    id: string;
    ficha: FichaCompletaDeJugador | null;
    error: string | null;
  } | null>(null);
  const [trayendo, setTrayendo] = useState(false);
  const cargar = useCallback(async (id: string) => {
    const r = await cargarFichaCompletaDeJugador(id);
    setEstado({ id, ficha: r.ok ? r.datos : null, error: r.ok ? null : r.error });
  }, []);
  useEffect(() => {
    if (!jugadorId) return;
    let vigente = true;
    void cargarFichaCompletaDeJugador(jugadorId).then((r) => {
      if (vigente)
        setEstado({ id: jugadorId, ficha: r.ok ? r.datos : null, error: r.ok ? null : r.error });
    });
    return () => {
      vigente = false;
    };
  }, [jugadorId]);

  if (!jugadorId) return <EmptyState title="Elige un jugador desde Jugadores o Goleadores." />;
  if (!estado || estado.id !== jugadorId) return <LoadingState title="Cargando la ficha…" />;
  if (estado.error) return <EmptyState title={estado.error} />;
  const f = estado.ficha;
  if (!f) return <EmptyState title="Ese jugador ya no está." />;
  const j = f.jugador;
  const admin = acceso?.rol !== "tecnico";
  const datosPersonales = [edad(j.fechaNacimiento), j.posicionesConocidas.join(", ")].filter(
    Boolean,
  );

  async function traer() {
    setTrayendo(true);
    const r = await traerTemporadasJugador(jugadorId!);
    setTrayendo(false);
    if (!r.ok) return showToast(r.error, "error");
    showToast("Traídas de la federación las temporadas que faltaban.");
    await cargar(jugadorId!);
  }

  return (
    <article className={styles.ficha} aria-label={`Ficha de ${j.nombre}`}>
      <header className={styles.cabecera}>
        {j.fotoUrl ? (
          <img className={styles.foto} src={j.fotoUrl} alt="" />
        ) : (
          <span className={styles.sinImagen} aria-hidden="true">
            {iniciales(j.nombre)}
          </span>
        )}
        <div className={styles.nombre}>
          <h2>{j.apodo || j.nombre}</h2>
          <p>
            {j.apodo ? `${j.nombre} · ` : ""}
            {datosPersonales.join(" · ") || "Sin datos personales"}
          </p>
          <div className={styles.chips}>
            {j.inscripciones.slice(0, 4).map((i) => (
              <span key={`${i.temporada}-${i.categoria}`} className={styles.chip}>
                {i.temporada} · {i.categoria}
                {i.dorsal !== null ? ` · ${i.dorsal}` : ""}
              </span>
            ))}
          </div>
        </div>
      </header>

      <section className={styles.bloque} aria-label="En la federación">
        <h3>Toda su carrera en la federación</h3>
        <CuadrosCifras cifras={f.total} />
        {(f.porLeer > 0 || admin) && (
          <div className={styles.acciones}>
            {f.porLeer > 0 && (
              <p className={styles.nota}>
                {f.porLeer} {f.porLeer === 1 ? "temporada" : "temporadas"} por leer de la
                federación.
              </p>
            )}
            {admin && f.porLeer > 0 && (
              <Button
                variant="secondary"
                size="sm"
                pending={trayendo}
                pendingLabel="Trayendo…"
                onClick={() => void traer()}
              >
                Traer lo que falte
              </Button>
            )}
          </div>
        )}
      </section>

      {f.temporadas.length > 0 && (
        <section className={styles.bloque} aria-label="Temporadas">
          <h3>Temporadas</h3>
          <div className={styles.tablaCaja}>
            <table className={styles.tabla}>
              <thead>
                <tr>
                  <th scope="col">Competición</th>
                  <th scope="col" title="Jugados">
                    PJ
                  </th>
                  <th scope="col" title="Titular">
                    Tit
                  </th>
                  <th scope="col" title="Goles">
                    G
                  </th>
                  <th scope="col" title="Amarillas">
                    TA
                  </th>
                  <th scope="col" title="Rojas">
                    TR
                  </th>
                </tr>
              </thead>
              <tbody>
                {f.temporadas.map((t) => [
                  <tr key={t.temporada} className={styles.filaTemporada}>
                    <td>{t.temporada}</td>
                    <td>{t.total.jugados}</td>
                    <td>{t.total.titular}</td>
                    <td>{t.total.goles}</td>
                    <td>{t.total.amarillas + t.total.doblesAmarillas}</td>
                    <td>{t.total.rojas}</td>
                  </tr>,
                  ...t.grupos.map((g) => (
                    <tr key={`${t.temporada}-${g.competicion}-${g.grupo}`}>
                      <td>
                        {g.competicion}
                        <br />
                        <small className={styles.nota}>
                          {g.categoria} · {g.grupo}
                        </small>
                      </td>
                      {g.cifras ? (
                        <>
                          <td>{g.cifras.jugados}</td>
                          <td>{g.cifras.titular}</td>
                          <td>{g.cifras.goles}</td>
                          <td>{g.cifras.amarillas + g.cifras.doblesAmarillas}</td>
                          <td>{g.cifras.rojas}</td>
                        </>
                      ) : (
                        <td colSpan={5}>Por leer</td>
                      )}
                    </tr>
                  )),
                ])}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {f.actual.map(({ temporadaId, categoria, ficha }) => (
        <section
          key={`${temporadaId}-${categoria}`}
          className={styles.bloque}
          aria-label={`Esta temporada · ${categoria}`}
        >
          <h3>Esta temporada · {categoria}</h3>
          {ficha.partidos.length === 0 ? (
            <p className={styles.nota}>Todavía sin partidos con acta.</p>
          ) : (
            <ul className={styles.lista}>
              {ficha.partidos.slice(0, 10).map((p) => {
                const r =
                  p.golesSantiso === null || p.golesRival === null
                    ? null
                    : p.golesSantiso > p.golesRival
                      ? "G"
                      : p.golesSantiso < p.golesRival
                        ? "P"
                        : "E";
                const papel = !p.jugo ? "No jugó" : p.titular ? "Titular" : "Suplente";
                const extras = [
                  p.goles ? `${p.goles} ${p.goles === 1 ? "gol" : "goles"}` : "",
                  p.amarillas ? "amarilla" : "",
                  p.rojas ? "roja" : "",
                ].filter(Boolean);
                return (
                  <li key={p.partidoId}>
                    <span>
                      {p.local ? "vs" : "en"} {p.rival}
                      <small>
                        J{p.jornada} · {fechaCorta(p.fecha)} · {papel}
                        {extras.length ? ` · ${extras.join(", ")}` : ""}
                      </small>
                    </span>
                    <span className={styles.marcador}>
                      {p.golesSantiso ?? "–"}–{p.golesRival ?? "–"}
                      <Resultado r={r} />
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}

      {(f.clubesVistos.length > 0 || j.historial.length > 0) && (
        <section className={styles.bloque} aria-label="Otros equipos">
          <h3>Otros equipos</h3>
          {f.clubesVistos.length > 0 && (
            <ul className={styles.lista}>
              {f.clubesVistos.map((c) => (
                <li key={`${c.temporada}-${c.competicion}-${c.equipo}`}>
                  <span>
                    {c.equipoId ? (
                      <Link
                        href={`/admin/equipo?id=${encodeURIComponent(c.equipoId)}`}
                        transitionTypes={["nav-forward"]}
                      >
                        {c.equipo}
                      </Link>
                    ) : (
                      c.equipo
                    )}
                    <small>
                      {c.temporada} · {c.competicion} · visto en {c.alineaciones + c.eventos} actas
                    </small>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {j.historial.length > 0 && (
            <ul className={styles.lista} aria-label="Historial apuntado">
              {j.historial.map((linea) => (
                <li key={linea}>
                  <span>{linea}</span>
                </li>
              ))}
            </ul>
          )}
          <p className={styles.nota}>
            La federación no publica los clubes anteriores de cada jugador: salen de las actas en
            las que se le ha visto y del historial apuntado en su ficha.
          </p>
        </section>
      )}
    </article>
  );
}
