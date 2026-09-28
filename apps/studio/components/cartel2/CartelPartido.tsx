/* eslint-disable @next/next/no-img-element -- el cartel se exporta como imagen: sin optimizador */
import type { CSSProperties } from "react";
import {
  categoriaCartel,
  fechaCartel,
  FORMATOS,
  type Composicion,
  type DatosPartido,
  type Formato,
} from "@/lib/cartel2/modelo";
import { anton, barlow } from "./fuentes";
import s from "./CartelPartido.module.css";

/** Cuerpo de letra para que un nombre largo quepa en `ancho` px con la display condensada. */
function cuerpo(texto: string, ancho: number, maximo: number, minimo: number) {
  // Anton mide ~0,46 em de media por carácter en mayúsculas.
  return Math.max(minimo, Math.min(maximo, Math.floor(ancho / (Math.max(texto.length, 1) * 0.46))));
}

/**
 * Cartel de partido, motor nuevo. Un solo marcado para las tres composiciones: cada una solo
 * cambia el CSS. Mide exactamente el formato (1080 × 1350 o 1080 × 1920); la vista previa lo
 * escala y la exportación lo fotografía tal cual.
 */
export function CartelPartido({
  datos,
  composicion,
  formato,
}: {
  datos: DatosPartido;
  composicion: Composicion;
  formato: Formato;
}) {
  const medidas = FORMATOS.find((f) => f.id === formato) ?? FORMATOS[0];
  const fecha = fechaCartel(datos.fecha);
  const propio = datos.local.propio ? datos.local : datos.visitante;
  const rival = datos.local.propio ? datos.visitante : datos.local;
  const estilo = {
    "--local": datos.local.color,
    "--visitante": datos.visitante.color,
    "--propio": propio.color,
    "--rival": rival.color,
    width: medidas.ancho,
    height: medidas.alto,
  } as CSSProperties;

  return (
    <div
      className={`${s.cartel} ${s[composicion]} ${anton.variable} ${barlow.variable}`}
      style={estilo}
      data-formato={formato}
      data-propio={datos.local.propio ? "local" : "visitante"}
      data-cartel
    >
      <div className={s.fondo} />
      <div className={s.franja} />
      <div className={s.grano} />

      {composicion === "gigante" && (
        <div className={s.palabraFondo} aria-hidden>
          {categoriaCartel(datos.categoria)}
        </div>
      )}

      {datos.local.escudo && (
        <img className={`${s.escudo} ${s.escudoLocal}`} src={datos.local.escudo} alt="" />
      )}
      {datos.visitante.escudo && (
        <img className={`${s.escudo} ${s.escudoVisitante}`} src={datos.visitante.escudo} alt="" />
      )}

      <div className={s.vs}>VS</div>

      <header className={s.cabecera}>
        <div className={s.xornada}>
          {datos.jornada ? `XORNADA ${datos.jornada}` : "DÍA DE PARTIDO"}
        </div>
        <div className={s.competicion}>
          {categoriaCartel(datos.categoria)}
          {datos.competicion ? ` · ${datos.competicion.toUpperCase()}` : ""}
        </div>
      </header>

      {datos.institucionales.length > 0 && (
        <div className={s.institucionales}>
          {datos.institucionales.map((logo) => (
            <img key={logo} src={logo} alt="" />
          ))}
        </div>
      )}

      <div className={`${s.nombre} ${s.nombreLocal}`}>{datos.local.nombre.toUpperCase()}</div>
      <div className={`${s.nombre} ${s.nombreVisitante}`}>
        {datos.visitante.nombre.toUpperCase()}
      </div>

      {composicion === "gigante" && (
        <div className={s.rivalGrande} style={{ fontSize: cuerpo(rival.nombre, 520, 150, 64) }}>
          <span className={s.rivalVs}>{datos.local.propio ? "vs" : "en"}</span>
          {rival.nombre.toUpperCase()}
        </div>
      )}

      <div className={s.cuando}>
        {fecha ? (
          <div className={s.fecha}>
            <span className={s.dia}>{fecha.dia}</span>
            <span className={s.numero}>
              {fecha.numero} {fecha.mes}
            </span>
          </div>
        ) : (
          <div className={s.fecha}>
            <span className={s.sinFecha}>DATA POR DEFINIR</span>
          </div>
        )}
        {datos.hora && <div className={s.hora}>{datos.hora}</div>}
        {datos.campo && <div className={s.campo}>{datos.campo.toUpperCase()}</div>}
      </div>

      {datos.patrocinadores.length > 0 && (
        <footer className={s.patrocinadores}>
          {datos.patrocinadores.map((logo) => (
            <img key={logo} src={logo} alt="" />
          ))}
        </footer>
      )}
    </div>
  );
}
