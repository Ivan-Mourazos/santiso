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

/** Medidas del campo, las mismas que en el CSS: lienzo, perspectiva e inclinación. */
const LIENZO = 1080;
const PERSPECTIVA = 1500;
const INCLINACION = (32 * Math.PI) / 180;
const ESCENA = {
  historia: { alto: 735, margen: 90 },
  publicacion: { alto: 790, margen: 70 },
} as const;

/**
 * Dónde cae en el cartel un hueco del campo inclinado (x, y en % del césped) y a qué escala se
 * ve. Los jugadores se pintan planos encima, en vez de dentro del campo en 3D: así todos los
 * nombres van en una capa por delante de todas las camisetas y la línea de abajo no los tapa.
 */
export function proyectarHueco(x: number, y: number, historia: boolean) {
  const { alto, margen } = historia ? ESCENA.historia : ESCENA.publicacion;
  // Distancia desde la línea de fondo, que es el eje de giro.
  const v = (1 - y / 100) * alto;
  const escala = PERSPECTIVA / (PERSPECTIVA + v * Math.sin(INCLINACION));
  const px = margen + (x / 100) * (LIENZO - 2 * margen);
  return {
    left: LIENZO / 2 + (px - LIENZO / 2) * escala,
    top: (alto - v * Math.cos(INCLINACION)) * escala,
    escala,
  };
}

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
  const colocados = datos.huecos
    .flatMap((j, i) => {
      const p = puntos[i];
      return j && p ? [{ j, i, sitio: proyectarHueco(p.x, p.y, historia) }] : [];
    })
    .sort((a, b) => a.sitio.top - b.sitio.top);

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
        </div>
        {/* Primero todas las camisetas, de la más lejana a la más cercana; luego los nombres. */}
        {colocados.map(({ j, i, sitio }) => (
          <div
            key={i}
            className={s.jugador}
            style={{ left: sitio.left, top: sitio.top, "--escala": sitio.escala } as CSSProperties}
          >
            <Camiseta className={s.camiseta} dorsal={j.dorsal} portero={j.portero} />
            {j.capitan && <span className={s.capitan}>C</span>}
          </div>
        ))}
        {colocados.map(({ j, i, sitio }) => (
          <div
            key={i}
            className={s.nombre}
            style={
              {
                left: sitio.left,
                top: sitio.top,
                "--escala": sitio.escala,
                fontSize: letraPara(j.nombre, 180, 30),
              } as CSSProperties
            }
          >
            {j.nombre}
          </div>
        ))}
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
