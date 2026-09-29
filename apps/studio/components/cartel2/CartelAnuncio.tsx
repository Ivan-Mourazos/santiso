/* eslint-disable @next/next/no-img-element -- el cartel se exporta como imagen: sin optimizador */
import type { CSSProperties } from "react";
import { TEMAS_ANUNCIO, type DatosAnuncio } from "@/lib/cartel2/modelo";
import { Base } from "./Base";
import b from "./Base.module.css";
import s from "./CartelAnuncio.module.css";

/**
 * Anuncio o comunicado (multiusos): etiqueta del tema con su color, título enorme en hasta
 * tres líneas, texto y una o dos imágenes. Fondo con el eco del escudo del club.
 */
export function CartelAnuncio({ datos }: { datos: DatosAnuncio }) {
  const tema = TEMAS_ANUNCIO[datos.tema];
  const titulo = datos.titulo || "COMUNICADO";
  // Hasta tres líneas de 952 px con la display condensada.
  const cuerpoTitulo = Math.max(76, Math.min(170, Math.floor((3 * 952) / (titulo.length * 0.5))));
  const imagenes = datos.imagenes.slice(0, 2);
  const estilo = { "--acento": tema.acento } as CSSProperties;

  return (
    <Base
      variante="club"
      izquierda={{ escudo: datos.escudoClub, propio: true, color: "#f5c518" }}
      institucionales={datos.institucionales}
      patrocinadores={datos.patrocinadores}
    >
      <div
        className={`${s.contenido} ${imagenes.length === 0 ? s.sinImagenes : ""}`}
        style={estilo}
      >
        <div className={s.etiqueta}>{tema.etiqueta}</div>
        <h1
          className={`${b.display} ${s.titulo} ${datos.tema === "celebracion" ? s.tituloAcento : ""}`}
          style={{ fontSize: cuerpoTitulo }}
        >
          {titulo.toUpperCase()}
        </h1>
        {datos.texto && <p className={s.texto}>{datos.texto}</p>}
        {imagenes.length > 0 && (
          <div className={`${s.imagenes} ${imagenes.length === 2 ? s.dos : ""}`}>
            {imagenes.map((url) => (
              <img key={url} src={url} alt="" />
            ))}
          </div>
        )}
      </div>
    </Base>
  );
}
