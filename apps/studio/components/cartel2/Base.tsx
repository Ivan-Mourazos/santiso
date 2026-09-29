/* eslint-disable @next/next/no-img-element -- el cartel se exporta como imagen: sin optimizador */
import type { CSSProperties, ReactNode } from "react";
import { MEDIDAS, urlLogo, type EquipoCartel } from "@/lib/cartel2/modelo";
import { FiltroRelieve } from "./Escudo";
import { anton, barlow } from "./fuentes";
import b from "./Base.module.css";

/** Lo que el fondo necesita de un equipo: su escudo (para el eco) y su color. */
type Lado = Pick<EquipoCartel, "escudo" | "propio" | "color">;

/**
 * Colores de un lado: `base` rellena su mitad y `luz` es el brillo detrás del escudo. El
 * Santiso juega de amarillo y negro: su lado es negro con luz amarilla.
 */
export function coloresDe(lado: Lado | null | undefined) {
  if (!lado || lado.propio) {
    return { base: "#0b0b0c", luz: "color-mix(in srgb, #f5c518 55%, transparent)" };
  }
  return {
    base: `color-mix(in srgb, ${lado.color} 62%, #06080b)`,
    luz: `color-mix(in srgb, ${lado.color} 72%, transparent)`,
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
  logosArriba = "derecha",
  institucionales,
  patrocinadores,
  className = "",
  children,
}: {
  variante: "diagonal" | "centro" | "club";
  izquierda?: Lado | null;
  derecha?: Lado | null;
  foto?: string | null;
  lineas?: boolean;
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
    "--izquierda-luz": i.luz,
    "--derecha-base": d.base,
    "--derecha-luz": d.luz,
    width: MEDIDAS.ancho,
    height: MEDIDAS.alto,
  } as CSSProperties;

  return (
    <div
      className={`${b.cartel} ${b[variante]} ${foto ? b.conFoto : ""} ${anton.variable} ${barlow.variable} ${className}`}
      style={estilo}
      data-cartel
    >
      <FiltroRelieve />
      <div className={b.fondo} />
      {foto ? (
        <div className={b.foto}>
          <img src={foto} alt="" />
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
