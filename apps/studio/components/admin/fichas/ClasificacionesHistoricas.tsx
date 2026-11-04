"use client";
import { esEquipoPropio } from "@santiso/domain";
import type { GrupoDeArchivo, TemporadaDeArchivo } from "@/lib/server/consultas/fichas-rfgf";
import {
  elegirLigaPrincipal,
  esCopa,
  estadoClasificacion,
  filaSantiso,
  nombreCompeticion,
} from "@/lib/archivo-historico";
import styles from "./Fichas.module.css";

export default function ClasificacionesHistoricas({
  temporadas,
}: {
  temporadas: TemporadaDeArchivo[];
}) {
  return (
    <section className={styles.bloque} aria-label="Trayectoria">
      <h3>Trayectoria</h3>
      <ul className={styles.trayectoriaMovil}>
        {temporadas.map((t) => {
          const liga = elegirLigaPrincipal(t.grupos);
          const propio = liga && filaSantiso(liga);
          const copas = t.grupos.filter(esCopa);
          const nombre = liga ? nombreCompeticion(liga, t.grupos).replace(" · ", " (") : "Sin liga";
          return (
            <li key={t.temporada}>
              <strong>
                {t.temporada.replace(/-(\d{2})(\d{2})$/, "-$2")} · {nombre}
                {nombre.includes(" (") ? ")" : ""}
              </strong>
              <span>
                {propio
                  ? `${propio.posicion}.º · ${propio.puntos} pts`
                  : liga
                    ? estadoClasificacion(liga)
                    : "Sin liga"}
                {copas.length > 0 &&
                  ` · Copa: ${copas.map((g) => (g.clasificacion?.estado === "leido" && g.clasificacion.ronda ? g.clasificacion.ronda : estadoClasificacion(g))).join(" / ")}`}
              </span>
            </li>
          );
        })}
      </ul>
      <div
        className={`${styles.tablaCaja} ${styles.trayectoriaEscritorio}`}
        tabIndex={0}
        role="region"
        aria-label="Trayectoria por temporada"
      >
        <table className={`${styles.tabla} ${styles.trayectoria}`}>
          <thead>
            <tr>
              {["Temporada", "Liga", "Puesto", "Pts", "Copa"].map((titulo) => (
                <th key={titulo} scope="col">
                  {titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {temporadas.map((t) => {
              const liga = elegirLigaPrincipal(t.grupos);
              const propio = liga && filaSantiso(liga);
              const copas = t.grupos.filter(esCopa);
              return (
                <tr key={t.temporada}>
                  <th scope="row">{t.temporada}</th>
                  <td>{liga ? nombreCompeticion(liga, t.grupos) : "Sin liga"}</td>
                  <td>
                    {propio ? (
                      `${propio.posicion}.º`
                    ) : liga ? (
                      <span className={styles.nota}>{estadoClasificacion(liga)}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{propio ? propio.puntos : "—"}</td>
                  <td>
                    {copas.length
                      ? copas.map((g) => (
                          <span
                            key={g.codGrupo}
                            className={styles.copaTrayectoria}
                            title={nombreCompeticion(g, t.grupos)}
                          >
                            {g.clasificacion?.estado === "leido" && g.clasificacion.ronda
                              ? g.clasificacion.ronda
                              : estadoClasificacion(g)}
                          </span>
                        ))
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function TablaFinal({ grupo: g, nombre }: { grupo: GrupoDeArchivo; nombre: string }) {
  const c = g.clasificacion;
  return (
    <div
      className={styles.tablaCaja}
      tabIndex={0}
      role="region"
      aria-label={`Tabla final de ${nombre}`}
    >
      <table className={`${styles.tabla} ${styles.tablaClasificacion}`}>
        <caption>Clasificación{c?.jornada ? ` · Jornada ${c.jornada}` : ""}</caption>
        <thead>
          <tr>
            {["Pos", "Equipo", "Pts", "PJ", "DG", "G", "E", "P", "GF", "GC"].map((titulo) => (
              <th
                key={titulo}
                scope="col"
                className={
                  ["G", "E", "P", "GF", "GC"].includes(titulo) ? styles.columnaAmpliada : undefined
                }
              >
                {titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {c?.filas?.map((f) => (
            <tr key={f.equipo} data-propio={esEquipoPropio(f.equipo)}>
              <td>{f.posicion}</td>
              <th scope="row">{f.equipo}</th>
              <td>{f.puntos}</td>
              <td>{f.jugados}</td>
              <td>{f.golesFavor - f.golesContra}</td>
              <td className={styles.columnaAmpliada}>{f.ganados}</td>
              <td className={styles.columnaAmpliada}>{f.empatados}</td>
              <td className={styles.columnaAmpliada}>{f.perdidos}</td>
              <td className={styles.columnaAmpliada}>{f.golesFavor}</td>
              <td className={styles.columnaAmpliada}>{f.golesContra}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
