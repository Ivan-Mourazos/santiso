/* eslint-disable @next/next/no-img-element -- el cartel se exporta como imagen: sin optimizador */
import { MEDIDAS, TIPOS_FICHAXE, urlFoto, type DatosFichaxe } from "@/lib/cartel2/modelo";
import { anton, barlow } from "./fuentes";
import b from "./Base.module.css";
import s from "./CartelFichaxe.module.css";

/**
 * Fichaje, renovación o vuelta al estilo de los clubs profesionales: la foto ocupa todo el
 * cartel y abajo va solo el texto. Sin logos ni patrocinadores; el escudo pequeño es opcional.
 */
export function CartelFichaxe({ datos }: { datos: DatosFichaxe }) {
  const grande = (datos.apellido || datos.nombre || "NOME").toUpperCase();
  const pequeno = datos.apellido ? datos.nombre.toUpperCase() : "";
  // Una línea de 952 px con la display condensada.
  const cuerpo = Math.max(110, Math.min(250, Math.floor(952 / (grande.length * 0.47))));
  const { foto } = datos;

  return (
    <div
      className={`${b.cartel} ${anton.variable} ${barlow.variable}`}
      style={{ width: MEDIDAS.ancho, height: MEDIDAS.alto }}
      data-cartel
    >
      {foto ? (
        <img
          className={s.foto}
          src={urlFoto(foto.url)}
          alt=""
          style={{
            objectPosition: `${foto.x * 100}% ${foto.y * 100}%`,
            transform: `scale(${Math.max(1, foto.zoom)})`,
            transformOrigin: `${foto.x * 100}% ${foto.y * 100}%`,
          }}
        />
      ) : (
        datos.escudoClub && (
          <div className={s.sinFoto}>
            <img src={datos.escudoClub} alt="" />
          </div>
        )
      )}
      <div className={s.sombra} />
      {datos.conEscudo && datos.escudoClub && (
        <img className={s.escudo} src={datos.escudoClub} alt="" />
      )}
      <div className={s.texto} data-lectura-bloque data-lectura-columna>
        <div className={s.etiqueta}>{TIPOS_FICHAXE[datos.tipo]}</div>
        {pequeno && <div className={s.nombre}>{pequeno}</div>}
        <h1 className={`${b.display} ${s.apellido}`} style={{ fontSize: cuerpo }}>
          {grande}
        </h1>
        {datos.detalle && <div className={s.detalle}>{datos.detalle.toUpperCase()}</div>}
        {datos.frase && <p className={s.frase}>«{datos.frase}»</p>}
      </div>
      <div className={b.grano} />
    </div>
  );
}
