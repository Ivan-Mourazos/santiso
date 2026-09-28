/* eslint-disable @next/next/no-img-element -- el cartel se exporta como imagen: sin optimizador */
import {
  categoriaCartel,
  cuerpo,
  fechaCorta,
  goleadores,
  type DatosResultado,
} from "@/lib/cartel2/modelo";
import { Balon } from "./Balon";
import { Base } from "./Base";
import b from "./Base.module.css";
import s from "./CartelResultado.module.css";

/**
 * Cartel de resultado: escudos a los lados, marcador enorme en el centro (el del Santiso en
 * amarillo) y goleadores de cada equipo en su columna. Con foto, la foto es el fondo.
 */
export function CartelResultado({ datos }: { datos: DatosResultado }) {
  const golesPorLado = {
    local: goleadores(datos.goles, "local"),
    visitante: goleadores(datos.goles, "visitante"),
  };
  const muchos = Math.max(golesPorLado.local.length, golesPorLado.visitante.length) > 5;
  const cuerpoMarcador = Math.max(datos.golesLocal, datos.golesVisitante) >= 10 ? 190 : 250;
  const nombre = (texto: string) => ({ fontSize: cuerpo(texto, 360, 36, 22, 0.5) });
  const pie = [fechaCorta(datos.fecha), datos.campo.toUpperCase()].filter(Boolean).join("  ·  ");

  return (
    <Base
      variante="centro"
      izquierda={datos.local}
      derecha={datos.visitante}
      foto={datos.foto}
      institucionales={datos.institucionales}
      patrocinadores={datos.patrocinadores}
      className={datos.foto ? s.conFoto : undefined}
    >
      <header className={b.cabecera}>
        <div className={b.xornada}>{datos.jornada ? `XORNADA ${datos.jornada}` : "RESULTADO"}</div>
        <div className={b.competicion}>
          {categoriaCartel(datos.categoria)}
          {datos.competicion ? ` · ${datos.competicion.toUpperCase()}` : ""}
        </div>
      </header>

      <div className={s.etiqueta}>RESULTADO FINAL</div>

      {datos.local.escudo && (
        <img className={`${b.escudo} ${s.escudoLocal}`} src={datos.local.escudo} alt="" />
      )}
      {datos.visitante.escudo && (
        <img className={`${b.escudo} ${s.escudoVisitante}`} src={datos.visitante.escudo} alt="" />
      )}

      <div className={`${b.display} ${s.marcador}`} style={{ fontSize: cuerpoMarcador }}>
        <span className={datos.local.propio ? s.propio : undefined}>{datos.golesLocal}</span>
        <span className={s.guion}>–</span>
        <span className={datos.visitante.propio ? s.propio : undefined}>
          {datos.golesVisitante}
        </span>
      </div>

      <div className={`${b.nombre} ${s.nombreLocal}`} style={nombre(datos.local.nombre)}>
        {datos.local.nombre.toUpperCase()}
      </div>
      <div className={`${b.nombre} ${s.nombreVisitante}`} style={nombre(datos.visitante.nombre)}>
        {datos.visitante.nombre.toUpperCase()}
      </div>

      {(["local", "visitante"] as const).map((lado) => (
        <ul
          key={lado}
          className={`${s.goles} ${lado === "local" ? s.golesLocal : s.golesVisitante} ${muchos ? s.golesMuchos : ""}`}
        >
          {golesPorLado[lado].map((g) => (
            <li key={g.nombre}>
              <Balon tamano={muchos ? 22 : 26} />
              <span className={s.goleador}>{g.nombre.toUpperCase()}</span>
              <span className={s.minutos}>{g.minutos.join(", ")}</span>
            </li>
          ))}
        </ul>
      ))}

      {pie && <div className={`${b.dato} ${s.pie}`}>{pie}</div>}
    </Base>
  );
}
