/* eslint-disable @next/next/no-img-element -- el cartel se exporta como imagen: sin optimizador */
import {
  categoriaCartel,
  cuerpo,
  fechaCorta,
  urlFoto,
  type DatosOnce,
} from "@/lib/cartel2/modelo";
import { Escudo } from "./Escudo";
import { Base } from "./Base";
import b from "./Base.module.css";
import s from "./CartelOnce.module.css";

/** Ancho de un nombre: media lista (952 − 24 de calle) menos dorsal y separación. */
const ANCHO_NOMBRE = (952 - 24) / 2 - 62 - 14;
/** Con retrato la lista mide 620 y va en una columna. */
const ANCHO_NOMBRE_RETRATO = 620 - 62 - 14;
/** Ancho medio de una letra del nombre (Barlow Condensed 800 en mayúsculas), en em. */
const EM_NOMBRE = 0.47;

/**
 * O Noso 11: foto (de un jugador o del equipo) a un lado, fundida con el fondo, y el once
 * con dorsal y nombre al otro, con los suplentes debajo. Sin foto, el escudo del club.
 */
export function CartelOnce({ datos }: { datos: DatosOnce }) {
  const titulares = datos.titulares.slice(0, 11);
  const suplentes = datos.suplentes;
  // Con retrato de jugador la foto se ve a un lado y el once va en una sola columna; con foto
  // de campo (o sin foto) la lista ocupa todo el ancho, en dos columnas.
  const retrato = !!datos.foto && datos.modoFoto === "retrato";
  const columnas = retrato ? [titulares] : [titulares.slice(0, 6), titulares.slice(6)];
  const anchoNombre = retrato ? ANCHO_NOMBRE_RETRATO : ANCHO_NOMBRE;
  const filas = retrato ? titulares.length : 6;
  const subtitulo = [
    datos.rival ? `VS ${datos.rival.nombre.toUpperCase()}` : "",
    fechaCorta(datos.fecha),
  ]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <Base
      compacto
      variante="club"
      foto={
        datos.foto && datos.modoFoto === "fondo"
          ? {
              url: datos.foto.url,
              x: datos.foto.x,
              y: datos.foto.y,
              zoom: datos.foto.zoom,
              estilo: "color",
            }
          : null
      }
      izquierda={datos.foto ? null : datos.club}
      logosArriba="centro"
      institucionales={datos.institucionales}
      patrocinadores={datos.patrocinadores}
      className={`${datos.invertido ? s.invertido : ""} ${retrato ? s.conRetrato : `${s.listaAmplia} ${s.sinFoto}`}`}
    >
      <div className={s.retrato}>
        {datos.foto ? (
          <img
            className={s.foto}
            src={urlFoto(datos.foto.url)}
            alt=""
            style={{
              objectPosition: `${datos.foto.x * 100}% ${datos.foto.y * 100}%`,
              transform: `scale(${datos.foto.zoom || 1})`,
              transformOrigin: `${datos.foto.x * 100}% ${datos.foto.y * 100}%`,
            }}
          />
        ) : (
          datos.club.escudo && (
            <Escudo
              className={`${b.escudo} ${s.escudoClub}`}
              src={datos.club.escudo}
              relieve={datos.club.relieve}
            />
          )
        )}
      </div>

      <section className={s.lista}>
        <div className={s.cabecera} data-lectura-bloque>
          <div className={s.categoria}>
            {categoriaCartel(datos.categoria)}
            {datos.jornada ? ` · XORNADA ${datos.jornada}` : ""}
          </div>
          <div className={`${b.display} ${s.titulo}`}>O NOSO 11</div>
          {subtitulo && (
            <div className={s.subtitulo} data-lectura-columna>
              {subtitulo}
            </div>
          )}
        </div>

        <div className={s.titulares} data-lectura-bloque>
          {columnas.map((columna, c) => (
            <ol key={c}>
              {columna.map((j, i) => (
                <li key={`${j.dorsal}-${i}`} data-lectura-fila>
                  <span className={`${b.display} ${s.dorsal}`}>{j.dorsal}</span>
                  <span
                    className={s.nombre}
                    style={{
                      fontSize: cuerpo(
                        j.nombre.toUpperCase(),
                        anchoNombre - (j.capitan ? 36 : 0),
                        retrato ? 40 : 44,
                        24,
                        EM_NOMBRE,
                      ),
                    }}
                    data-lectura-columna
                  >
                    {j.nombre.toUpperCase()}
                    {j.capitan && <span className={s.capitan}> C</span>}
                  </span>
                </li>
              ))}
              {/* La columna corta se completa con filas vacías: así las dos reparten su altura
                  igual y cada nombre queda a la altura de su vecino. */}
              {Array.from({ length: Math.max(0, filas - columna.length) }, (_, i) => (
                <li key={`hueco-${i}`} className={s.hueco} aria-hidden="true" />
              ))}
            </ol>
          ))}
        </div>

        {suplentes.length > 0 && (
          <div className={s.suplentes} data-lectura-bloque>
            <span className={s.etiquetaSuplentes}>SUPLENTES</span>
            <div className={s.listaSuplentes}>
              {suplentes.map((j, i) => (
                <span key={i} data-lectura-columna>
                  <b>{j.dorsal}</b> {j.nombre}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>
    </Base>
  );
}
