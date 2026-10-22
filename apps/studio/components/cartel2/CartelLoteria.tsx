/* eslint-disable @next/next/no-img-element -- el cartel se exporta como imagen: sin optimizador */
import { SORTEOS_LOTERIA, type DatosLoteria } from "@/lib/cartel2/modelo";
import { Base } from "./Base";
import b from "./Base.module.css";
import s from "./CartelLoteria.module.css";

/** «5» y «4» → «1»; «2,50» y «2» → «0,50». Sin los dos importes, o si no hay donativo, vacío. */
function donativo(prezo: string, xoga: string) {
  const n = (t: string) => Math.round(Number(t.replace(",", ".")) * 100);
  if (!prezo || !xoga) return "";
  const resto = n(prezo) - n(xoga);
  if (resto <= 0) return "";
  return resto % 100 ? (resto / 100).toFixed(2).replace(".", ",") : String(resto / 100);
}

/**
 * Lotaría do club: el décimo (o los dos) en amarillo como protagonista, con el sorteo, la
 * papeleta y dónde comprarla. Fondo del club, sin patrocinadores ni otros logos.
 */
export function CartelLoteria({ datos }: { datos: DatosLoteria }) {
  const sorteo = SORTEOS_LOTERIA[datos.sorteo];
  // El del Neno se juega en xaneiro: el ano seguinte ao da tempada.
  const anio = datos.sorteo === "neno" ? datos.anio + 1 : datos.anio;
  const numeros = datos.numeros.length ? datos.numeros : ["·····"];
  const resto = donativo(datos.prezo, datos.xoga);
  const puntos = datos.puntos
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <Base
      compacto
      variante="club"
      izquierda={{ escudo: datos.escudoClub, propio: true, color: "#f5c518" }}
      institucionales={[]}
      patrocinadores={[]}
    >
      <div className={s.contenido}>
        <header className={s.cabecera} data-lectura-bloque>
          {datos.escudoClub && <img className={s.escudo} src={datos.escudoClub} alt="" />}
          <div>
            <div className={s.club}>UNIÓN DEPORTIVA SANTISO</div>
            <div className={s.etiqueta}>
              {sorteo.etiqueta} {anio}
            </div>
          </div>
        </header>

        {datos.titulo && (
          <h1 className={`${b.display} ${s.titulo}`} data-lectura-bloque data-lectura-columna>
            {datos.titulo.toUpperCase()}
          </h1>
        )}

        <div className={`${s.decimos} ${numeros.length === 2 ? s.dous : ""}`}>
          {numeros.map((n, i) => (
            <div key={i} className={s.decimo} data-lectura-bloque>
              <div className={s.numeroEtiqueta}>NÚMERO</div>
              <div className={`${b.display} ${s.numero}`}>{n}</div>
              <div className={s.sorteo}>
                SORTEO DO {sorteo.dia.toUpperCase()} DE {anio}
              </div>
            </div>
          ))}
        </div>

        {(datos.prezo || puntos.length > 0) && (
          <div className={s.datos}>
            {datos.prezo && (
              <div className={s.prezo} data-lectura-bloque>
                <div className={s.rotulo}>PAPELETA</div>
                <div className={`${b.display} ${s.importe}`}>{datos.prezo} €</div>
                {datos.xoga && (
                  <div className={s.detalle}>
                    Xoga {datos.xoga} €{resto && ` · donativo ${resto} €`}
                  </div>
                )}
              </div>
            )}
            {puntos.length > 0 && (
              <div className={s.puntos} data-lectura-bloque data-lectura-columna>
                <div className={s.rotulo}>ONDE MERCALA</div>
                <ul>
                  {puntos.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </Base>
  );
}
