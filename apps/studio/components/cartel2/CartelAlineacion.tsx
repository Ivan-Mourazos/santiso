import {
  categoriaCartel,
  cuerpo,
  fechaCorta,
  type DatosAlineacion,
  type EquipoCartel,
} from "@/lib/cartel2/modelo";
import { Base } from "./Base";
import b from "./Base.module.css";
import { Escudo } from "./Escudo";
import s from "./CartelAlineacion.module.css";

function Equipo({ equipo }: { equipo: EquipoCartel }) {
  return (
    <div className={s.equipo}>
      {equipo.escudo ? (
        <Escudo className={s.escudo} src={equipo.escudo} relieve={equipo.relieve} />
      ) : (
        <div className={s.sinEscudo} />
      )}
      <div
        className={`${s.nombreEquipo} ${equipo.propio ? s.propio : ""}`}
        style={{ fontSize: cuerpo(equipo.nombre, 400, 30, 20, 0.5) }}
      >
        {equipo.nombre.toUpperCase()}
      </div>
    </div>
  );
}

/**
 * Alineación para historia de Instagram (9:16), antes del partido: el cruce con los dos
 * escudos, cuándo y dónde, el once con dorsal y capitán, y los suplentes. Todo lo que hay que
 * leer queda fuera de las franjas que tapa Instagram (ver `MARGEN_HISTORIA`).
 */
export function CartelAlineacion({ datos }: { datos: DatosAlineacion }) {
  const titulares = datos.titulares.slice(0, 11);
  const suplentes = datos.suplentes.slice(0, 12);
  const [local, visitante] = datos.local ? [datos.club, datos.rival] : [datos.rival, datos.club];
  const cuando = [fechaCorta(datos.fecha), datos.hora, datos.campo.toUpperCase()]
    .filter(Boolean)
    .join(" · ");
  const competicion = [
    categoriaCartel(datos.categoria),
    datos.jornada ? `XORNADA ${datos.jornada}` : "",
    datos.competicion.toUpperCase(),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Base
      variante="club"
      historia
      izquierda={datos.club}
      logosArriba="centro"
      institucionales={datos.institucionales}
      patrocinadores={datos.patrocinadores}
    >
      <div className={s.contenido} data-sin-patrocinadores={datos.patrocinadores.length === 0}>
        <header className={s.cabecera}>
          <div className={s.competicion}>{competicion}</div>
          <div className={`${b.display} ${s.titulo}`}>ONCE INICIAL</div>
        </header>

        <div className={s.cruce}>
          <Equipo equipo={local} />
          <div className={`${b.display} ${s.vs}`}>VS</div>
          <Equipo equipo={visitante} />
        </div>
        {cuando && <div className={s.cuando}>{cuando}</div>}

        <ol className={s.titulares}>
          {titulares.map((j, i) => (
            <li key={`${j.dorsal}-${i}`}>
              <span className={`${b.display} ${s.dorsal}`}>{j.dorsal}</span>
              <span className={s.nombre} style={{ fontSize: cuerpo(j.nombre, 760, 46, 30, 0.5) }}>
                {j.nombre.toUpperCase()}
              </span>
              {j.capitan && <span className={s.capitan}>C</span>}
            </li>
          ))}
        </ol>

        {suplentes.length > 0 && (
          <div className={s.suplentes}>
            <span className={s.etiquetaSuplentes}>SUPLENTES</span>
            {suplentes.map((j, i) => (
              <span key={`${j.dorsal}-${i}`} className={s.suplente}>
                {j.dorsal && <b>{j.dorsal}</b>} {j.nombre}
              </span>
            ))}
          </div>
        )}
      </div>
    </Base>
  );
}
