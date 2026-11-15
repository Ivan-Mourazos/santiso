import type { CSSProperties } from "react";
import {
  categoriaCartel,
  fechaCorta,
  nombreDeCartel,
  type DatosCronoloxia,
  type EventoCartel,
} from "@/lib/cartel2/modelo";
import { filasLinea, medidasLinea } from "@/lib/cartel2/cronoloxia";
import { Balon } from "./Balon";
import { Base } from "./Base";
import { Escudo } from "./Escudo";
import b from "./Base.module.css";
import s from "./CartelCronoloxia.module.css";

/** «45+2» → 45,002; «90» → 90. Para ordenar por minuto con el descuento detrás. */
function orden(minuto: string) {
  const m = /^(\d+)(?:\s*\+\s*(\d+))?/.exec(minuto);
  return m ? Number(m[1]) + Number(m[2] ?? 0) / 1000 : 999;
}

function Tarjeta({ color }: { color: string }) {
  return <span className={s.tarjeta} style={{ background: color }} />;
}

function Flecha({ sube }: { sube: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <path
        d={sube ? "M12 3l8 10h-5v8H9v-8H4z" : "M12 21L4 11h5V3h6v8h5z"}
        fill={sube ? "#22c55e" : "#ef4444"}
      />
    </svg>
  );
}

function Icono({ tipo }: { tipo: EventoCartel["tipo"] }) {
  if (tipo === "gol" || tipo === "penalti" || tipo === "propia") return <Balon tamano={26} />;
  if (tipo === "amarilla") return <Tarjeta color="#f5c518" />;
  if (tipo === "roja") return <Tarjeta color="#ef4444" />;
  if (tipo === "doble_amarilla") {
    return (
      <span className={s.doble}>
        <Tarjeta color="#f5c518" />
        <Tarjeta color="#ef4444" />
      </span>
    );
  }
  return null;
}

function Texto({ evento }: { evento: EventoCartel }) {
  if (evento.tipo === "cambio") {
    return (
      <span className={s.cambio}>
        <span>
          <Flecha sube />
          {nombreDeCartel(evento.entra).toUpperCase()}
        </span>
        <span className={s.sale}>
          <Flecha sube={false} />
          {nombreDeCartel(evento.jugador).toUpperCase()}
        </span>
      </span>
    );
  }
  const extra = evento.tipo === "penalti" ? " (PEN.)" : evento.tipo === "propia" ? " (P.P.)" : "";
  return (
    <span className={s.jugador}>
      {(nombreDeCartel(evento.jugador) || "GOL").toUpperCase()}
      {extra}
    </span>
  );
}

/** El descanso cae entre el último minuto de la primera parte y el primero de la segunda. */
const FIN_PRIMERA = 45;

/** Una fila de la línea de tiempo: la incidencia en el lado de su equipo y el minuto en medio. */
function Fila({ evento, propio }: { evento: EventoCartel; propio: boolean }) {
  const hecho = (
    <span className={s.hecho} data-lectura-columna>
      <Icono tipo={evento.tipo} />
      <Texto evento={evento} />
    </span>
  );
  const local = evento.lado === "local";
  return (
    <li className={s.fila} data-lectura-fila data-propio={propio} data-lado={evento.lado}>
      <span className={s.ladoLocal}>{local && hecho}</span>
      <span className={`${b.display} ${s.minuto}`}>
        {evento.minuto ? `${evento.minuto}'` : "–"}
      </span>
      <span className={s.ladoVisitante}>{!local && hecho}</span>
    </li>
  );
}

/** Las amarillas de un equipo cuando no caben en la línea: «NOMBRE 19' · NOMBRE 31'». */
function Resumen({
  eventos,
  lado,
}: {
  eventos: readonly EventoCartel[];
  lado: "local" | "visitante";
}) {
  return (
    <div className={s.resumenLado} data-lado={lado}>
      <span className={s.tarjeta} style={{ background: "#f5c518" }} />
      {eventos.length === 0
        ? "—"
        : eventos.map((e, i) => (
            <span key={`${e.minuto}-${i}`}>
              {i > 0 && " · "}
              {(nombreDeCartel(e.jugador) || "—").toUpperCase()}{" "}
              <span className={s.minutoResumen}>{e.minuto ? `${e.minuto}'` : ""}</span>
            </span>
          ))}
    </div>
  );
}

/**
 * Resultado del partido: marcador arriba, con cada escudo y su nombre, y debajo la línea de
 * tiempo: cada incidencia en el lado de su equipo (la de casa a la izquierda) con el minuto en
 * medio, y el descanso marcado. Con muchas, las amarillas van a un resumen abajo.
 */
export function CartelCronoloxia({ datos }: { datos: DatosCronoloxia }) {
  const eventos = [...datos.eventos].sort((a, c) => orden(a.minuto) - orden(c.minuto));
  const { enLinea, amarillasLocal, amarillasVisitante } = filasLinea(eventos);
  const resumen = amarillasLocal.length + amarillasVisitante.length > 0;
  const { cuerpo: cuerpoLinea, aire, minuto, denso } = medidasLinea(enLinea, resumen);
  const primera = enLinea.filter((e) => orden(e.minuto) <= FIN_PRIMERA);
  const segunda = enLinea.filter((e) => orden(e.minuto) > FIN_PRIMERA);
  const propio = (e: EventoCartel) => (e.lado === "local" ? datos.local : datos.visitante).propio;
  const pie = [fechaCorta(datos.fecha), datos.campo.toUpperCase()].filter(Boolean).join("  ·  ");

  return (
    <Base
      compacto
      variante="centro"
      izquierda={datos.local}
      derecha={datos.visitante}
      foto={datos.foto ?? null}
      institucionales={datos.institucionales}
      patrocinadores={datos.patrocinadores}
    >
      <header className={`${b.cabecera} ${s.cabecera}`} data-lectura-bloque>
        <div className={b.xornada}>RESULTADO</div>
        <div className={b.competicion}>
          {categoriaCartel(datos.categoria)}
          {datos.jornada ? ` · XORNADA ${datos.jornada}` : ""}
          {datos.competicion ? ` · ${datos.competicion.toUpperCase()}` : ""}
        </div>
      </header>

      <div className={s.marcador} data-denso={denso || undefined} data-lectura-bloque>
        {([datos.local, datos.visitante] as const).map((equipo, i) => (
          <div key={i} className={s.equipo} style={{ gridColumn: i === 0 ? 1 : 3 }}>
            {equipo.escudo ? (
              <Escudo className={s.escudo} src={equipo.escudo} relieve={equipo.relieve} />
            ) : (
              <span className={s.escudo} />
            )}
            {!denso && (
              <span className={s.nombre} data-propio={equipo.propio}>
                {equipo.nombre}
              </span>
            )}
          </div>
        ))}
        <div className={`${b.display} ${s.goles}`}>
          <span className={datos.local.propio ? s.propio : undefined}>{datos.golesLocal}</span>
          <span className={s.guion}>–</span>
          <span className={datos.visitante.propio ? s.propio : undefined}>
            {datos.golesVisitante}
          </span>
        </div>
      </div>

      {eventos.length === 0 && <div className={s.vacia}>SEN INCIDENCIAS REXISTRADAS</div>}
      {enLinea.length > 0 && (
        <ol
          className={s.linea}
          data-denso={denso || undefined}
          data-resumen={resumen || undefined}
          data-lectura-bloque
          style={
            {
              "--cuerpo": `${cuerpoLinea}px`,
              "--aire": `${aire}px`,
              "--ancho-minuto": minuto,
            } as CSSProperties
          }
        >
          {primera.map((e, i) => (
            <Fila key={`a-${e.minuto}-${i}`} evento={e} propio={propio(e)} />
          ))}
          {primera.length > 0 && segunda.length > 0 && (
            <li className={s.descanso} aria-label="Descanso">
              <span>DESCANSO</span>
            </li>
          )}
          {segunda.map((e, i) => (
            <Fila key={`b-${e.minuto}-${i}`} evento={e} propio={propio(e)} />
          ))}
        </ol>
      )}

      {resumen && (
        <div className={s.resumen} data-lectura-bloque>
          <Resumen eventos={amarillasLocal} lado="local" />
          <Resumen eventos={amarillasVisitante} lado="visitante" />
        </div>
      )}

      {pie && (
        <div className={`${b.dato} ${s.pie}`} data-lectura-bloque>
          {pie}
        </div>
      )}
    </Base>
  );
}
