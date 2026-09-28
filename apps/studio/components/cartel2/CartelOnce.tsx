/* eslint-disable @next/next/no-img-element -- el cartel se exporta como imagen: sin optimizador */
import { categoriaCartel, cuerpo, fechaCorta, type DatosOnce } from "@/lib/cartel2/modelo";
import { Base } from "./Base";
import b from "./Base.module.css";
import s from "./CartelOnce.module.css";

/**
 * O Noso 11: foto (de un jugador o del equipo) a un lado, fundida con el fondo, y el once
 * con dorsal y nombre al otro, con los suplentes debajo. Sin foto, el escudo del club.
 */
export function CartelOnce({ datos }: { datos: DatosOnce }) {
  const titulares = datos.titulares.slice(0, 11);
  const suplentes = datos.suplentes;
  const alto = Math.min(64, Math.floor(620 / Math.max(titulares.length, 1)));
  const subtitulo = [
    datos.rival ? `VS ${datos.rival.nombre.toUpperCase()}` : "",
    fechaCorta(datos.fecha),
  ]
    .filter(Boolean)
    .join("  ·  ");
  const nombreMasLargo = titulares.reduce(
    (a, j) => (j.nombre.length > a.length ? j.nombre : a),
    "",
  );
  const cuerpoNombre = cuerpo(nombreMasLargo, 400, Math.round(alto * 0.52), 20, 0.5);

  return (
    <Base
      variante="club"
      izquierda={datos.foto ? null : datos.club}
      logosArriba="centro"
      institucionales={datos.institucionales}
      patrocinadores={datos.patrocinadores}
      className={datos.invertido ? s.invertido : undefined}
    >
      <div className={s.retrato}>
        {datos.foto ? (
          <img
            className={s.foto}
            src={datos.foto.url}
            alt=""
            style={{
              objectPosition: `${datos.foto.x * 100}% ${datos.foto.y * 100}%`,
              transform: `scale(${datos.foto.zoom || 1})`,
              transformOrigin: `${datos.foto.x * 100}% ${datos.foto.y * 100}%`,
            }}
          />
        ) : (
          datos.club.escudo && (
            <img className={`${b.escudo} ${s.escudoClub}`} src={datos.club.escudo} alt="" />
          )
        )}
      </div>

      <section className={s.lista}>
        <div className={s.categoria}>
          {categoriaCartel(datos.categoria)}
          {datos.jornada ? ` · XORNADA ${datos.jornada}` : ""}
        </div>
        <div className={`${b.display} ${s.titulo}`}>O NOSO 11</div>
        {subtitulo && <div className={s.subtitulo}>{subtitulo}</div>}

        <ol className={s.titulares}>
          {titulares.map((j, i) => (
            <li key={`${j.dorsal}-${i}`} style={{ height: alto }}>
              <span className={`${b.display} ${s.dorsal}`}>{j.dorsal}</span>
              <span className={s.nombre} style={{ fontSize: cuerpoNombre }}>
                {j.nombre.toUpperCase()}
              </span>
              {j.capitan && <span className={s.capitan}>C</span>}
            </li>
          ))}
        </ol>

        {suplentes.length > 0 && (
          <div className={s.suplentes}>
            <span className={s.etiquetaSuplentes}>SUPLENTES</span>
            {suplentes.map((j) => `${j.dorsal ? `${j.dorsal} ` : ""}${j.nombre}`).join("  ·  ")}
          </div>
        )}
      </section>
    </Base>
  );
}
