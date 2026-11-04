"use client";
import { esEquipoPropio } from "@santiso/domain";
import type { GrupoDeArchivo } from "@/lib/server/consultas/fichas-rfgf";
import styles from "./Fichas.module.css";

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
