/* eslint-disable @next/next/no-img-element -- el cartel se exporta como imagen: sin optimizador */
import type { CSSProperties } from "react";
import { categoriaCartel, type DatosClasificacion } from "@/lib/cartel2/modelo";
import { Base } from "./Base";
import b from "./Base.module.css";
import s from "./CartelClasificacion.module.css";

/**
 * Clasificación: tabla de liga con el Santiso resaltado en amarillo, o el cuadro de una copa
 * por rondas. Las filas se ajustan al número de equipos.
 */
export function CartelClasificacion({ datos }: { datos: DatosClasificacion }) {
  return (
    <Base
      variante="club"
      izquierda={{ escudo: datos.escudoClub, propio: true, color: "#f5c518" }}
      institucionales={datos.institucionales}
      patrocinadores={datos.patrocinadores}
    >
      <header className={b.cabecera}>
        <div className={b.xornada}>CLASIFICACIÓN</div>
        <div className={b.competicion}>
          {categoriaCartel(datos.categoria)}
          {datos.titulo ? ` · ${datos.titulo.toUpperCase()}` : ""}
        </div>
      </header>
      {datos.tipo === "liga" ? <Tabla datos={datos} /> : <Cuadro datos={datos} />}
    </Base>
  );
}

function Tabla({ datos }: { datos: Extract<DatosClasificacion, { tipo: "liga" }> }) {
  const filas = datos.filas.slice(0, 20);
  const alto = Math.max(40, Math.min(64, Math.floor(930 / (filas.length + 1))));
  const estilo = { "--fila": `${alto}px` } as CSSProperties;
  return (
    <table className={s.tabla} style={estilo}>
      <thead>
        <tr>
          <th className={s.pos} />
          <th className={s.equipo} />
          <th>PJ</th>
          <th>G</th>
          <th>E</th>
          <th>P</th>
          <th>DG</th>
          <th className={s.pts}>PTS</th>
        </tr>
      </thead>
      <tbody>
        {filas.map((f) => (
          <tr key={`${f.posicion}-${f.nombre}`} className={f.propio ? s.propio : undefined}>
            <td className={`${b.display} ${s.pos}`}>{f.posicion}</td>
            <td className={s.equipo}>
              <span className={s.celdaEquipo}>
                {f.escudo ? <img src={f.escudo} alt="" /> : <span className={s.sinEscudo} />}
                <span className={s.nombre}>{f.nombre.toUpperCase()}</span>
              </span>
            </td>
            <td>{f.pj}</td>
            <td>{f.pg}</td>
            <td>{f.pe}</td>
            <td>{f.pp}</td>
            <td>{f.gf - f.gc > 0 ? `+${f.gf - f.gc}` : f.gf - f.gc}</td>
            <td className={`${b.display} ${s.pts}`}>{f.pts}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Cuadro({ datos }: { datos: Extract<DatosClasificacion, { tipo: "copa" }> }) {
  // Las últimas rondas son las que interesan: como mucho cuatro.
  const rondas = datos.rondas.slice(-4);
  return (
    <div className={s.cuadro}>
      {rondas.map((r) => (
        <section key={r.nombre} className={s.ronda}>
          <h2 className={b.display}>{r.nombre.toUpperCase()}</h2>
          <ul>
            {r.partidos.map((p, i) => (
              <li key={`${p.local}-${p.visitante}-${i}`}>
                <span className={s.equipoCopa}>{p.local.toUpperCase()}</span>
                <span className={`${b.display} ${s.marcadorCopa}`}>
                  {p.golesLocal === null || p.golesVisitante === null
                    ? "–"
                    : `${p.golesLocal}-${p.golesVisitante}`}
                </span>
                <span className={`${s.equipoCopa} ${s.derecha}`}>{p.visitante.toUpperCase()}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
