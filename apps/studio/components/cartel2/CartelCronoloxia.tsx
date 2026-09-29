 
import type { CSSProperties } from "react";
import {
  categoriaCartel,
  fechaCorta,
  type DatosCronoloxia,
  type EventoCartel,
} from "@/lib/cartel2/modelo";
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
          {evento.entra.toUpperCase()}
        </span>
        <span className={s.sale}>
          <Flecha sube={false} />
          {evento.jugador.toUpperCase()}
        </span>
      </span>
    );
  }
  const extra = evento.tipo === "penalti" ? " (PEN.)" : evento.tipo === "propia" ? " (P.P.)" : "";
  return (
    <span className={s.jugador}>
      {(evento.jugador || "GOL").toUpperCase()}
      {extra}
    </span>
  );
}

/**
 * Cronoloxía del partido: marcador arriba y línea de tiempo en el centro, con los minutos
 * sobre la línea y los hechos de cada equipo a su lado. Las filas se aprietan si hay muchos.
 */
export function CartelCronoloxia({ datos }: { datos: DatosCronoloxia }) {
  const eventos = [...datos.eventos].sort((a, c) => orden(a.minuto) - orden(c.minuto)).slice(0, 26);
  const alto = Math.max(27, Math.min(78, Math.floor(720 / Math.max(eventos.length, 1))));
  const estiloFila = { "--fila": `${alto}px` } as CSSProperties;
  const pie = [fechaCorta(datos.fecha), datos.campo.toUpperCase()].filter(Boolean).join("  ·  ");

  return (
    <Base
      variante="centro"
      izquierda={datos.local}
      derecha={datos.visitante}
      institucionales={datos.institucionales}
      patrocinadores={datos.patrocinadores}
    >
      <header className={b.cabecera}>
        <div className={b.xornada}>CRONOLOXÍA</div>
        <div className={b.competicion}>
          {categoriaCartel(datos.categoria)}
          {datos.jornada ? ` · XORNADA ${datos.jornada}` : ""}
          {datos.competicion ? ` · ${datos.competicion.toUpperCase()}` : ""}
        </div>
      </header>

      <div className={s.marcador}>
        {datos.local.escudo ? (
          <Escudo className={s.escudo} src={datos.local.escudo} />
        ) : (
          <span className={s.escudo} />
        )}
        <div className={`${b.display} ${s.goles}`}>
          <span className={datos.local.propio ? s.propio : undefined}>{datos.golesLocal}</span>
          <span className={s.guion}>–</span>
          <span className={datos.visitante.propio ? s.propio : undefined}>
            {datos.golesVisitante}
          </span>
        </div>
        {datos.visitante.escudo ? (
          <Escudo className={s.escudo} src={datos.visitante.escudo} />
        ) : (
          <span className={s.escudo} />
        )}
      </div>

      {eventos.length === 0 && <div className={s.vacia}>SEN INCIDENCIAS REXISTRADAS</div>}
      <ol className={s.linea} style={estiloFila}>
        {eventos.map((e, i) => (
          <li key={`${e.minuto}-${i}`} className={e.lado === "local" ? s.izquierda : s.derecha}>
            <span className={s.hecho}>
              <Icono tipo={e.tipo} />
              <Texto evento={e} />
            </span>
            <span className={`${b.display} ${s.minuto}`}>{e.minuto ? `${e.minuto}'` : "–"}</span>
          </li>
        ))}
      </ol>

      {pie && <div className={`${b.dato} ${s.pie}`}>{pie}</div>}
    </Base>
  );
}
