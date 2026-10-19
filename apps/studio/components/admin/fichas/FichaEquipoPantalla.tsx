"use client";
/* eslint-disable @next/next/no-img-element -- escudos de la media local */
import { useEffect, useState } from "react";
import { EmptyState, LoadingState } from "@/components/ui/foundation/States";
import { cargarFichaDeEquipo } from "@/lib/server/acciones/fichas-rfgf";
import type { FichaDeEquipo } from "@/lib/server/consultas/fichas-rfgf";
import { Resultado, fechaCorta } from "./comunes";
import styles from "./Fichas.module.css";

/** «Amarilla · negro · negras» con las bolitas de color delante. */
function Equipacion({ club }: { club: NonNullable<FichaDeEquipo["club"]> }) {
  const e = club.equipacion;
  const palabras = [e.camiseta, e.pantalon, e.medias].filter(Boolean);
  if (palabras.length === 0) return <>Sin equipación publicada</>;
  return (
    <>
      <span className={styles.colores} aria-hidden="true">
        {[e.color, e.color2].filter(Boolean).map((c) => (
          <span key={c} style={{ background: c! }} />
        ))}
      </span>
      Camiseta {e.camiseta?.toLowerCase() ?? "—"} · pantalón {e.pantalon?.toLowerCase() ?? "—"} ·
      medias {e.medias?.toLowerCase() ?? "—"}
    </>
  );
}

/**
 * Ficha de un equipo: de dónde es, sus colores y su campo (de la federación y de sus partidos),
 * qué tal le va esta temporada y todo lo que ha jugado contra el Santiso.
 */
export default function FichaEquipoPantalla({ equipoId }: { equipoId: string | null }) {
  const [estado, setEstado] = useState<{
    id: string;
    ficha: FichaDeEquipo | null;
    error: string | null;
  } | null>(null);
  useEffect(() => {
    if (!equipoId) return;
    let vigente = true;
    void cargarFichaDeEquipo(equipoId).then((r) => {
      if (!vigente) return;
      setEstado({ id: equipoId, ficha: r.ok ? r.datos : null, error: r.ok ? null : r.error });
    });
    return () => {
      vigente = false;
    };
  }, [equipoId]);

  if (!equipoId) return <EmptyState title="Elige un equipo desde la clasificación o Partidos." />;
  if (!estado || estado.id !== equipoId) return <LoadingState title="Cargando la ficha…" />;
  if (estado.error) return <EmptyState title={estado.error} />;
  const f = estado.ficha;
  if (!f) return <EmptyState title="Ese equipo ya no está." />;
  const club = f.club;
  const lugar = [club?.localidad, club?.provincia].filter(Boolean).join(", ");
  const t = f.contraSantiso.totales;

  return (
    <article className={styles.ficha} aria-label={`Ficha de ${f.equipo.nombre}`}>
      <header className={styles.cabecera}>
        {f.equipo.escudoUrl ? (
          <img className={styles.imagen} src={f.equipo.escudoUrl} alt="" />
        ) : (
          <span className={styles.sinImagen} aria-hidden="true" />
        )}
        <div className={styles.nombre}>
          <h2>{f.equipo.nombre}</h2>
          <p>{lugar || "Localidad sin datos de la federación"}</p>
          <div className={styles.chips}>
            <span className={`${styles.chip} ${styles.chipAcento}`}>{f.equipo.categoria}</span>
            {f.equipo.propio && <span className={styles.chip}>Nuestro</span>}
          </div>
        </div>
      </header>

      <section className={styles.bloque} aria-label="Club">
        <h3>Club</h3>
        <dl className={styles.datos}>
          {club ? (
            <>
              <div>
                <dt>Equipación</dt>
                <dd>
                  <Equipacion club={club} />
                </dd>
              </div>
              {club.direccion && (
                <div>
                  <dt>Dirección</dt>
                  <dd>
                    {club.direccion}
                    {club.codigoPostal ? ` · ${club.codigoPostal}` : ""}
                  </dd>
                </div>
              )}
              {(club.fechaFundacion || club.fechaInscripcionFederacion) && (
                <div>
                  <dt>{club.fechaFundacion ? "Fundado" : "Inscrito"}</dt>
                  <dd>{fechaCorta(club.fechaFundacion ?? club.fechaInscripcionFederacion)}</dd>
                </div>
              )}
              {club.numeroEquipos !== null && (
                <div>
                  <dt>Equipos</dt>
                  <dd>{club.numeroEquipos} en la federación</dd>
                </div>
              )}
            </>
          ) : (
            <div>
              <dt>Federación</dt>
              <dd>Sin enlazar todavía con su club de la federación</dd>
            </div>
          )}
          <div>
            <dt>Campo</dt>
            <dd>
              {f.campoHabitual
                ? `${f.campoHabitual.nombre}${f.campoHabitual.poblacion ? ` · ${f.campoHabitual.poblacion}` : ""}`
                : "Sin partidos en casa apuntados"}
            </dd>
          </div>
        </dl>
      </section>

      {!f.equipo.propio && (
        <section className={styles.bloque} aria-label="Contra el Santiso">
          <h3>Contra el Santiso</h3>
          {t.jugados === 0 ? (
            <p className={styles.nota}>Todavía no hay partidos contra el Santiso en el Studio.</p>
          ) : (
            <>
              <div className={styles.cuadros}>
                {(
                  [
                    ["Jugados", t.jugados],
                    ["Ganados", t.ganados],
                    ["Empatados", t.empatados],
                    ["Perdidos", t.perdidos],
                    ["Goles", `${t.golesFavor}–${t.golesContra}`],
                  ] as const
                ).map(([nombre, valor]) => (
                  <div key={nombre} className={styles.cuadro}>
                    <strong>{valor}</strong>
                    <span>{nombre}</span>
                  </div>
                ))}
              </div>
              <ul className={styles.lista}>
                {f.contraSantiso.partidos.map((p) => (
                  <li key={p.id}>
                    <span>
                      {p.local} – {p.visitante}
                      <small>
                        {p.temporada} · {p.competicion} · J{p.jornada} · {fechaCorta(p.fecha)}
                      </small>
                    </span>
                    <span className={styles.marcador}>
                      {p.golesLocal ?? "–"}–{p.golesVisitante ?? "–"}
                      <Resultado r={p.resultado} />
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {f.jugadoresVistos.length > 0 && (
        <section className={styles.bloque} aria-label="Jugadores vistos en actas">
          <h3>Sus jugadores esta temporada</h3>
          <ul className={styles.lista}>
            {f.jugadoresVistos.map((j) => (
              <li key={j.persona}>
                <span>
                  {j.dorsal !== null ? `${j.dorsal} · ` : ""}
                  {j.persona}
                  <small>
                    {j.partidos} {j.partidos === 1 ? "partido" : "partidos"}
                    {j.titular ? ` · ${j.titular} de titular` : ""}
                    {j.amarillas ? ` · ${j.amarillas} amarillas` : ""}
                    {j.rojas ? ` · ${j.rojas} rojas` : ""}
                  </small>
                </span>
                {j.goles > 0 && (
                  <span className={styles.marcador} aria-label={`${j.goles} goles`}>
                    {j.goles}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {f.temporada.map(({ competicionId, competicion, ficha }) => {
        const ultimos = ficha.jugados.slice(0, 5);
        const goleadores = ficha.goleadores.slice(0, 5);
        return (
          <section key={competicionId} className={styles.bloque} aria-label={competicion}>
            <h3>Esta temporada · {competicion}</h3>
            {ultimos.length > 0 && (
              <ul className={styles.lista} aria-label="Últimos partidos">
                {ultimos.map((p) => {
                  const r = p.goles > p.golesRival ? "G" : p.goles < p.golesRival ? "P" : "E";
                  return (
                    <li key={p.id}>
                      <span>
                        {p.casa ? "vs" : "en"} {p.rival}
                        <small>
                          J{p.jornada} · {fechaCorta(p.fecha)}
                        </small>
                      </span>
                      <span className={styles.marcador}>
                        {p.goles}–{p.golesRival}
                        <Resultado r={r} />
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            {ficha.pendientes[0] && (
              <p className={styles.nota}>
                Próximo: J{ficha.pendientes[0].jornada} {ficha.pendientes[0].casa ? "vs" : "en"}{" "}
                {ficha.pendientes[0].rival} · {fechaCorta(ficha.pendientes[0].fecha)}
              </p>
            )}
            {goleadores.length > 0 && (
              <ul className={styles.lista} aria-label="Goleadores">
                {goleadores.map((g) => (
                  <li key={g.persona}>
                    <span>{g.persona}</span>
                    <span className={styles.marcador}>{g.goles}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className={styles.nota}>
              Tarjetas: {ficha.tarjetas.amarillas} amarillas · {ficha.tarjetas.rojas} rojas
            </p>
          </section>
        );
      })}
    </article>
  );
}
