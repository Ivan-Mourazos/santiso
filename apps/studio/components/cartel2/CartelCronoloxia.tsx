import type { CSSProperties } from "react";
import {
  categoriaCartel,
  fechaCorta,
  nombreDeCartel,
  type DatosCronoloxia,
  type EventoCartel,
} from "@/lib/cartel2/modelo";
import { medidasLinea } from "@/lib/cartel2/cronoloxia";
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

/**
 * Cronoloxía del partido: marcador arriba, con cada escudo y su nombre encima de su columna, y
 * debajo una columna por equipo (la de casa a la izquierda), cada una por orden de minuto.
 */
export function CartelCronoloxia({ datos }: { datos: DatosCronoloxia }) {
  const eventos = [...datos.eventos].sort((a, c) => orden(a.minuto) - orden(c.minuto));
  const columnas = (["local", "visitante"] as const).map((lado) =>
    eventos.filter((e) => e.lado === lado),
  );
  const { cuerpo: cuerpoLinea, aire, minuto } = medidasLinea(columnas);
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
        <div className={b.xornada}>CRONOLOXÍA</div>
        <div className={b.competicion}>
          {categoriaCartel(datos.categoria)}
          {datos.jornada ? ` · XORNADA ${datos.jornada}` : ""}
          {datos.competicion ? ` · ${datos.competicion.toUpperCase()}` : ""}
        </div>
      </header>

      <div className={s.marcador} data-lectura-bloque>
        {([datos.local, datos.visitante] as const).map((equipo, i) => (
          <div key={i} className={s.equipo} style={{ gridColumn: i === 0 ? 1 : 3 }}>
            {equipo.escudo ? (
              <Escudo className={s.escudo} src={equipo.escudo} relieve={equipo.relieve} />
            ) : (
              <span className={s.escudo} />
            )}
            <span className={s.nombre} data-propio={equipo.propio}>
              {equipo.nombre}
            </span>
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
      <div
        className={s.linea}
        style={
          {
            "--cuerpo": `${cuerpoLinea}px`,
            "--aire": `${aire}px`,
            "--ancho-minuto": minuto,
          } as CSSProperties
        }
      >
        {columnas.map((lista, i) => {
          const lado = i === 0 ? "local" : "visitante";
          const equipo = i === 0 ? datos.local : datos.visitante;
          return (
            <ol
              key={lado}
              className={s.columna}
              aria-label={equipo.nombre}
              data-lectura-bloque
              data-lado={lado}
            >
              {lista.map((e, j) => (
                <li
                  key={`${e.minuto}-${j}`}
                  className={i === 0 ? s.izquierda : s.derecha}
                  data-lectura-fila
                  data-propio={equipo.propio}
                >
                  <span className={s.hecho} data-lectura-columna>
                    <Icono tipo={e.tipo} />
                    <Texto evento={e} />
                  </span>
                  <span className={`${b.display} ${s.minuto}`}>
                    {e.minuto ? `${e.minuto}'` : "–"}
                  </span>
                </li>
              ))}
            </ol>
          );
        })}
      </div>

      {pie && (
        <div className={`${b.dato} ${s.pie}`} data-lectura-bloque>
          {pie}
        </div>
      )}
    </Base>
  );
}
