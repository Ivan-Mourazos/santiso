/* eslint-disable @next/next/no-img-element -- el cartel se exporta como imagen: sin optimizador */
"use client";

import { useEffect, useState, type CSSProperties } from "react";
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

/** Por debajo de esta luminosidad media (0–1) un escudo no se distingue del fondo del cartel. */
const UMBRAL_OSCURO = 0.2;

/**
 * Si el escudo es oscuro (el del Atlético Éter es negro entero). `null` mientras se mira: la
 * página que fotografía el cartel espera a que no quede ninguno por mirar.
 */
function useEscudoOscuro(src: string): boolean | null {
  const [resultado, setResultado] = useState<{ src: string; oscuro: boolean } | null>(null);
  useEffect(() => {
    let vigente = true;
    const imagen = new Image();
    const terminar = (oscuro: boolean) => {
      if (vigente) setResultado({ src, oscuro });
    };
    imagen.onload = () => {
      try {
        const lado = 32;
        const lienzo = document.createElement("canvas");
        lienzo.width = lado;
        lienzo.height = lado;
        const contexto = lienzo.getContext("2d");
        if (!contexto) return terminar(false);
        contexto.drawImage(imagen, 0, 0, lado, lado);
        const { data } = contexto.getImageData(0, 0, lado, lado);
        let luz = 0;
        let peso = 0;
        for (let i = 0; i < data.length; i += 4) {
          const alfa = data[i + 3]! / 255;
          luz += alfa * (0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!);
          peso += alfa;
        }
        terminar(peso > 0 && luz / peso / 255 < UMBRAL_OSCURO);
      } catch {
        terminar(false);
      }
    };
    imagen.onerror = () => terminar(false);
    imagen.src = src;
    return () => {
      vigente = false;
    };
  }, [src]);
  return resultado?.src === src ? resultado.oscuro : null;
}

/**
 * Escudo con relieve: el fichero tal cual, con bisel de luz (filtro SVG), un brillo de arriba
 * abajo recortado con su propia forma y sombra proyectada. `className` lo coloca y lo mide.
 */
export function Escudo({
  src,
  className,
  style,
  relieve = true,
}: {
  src: string;
  className?: string;
  style?: CSSProperties;
  /** `false` si el escudo ya tiene volumen: solo lleva la sombra. */
  relieve?: boolean;
}) {
  const oscuro = useEscudoOscuro(src);
  const marcas = {
    "data-escudo-analizando": oscuro === null ? "" : undefined,
    "data-oscuro": oscuro ? "" : undefined,
  };
  if (!relieve) {
    return (
      <div className={`${e.escudo} ${className ?? ""}`} style={style} {...marcas}>
        <img className={e.imagen} src={src} alt="" />
      </div>
    );
  }
  const forma = { maskImage: `url("${src}")`, WebkitMaskImage: `url("${src}")` } as CSSProperties;
  return (
    <div className={`${e.escudo} ${className ?? ""}`} style={style} {...marcas}>
      <img className={e.imagen} src={src} alt="" style={{ filter: `url(#${FILTRO})` }} />
      <div className={e.brillo} style={forma} />
    </div>
  );
}
