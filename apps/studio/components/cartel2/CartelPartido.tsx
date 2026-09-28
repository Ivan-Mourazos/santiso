/* eslint-disable @next/next/no-img-element -- el cartel se exporta como imagen: sin optimizador */
import type { CSSProperties } from "react";
import {
  categoriaCartel,
  fechaCartel,
  MEDIDAS,
  urlLogo,
  type Composicion,
  type DatosPartido,
  type EquipoCartel,
} from "@/lib/cartel2/modelo";
import { anton, barlow } from "./fuentes";
import s from "./CartelPartido.module.css";

/**
 * Cuerpo de letra para que `texto` quepa en una línea de `ancho` px. `em` es el ancho medio de
 * un carácter en mayúsculas de esa fuente, en em (Anton ≈ 0,46; Barlow Condensed 800 ≈ 0,5).
 */
function cuerpo(texto: string, ancho: number, maximo: number, minimo: number, em: number) {
  const n = Math.max(texto.length, 1);
  return Math.max(minimo, Math.min(maximo, Math.floor(ancho / (n * em))));
}

/**
 * Colores de un lado del cartel: `base` rellena su mitad y `luz` es el brillo detrás del
 * escudo. El Santiso juega de amarillo y negro: su lado es negro con luz amarilla.
 */
function coloresDe(equipo: EquipoCartel) {
  return equipo.propio
    ? { base: "#0b0b0c", luz: "color-mix(in srgb, #f5c518 55%, transparent)" }
    : {
        base: `color-mix(in srgb, ${equipo.color} 62%, #06080b)`,
        luz: `color-mix(in srgb, ${equipo.color} 72%, transparent)`,
      };
}

/**
 * Cartel de partido del motor nuevo, 1080 × 1350. Un solo marcado para las tres composiciones:
 * cada una solo cambia el CSS. La vista previa lo escala y la exportación lo fotografía tal cual.
 * Nada se sale del cartel: escudos enteros y nombres ajustados a su hueco.
 */
export function CartelPartido({
  datos,
  composicion,
}: {
  datos: DatosPartido;
  composicion: Composicion;
}) {
  const fecha = fechaCartel(datos.fecha);
  const rival = datos.local.propio ? datos.visitante : datos.local;
  const local = coloresDe(datos.local);
  const visitante = coloresDe(datos.visitante);
  const estilo = {
    "--local-base": local.base,
    "--local-luz": local.luz,
    "--visitante-base": visitante.base,
    "--visitante-luz": visitante.luz,
    width: MEDIDAS.ancho,
    height: MEDIDAS.alto,
  } as CSSProperties;
  // Hueco de cada nombre según la composición (px de ancho, una sola línea).
  const huecoNombre = composicion === "enfrentados" ? 440 : 470;
  const nombre = (texto: string) => ({ fontSize: cuerpo(texto, huecoNombre, 40, 24, 0.5) });
  // El rival en «gigante»: hasta dos líneas de 400 px, sin que la palabra más larga se corte.
  const palabraMasLarga = rival.nombre
    .split(/\s+/)
    .reduce((a, b) => (b.length > a.length ? b : a), "");
  const cuerpoRival = Math.min(
    cuerpo(rival.nombre, 2 * 400, 120, 52, 0.46),
    cuerpo(palabraMasLarga, 400, 120, 52, 0.46),
  );

  return (
    <div
      className={`${s.cartel} ${s[composicion]} ${anton.variable} ${barlow.variable}`}
      style={estilo}
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

      {datos.institucionales.length > 0 && (
        <div className={s.institucionales}>
          {datos.institucionales.map((logo) => (
            <img key={logo} src={urlLogo(logo)} alt="" />
          ))}
        </div>
      )}

      <header className={s.cabecera}>
        <div className={s.xornada}>
          {datos.jornada ? `XORNADA ${datos.jornada}` : "DÍA DE PARTIDO"}
        </div>
        <div className={s.competicion}>
          {categoriaCartel(datos.categoria)}
          {datos.competicion ? ` · ${datos.competicion.toUpperCase()}` : ""}
        </div>
      </header>

      <div className={`${s.nombre} ${s.nombreLocal}`} style={nombre(datos.local.nombre)}>
        {datos.local.nombre.toUpperCase()}
      </div>
      <div className={`${s.nombre} ${s.nombreVisitante}`} style={nombre(datos.visitante.nombre)}>
        {datos.visitante.nombre.toUpperCase()}
      </div>

      {composicion === "gigante" && (
        <div className={s.rivalGrande}>
          <span className={s.rivalVs}>{datos.local.propio ? "vs" : "en"}</span>
          <span style={{ fontSize: cuerpoRival }}>{rival.nombre.toUpperCase()}</span>
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
            <img key={logo} src={urlLogo(logo)} alt="" />
          ))}
        </footer>
      )}
    </div>
  );
}
