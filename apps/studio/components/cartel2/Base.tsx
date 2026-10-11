/* eslint-disable @next/next/no-img-element -- el cartel se exporta como imagen: sin optimizador */
import type { CSSProperties, ReactNode } from "react";
import {
  MEDIDAS,
  MEDIDAS_HISTORIA,
  urlFoto,
  urlLogo,
  type EquipoCartel,
  type FotoCartel,
} from "@/lib/cartel2/modelo";
import { FiltroRelieve } from "./Escudo";
import { anton, barlow } from "./fuentes";
import b from "./Base.module.css";

/** Lo que el fondo necesita de un equipo: su escudo (para el eco) y su color. */
type Lado = Pick<EquipoCartel, "escudo" | "propio" | "color" | "color2">;

/**
 * Colores de un lado: `base` rellena su mitad y `luz` es el brillo detrás del escudo. El
 * Santiso juega de amarillo y negro: su lado es negro con luz amarilla.
 */
export function coloresDe(lado: Lado | null | undefined) {
  if (!lado || lado.propio) {
    const base = "#0b0b0c";
    return {
      base,
      base2: base,
      luz: "color-mix(in srgb, #f5c518 55%, transparent)",
      luz2: "transparent",
    };
  }
  // Con segundo color, el fondo del lado va de uno a otro y lleva un segundo brillo. Sin él,
  // `base2` repite la base y `luz2` no pinta nada: el cartel queda como siempre.
  const base = `color-mix(in srgb, ${lado.color} 62%, #06080b)`;
  return {
    base,
    base2: lado.color2 ? `color-mix(in srgb, ${lado.color2} 52%, #06080b)` : base,
    luz: `color-mix(in srgb, ${lado.color} 72%, transparent)`,
    luz2: lado.color2 ? `color-mix(in srgb, ${lado.color2} 70%, transparent)` : "transparent",
  };
}

function Eco({ lado, clase }: { lado: Lado | null | undefined; clase: string }) {
  if (!lado?.escudo) return null;
  return (
    <div className={`${b.eco} ${clase} ${lado.propio ? b.ecoPropio : ""}`}>
      <img src={lado.escudo} alt="" />
    </div>
  );
}

/**
 * Lienzo común de todos los carteles, 1080 × 1350: fondo por capas (color de cada lado, eco
 * desenfocado de cada escudo o foto, trama de puntos, focos de estadio, líneas del campo,
 * viñeta, franjas y grano), logos institucionales y patrocinadores. Cada plantilla pone su
 * contenido como `children` y lo coloca con su propio CSS.
 *
 * - `diagonal`: el cartel partido en dos colores con franjas amarillas y negras en el corte.
 * - `centro`: fondo oscuro con la luz de cada equipo a su lado.
 * - `club`: un solo eco, el del escudo del club, centrado (anuncios, clasificación, once).
 */
export function Base({
  variante,
  izquierda,
  derecha,
  foto = null,
  lineas = false,
  historia = false,
  logosArriba = "derecha",
  institucionales,
  patrocinadores,
  className = "",
  children,
}: {
  variante: "diagonal" | "centro" | "club";
  izquierda?: Lado | null;
  derecha?: Lado | null;
  foto?: FotoCartel | null;
  lineas?: boolean;
  /** Lienzo 9:16 de historia; los logos se apartan de lo que tapa Instagram. */
  historia?: boolean;
  logosArriba?: "derecha" | "centro" | "ninguno";
  institucionales: string[];
  patrocinadores: string[];
  className?: string;
  children: ReactNode;
}) {
  const i = coloresDe(izquierda);
  const d = coloresDe(derecha);
  const estilo = {
    "--izquierda-base": i.base,
    "--izquierda-base2": i.base2,
    "--izquierda-luz": i.luz,
    "--izquierda-luz2": i.luz2,
    "--derecha-base": d.base,
    "--derecha-base2": d.base2,
    "--derecha-luz": d.luz,
    "--derecha-luz2": d.luz2,
    width: MEDIDAS.ancho,
    height: historia ? MEDIDAS_HISTORIA.alto : MEDIDAS.alto,
  } as CSSProperties;

  return (
    <div
      className={`${b.cartel} ${b[variante]} ${foto ? b.conFoto : ""} ${historia ? b.historia : ""} ${anton.variable} ${barlow.variable} ${className}`}
      style={estilo}
      data-cartel
    >
      <FiltroRelieve />
      <div className={b.fondo} />
      {foto ? (
        <div className={`${b.foto} ${b[`foto_${foto.estilo}`] ?? ""}`}>
          <img
            src={urlFoto(foto.url)}
            alt=""
            style={{ objectPosition: `${foto.x * 100}% ${foto.y * 100}%` }}
          />
          {foto.estilo === "amarillo" && <div className={b.tinte} />}
        </div>
      ) : (
        <>
          <Eco lado={izquierda} clase={b.ecoIzquierda!} />
          <Eco lado={derecha} clase={b.ecoDerecha!} />
        </>
      )}
      <div className={b.trama} />
      <div className={`${b.foco} ${b.focoIzquierda}`} />
      <div className={`${b.foco} ${b.focoDerecha}`} />
      {lineas && (
        <svg className={b.lineasCampo} viewBox="0 0 1080 1350" aria-hidden>
          <line x1="0" y1="660" x2="1080" y2="660" />
          <circle cx="540" cy="660" r="250" />
          <circle cx="540" cy="660" r="9" />
        </svg>
      )}
      <div className={b.vineta} />
      <div className={b.franja} />
      <div className={b.grano} />

      {logosArriba !== "ninguno" && institucionales.length > 0 && (
        <div
          className={`${b.institucionales} ${logosArriba === "centro" ? b.institucionalesCentro : ""}`}
        >
          {institucionales.map((logo) => (
            <img key={logo} src={urlLogo(logo)} alt="" />
          ))}
        </div>
      )}

      {children}

      {patrocinadores.length > 0 && (
        <footer className={b.patrocinadores}>
          {patrocinadores.map((logo) => (
            <img key={logo} src={urlLogo(logo)} alt="" />
          ))}
        </footer>
      )}
    </div>
  );
}
