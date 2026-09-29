/* eslint-disable @next/next/no-img-element -- el cartel se exporta como imagen: sin optimizador */
import type { CSSProperties } from "react";
import e from "./Escudo.module.css";

/** Id del filtro de relieve: lo define una sola vez `FiltroRelieve` dentro de cada cartel. */
const FILTRO = "cartel-relieve-escudo";

/**
 * Filtro SVG que da volumen a cualquier escudo sin tocar el fichero: a partir de su silueta
 * (canal alfa) calcula un bisel con luz especular desde arriba a la izquierda y lo suma al
 * escudo. El interior queda igual; los bordes ganan brillo y relieve.
 */
export function FiltroRelieve() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
      <defs>
        <filter
          id={FILTRO}
          x="-5%"
          y="-5%"
          width="110%"
          height="110%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur in="SourceAlpha" stdDeviation="5" result="silueta" />
          <feSpecularLighting
            in="silueta"
            surfaceScale="6"
            specularConstant="0.85"
            specularExponent="18"
            lightingColor="#ffffff"
            result="luz"
          >
            <feDistantLight azimuth="235" elevation="42" />
          </feSpecularLighting>
          <feComposite in="luz" in2="SourceAlpha" operator="in" result="luzDentro" />
          <feComposite
            in="SourceGraphic"
            in2="luzDentro"
            operator="arithmetic"
            k1="0"
            k2="1"
            k3="0.6"
            k4="0"
          />
        </filter>
      </defs>
    </svg>
  );
}

/**
 * Escudo con relieve: el fichero tal cual, con bisel de luz (filtro SVG), un brillo de arriba
 * abajo recortado con su propia forma y sombra proyectada. `className` lo coloca y lo mide.
 */
export function Escudo({
  src,
  className,
  style,
}: {
  src: string;
  className?: string;
  style?: CSSProperties;
}) {
  const forma = { maskImage: `url("${src}")`, WebkitMaskImage: `url("${src}")` } as CSSProperties;
  return (
    <div className={`${e.escudo} ${className ?? ""}`} style={style}>
      <img className={e.imagen} src={src} alt="" style={{ filter: `url(#${FILTRO})` }} />
      <div className={e.brillo} style={forma} />
    </div>
  );
}
