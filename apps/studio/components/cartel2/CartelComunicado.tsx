/* eslint-disable @next/next/no-img-element -- el cartel se exporta como imagen: sin optimizador */
import type { CSSProperties } from "react";
import { MEDIDAS, TIPOS_COMUNICADO, type DatosComunicado } from "@/lib/cartel2/modelo";
import { anton, barlow } from "./fuentes";
import b from "./Base.module.css";
import s from "./CartelComunicado.module.css";

const MESES = [
  "xaneiro",
  "febreiro",
  "marzo",
  "abril",
  "maio",
  "xuño",
  "xullo",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "decembro",
];

/** «2026-10-17» → «17 de outubro de 2026»; vacío si no hay fecha. */
export function fechaLarga(fecha: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  return m ? `${Number(m[3])} de ${MESES[Number(m[2]) - 1]} de ${m[1]}` : "";
}

/**
 * Comunicado oficial, parte médico o loito: sobrio, como los de un club profesional. Escudo,
 * etiqueta, título, texto en párrafos y, al pie, fecha y firma. Sin patrocinadores ni texturas.
 */
export function CartelComunicado({ datos }: { datos: DatosComunicado }) {
  const tipo = TIPOS_COMUNICADO[datos.tipo];
  const largo = datos.texto.length;
  const cuerpoTexto = largo <= 320 ? 38 : largo <= 600 ? 33 : largo <= 900 ? 29 : 26;
  const cuerpoTitulo = datos.titulo.length <= 30 ? 84 : datos.titulo.length <= 60 ? 68 : 56;
  const fecha = fechaLarga(datos.fecha);
  const estilo = {
    "--acento": tipo.acento,
    width: MEDIDAS.ancho,
    height: MEDIDAS.alto,
  } as CSSProperties;

  return (
    <div
      className={`${b.cartel} ${s.cartel} ${datos.tipo === "loito" ? s.loito : ""} ${anton.variable} ${barlow.variable}`}
      style={estilo}
      data-cartel
    >
      <div className={s.marco} />
      <div className={s.contenido}>
        <header className={s.cabecera} data-lectura-bloque>
          {datos.escudoClub && <img className={s.escudo} src={datos.escudoClub} alt="" />}
          <div className={s.club}>UNIÓN DEPORTIVA SANTISO</div>
          <div className={s.etiqueta}>{tipo.etiqueta}</div>
        </header>
        {datos.titulo && (
          <h1
            className={`${b.display} ${s.titulo}`}
            style={{ fontSize: cuerpoTitulo }}
            data-lectura-bloque
            data-lectura-columna
          >
            {datos.titulo.toUpperCase()}
          </h1>
        )}
        <div
          className={s.texto}
          style={{ fontSize: cuerpoTexto }}
          data-lectura-bloque
          data-lectura-columna
        >
          {datos.texto
            .split(/\n\s*\n/)
            .filter((p) => p.trim())
            .map((parrafo, i) => (
              <p key={i}>{parrafo.trim()}</p>
            ))}
        </div>
        {(fecha || datos.firma) && (
          <footer className={s.pie} data-lectura-bloque>
            {fecha && <span>Santiso, {fecha}</span>}
            {datos.firma && <strong>{datos.firma}</strong>}
          </footer>
        )}
      </div>
    </div>
  );
}
