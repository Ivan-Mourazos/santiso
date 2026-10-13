/* eslint-disable @next/next/no-img-element -- el cartel se exporta como imagen: sin optimizador */
import type { CSSProperties } from "react";
import { categoriaCartel, cuerpo, type DatosClasificacion } from "@/lib/cartel2/modelo";
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
      compacto
      variante="club"
      izquierda={{ escudo: datos.escudoClub, propio: true, color: "#f5c518" }}
      institucionales={datos.institucionales}
      patrocinadores={datos.patrocinadores}
    >
      <header className={b.cabecera} data-lectura-bloque>
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

/** Alto útil de la tabla (260–1180) y ancho de la columna del equipo sin escudo ni márgenes. */
const ALTO_TABLA = 920;
const ANCHO_EQUIPO = 520 - 12 - 14;
/** Ancho medio de una letra del nombre (negrita cursiva en mayúsculas), en em. */
const EM_NOMBRE = 0.46;

function Tabla({ datos }: { datos: Extract<DatosClasificacion, { tipo: "liga" }> }) {
  const filas = datos.filas;
  // La tabla tiene 920 px de alto: la cabecera ocupa 0,7 filas. Con 14 equipos cada fila mide
  // 60 px; con 16 o 20 encoge lo justo para que quepan todos.
  const alto = Math.max(34, Math.min(60, Math.floor(ALTO_TABLA / (filas.length + 0.7))));
  const letra = Math.round(alto * 0.56);
  // El nombre va siempre en una línea: el que no cabe baja de cuerpo, no parte la fila.
  const anchoNombre = ANCHO_EQUIPO - alto * 0.75;
  const estilo = { "--fila": `${alto}px` } as CSSProperties;
  return (
    <table className={s.tabla} style={estilo} data-lectura-bloque>
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
          <tr
            key={`${f.posicion}-${f.nombre}`}
            className={f.propio ? s.propio : undefined}
            data-lectura-fila
          >
            <td className={`${b.display} ${s.pos}`}>{f.posicion}</td>
            <td className={s.equipo}>
              <span className={s.celdaEquipo}>
                {f.escudo ? <img src={f.escudo} alt="" /> : <span className={s.sinEscudo} />}
                <span
                  className={s.nombre}
                  style={{
                    fontSize: cuerpo(f.nombre.toUpperCase(), anchoNombre, letra, 16, EM_NOMBRE),
                  }}
                  data-lectura-columna
                >
                  {f.nombre.toUpperCase()}
                </span>
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
  // Con pocos partidos (una final, unas semifinales) todo va en grande y en una columna.
  const pocos = rondas.reduce((n, r) => n + r.partidos.length, 0) <= 4;
  const esSantiso = (nombre: string) => nombre.toLowerCase().includes("santiso");
  return (
    <div className={`${s.cuadro} ${pocos ? s.cuadroGrande : ""}`} data-lectura-bloque>
      {rondas.map((r) => (
        <section key={r.nombre} className={s.ronda}>
          <h2 className={b.display}>{r.nombre.toUpperCase()}</h2>
          <ul>
            {r.partidos.map((p, i) => (
              <li
                data-lectura-fila
                key={`${p.local}-${p.visitante}-${i}`}
                className={
                  esSantiso(p.local) || esSantiso(p.visitante) ? s.partidoPropio : undefined
                }
              >
                <span className={s.equipoCopa} data-lectura-columna>
                  {p.local.toUpperCase()}
                </span>
                <span className={`${b.display} ${s.marcadorCopa}`}>
                  {p.golesLocal === null || p.golesVisitante === null
                    ? "–"
                    : `${p.golesLocal}-${p.golesVisitante}`}
                </span>
                <span className={`${s.equipoCopa} ${s.derecha}`} data-lectura-columna>
                  {p.visitante.toUpperCase()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
