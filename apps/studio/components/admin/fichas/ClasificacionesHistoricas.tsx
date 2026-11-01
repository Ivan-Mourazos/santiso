"use client";
import { esEquipoPropio } from "@santiso/domain";
import type { TemporadaDeArchivo } from "@/lib/server/consultas/fichas-rfgf";
import styles from "./Fichas.module.css";
export default function ClasificacionesHistoricas({
  temporadas,
}: {
  temporadas: TemporadaDeArchivo[];
}) {
  return (
    <section className={styles.bloque} aria-label="Clasificaciones">
      <h3>Clasificaciones</h3>
      {temporadas.map((t) => (
        <div key={t.temporada} className={styles.bloque}>
          <h4 className={styles.tituloClasificacion}>{t.temporada}</h4>
          {t.grupos.map((g) => {
            const c = g.clasificacion;
            const propio = c?.filas?.find((f) => esEquipoPropio(f.equipo));
            if (!c || c.estado !== "leido")
              return (
                <div key={g.codGrupo} className={styles.resumenClasificacion}>
                  <strong>{g.competicion}</strong>
                  <p className={styles.nota}>
                    {!c || c.estado === "pendiente"
                      ? "Buscando…"
                      : c.estado === "error"
                        ? "No se pudo leer"
                        : "Sin datos publicados"}
                  </p>
                  {c?.aviso && <p className={styles.nota}>{c.aviso}</p>}
                </div>
              );
            if (c.formato === "copa")
              return (
                <p key={g.codGrupo} className={styles.resumenClasificacion}>
                  {g.competicion}: llegó a {c.ronda}
                </p>
              );
            return (
              <details key={g.codGrupo} className={styles.clasificacionHistorica}>
                <summary>
                  <strong>{g.competicion}</strong>
                  {propio && (
                    <span>
                      {propio.posicion}.º · {propio.puntos} puntos · PJ {propio.jugados} · G{" "}
                      {propio.ganados} · E {propio.empatados} · P {propio.perdidos} · GF{" "}
                      {propio.golesFavor} · GC {propio.golesContra}
                    </span>
                  )}
                </summary>
                <div
                  className={styles.tablaCaja}
                  tabIndex={0}
                  role="region"
                  aria-label={`Tabla final de ${g.competicion}`}
                >
                  <table className={`${styles.tabla} ${styles.tablaClasificacion}`}>
                    <caption>Clasificación · Jornada {c.jornada}</caption>
                    <thead>
                      <tr>
                        {["Equipo", "Puesto", "Pts", "PJ", "G", "E", "P", "GF", "GC"].map((c) => (
                          <th key={c} scope="col">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {c.filas?.map((f) => (
                        <tr key={f.equipo} data-propio={esEquipoPropio(f.equipo)}>
                          <th scope="row">{f.equipo}</th>
                          <td>{f.posicion}</td>
                          <td>{f.puntos}</td>
                          <td>{f.jugados}</td>
                          <td>{f.ganados}</td>
                          <td>{f.empatados}</td>
                          <td>{f.perdidos}</td>
                          <td>{f.golesFavor}</td>
                          <td>{f.golesContra}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            );
          })}
        </div>
      ))}
    </section>
  );
}
