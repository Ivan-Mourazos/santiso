import type { CSSProperties } from "react";
import {
  categoriaCartel,
  fechaCorta,
  type DatosCampo,
  type FormatoCartel,
} from "@/lib/cartel2/modelo";
import { huecosDe } from "@/lib/cartel2/tactica";
import { Base } from "./Base";
import { Camiseta } from "./Camiseta";
import { Escudo } from "./Escudo";
import s from "./CartelCampo.module.css";

/** Ancho medio de una letra (Barlow Condensed 800 en mayúsculas), en em. */
const EM_LETRA = 0.5;

/** La letra más grande (hasta `maximo`) con la que el texto cabe en `ancho` px, sin cortarlo. */
function letraPara(texto: string, ancho: number, maximo: number) {
  return Math.max(14, Math.min(maximo, Math.floor(ancho / (EM_LETRA * Math.max(1, texto.length)))));
}

/**
 * La alineación dibujada en el campo, en perspectiva, con la camiseta del club y el dorsal de
 * cada titular en su hueco del sistema. Antes del partido es el «Once inicial» (historia, con
 * los dos escudos, día, hora y campo); después, «O Noso 11» (publicación, con el marcador).
 */
export function CartelCampo({ datos, formato }: { datos: DatosCampo; formato: FormatoCartel }) {
  const historia = formato === "historia";
  const puntos = huecosDe(datos.sistema);
  const titulo = datos.momento === "previa" ? "Once inicial" : "O Noso 11";
  const kicker = [categoriaCartel(datos.categoria), datos.jornada ? `Xornada ${datos.jornada}` : ""]
    .filter(Boolean)
    .join(" · ");
  const cuando = [fechaCorta(datos.fecha), datos.hora, datos.campo]
    .filter(Boolean)
    .join(" · ");
  const [local, visitante] = datos.local ? [datos.club, datos.rival] : [datos.rival, datos.club];
  const [golesLocal, golesVisitante] = datos.local
    ? [datos.golesClub, datos.golesRival]
    : [datos.golesRival, datos.golesClub];
  const conMarcador = golesLocal !== null && golesVisitante !== null;

  return (
    <Base
      compacto
      variante="club"
      historia={historia}
      izquierda={datos.club}
      logosArriba={historia ? "centro" : "derecha"}
      institucionales={datos.institucionales}
      patrocinadores={datos.patrocinadores}
      className={`${s.cartel} ${historia ? s.historia : s.publicacion}`}
    >
      <header className={s.cabecera} data-lectura-bloque>
        <div className={s.kicker}>{kicker}</div>
        <div className={s.titulo}>{titulo}</div>
        {historia ? (
          <>
            <div className={s.cruce}>
              <Lado equipo={local} />
              <span className={s.vs}>{conMarcador ? `${golesLocal} - ${golesVisitante}` : "VS"}</span>
              <Lado equipo={visitante} />
            </div>
            {cuando && <div className={s.cuando}>{cuando}</div>}
          </>
        ) : (
          <div className={s.pastilla}>
            <Lado equipo={local} pequeno />
            <span className={s.nombreEquipo} style={{ fontSize: letraPara(local.nombre, 190, 30) }}>
              {local.nombre}
            </span>
            <span className={s.goles}>
              {conMarcador ? `${golesLocal} - ${golesVisitante}` : "VS"}
            </span>
            <span
              className={s.nombreEquipo}
              style={{ fontSize: letraPara(visitante.nombre, 190, 30) }}
            >
              {visitante.nombre}
            </span>
            <Lado equipo={visitante} pequeno />
          </div>
        )}
      </header>

      <div className={s.escena} data-lectura-bloque>
        <div className={s.campo}>
          <div className={`${s.linea} ${s.medio}`} />
          <div className={`${s.linea} ${s.circulo}`} />
          <div className={`${s.linea} ${s.punto}`} />
          <div className={`${s.linea} ${s.area}`} />
          <div className={`${s.linea} ${s.areaPequena}`} />
          <div className={`${s.linea} ${s.area} ${s.arriba}`} />
          <div className={`${s.linea} ${s.areaPequena} ${s.arriba}`} />
          {datos.huecos.map((j, i) => {
            const p = puntos[i];
            if (!j || !p) return null;
            return (
              <div
                key={i}
                className={s.jugador}
                style={{ left: `${p.x}%`, top: `${p.y}%` } as CSSProperties}
              >
                <div className={s.erguido}>
                  <Camiseta className={s.camiseta} dorsal={j.dorsal} portero={j.portero} />
                  {j.capitan && <span className={s.capitan}>C</span>}
                  <div className={s.nombre} style={{ fontSize: letraPara(j.nombre, 180, 30) }}>
                    {j.nombre}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {datos.suplentes.length > 0 && (
        <div className={s.suplentes} data-lectura-bloque>
          <b>{historia ? "Banco" : "Suplentes"}</b>
          {datos.suplentes.map((j) => (
            <span key={`${j.dorsal}-${j.nombre}`}>
              <b>{j.dorsal}</b> {j.nombre}
            </span>
          ))}
        </div>
      )}
    </Base>
  );
}

function Lado({ equipo, pequeno = false }: { equipo: DatosCampo["club"]; pequeno?: boolean }) {
  if (!equipo.escudo) return <span className={pequeno ? s.escudoPequeno : s.escudo} />;
  return (
    <Escudo
      className={pequeno ? s.escudoPequeno : s.escudo}
      src={equipo.escudo}
      relieve={equipo.relieve}
    />
  );
}
