/* eslint-disable @next/next/no-img-element -- el cartel se exporta como imagen: sin optimizador */
import { SORTEOS_LOTERIA, urlFoto, type DatosLoteria } from "@/lib/cartel2/modelo";
import { Base } from "./Base";
import b from "./Base.module.css";
import s from "./CartelLoteria.module.css";

/** «22» y «20» → «2»; «2,50» y «2» → «0,50». Sin los dos importes, o si no hay donativo, vacío. */
function donativo(prezo: string, xoga: string) {
  const n = (t: string) => Math.round(Number(t.replace(",", ".")) * 100);
  if (!prezo || !xoga) return "";
  const resto = n(prezo) - n(xoga);
  if (resto <= 0) return "";
  return resto % 100 ? (resto / 100).toFixed(2).replace(".", ",") : String(resto / 100);
}

/** «20 € décimo + 2 € donativo», «4 € xogados + 1 € donativo» o «Xoga 4 €». */
function desglose(prezo: string, xoga: string) {
  if (!xoga) return "";
  const resto = donativo(prezo, xoga);
  // A 20 € es el décimo entero de Nadal o del Neno; menos, una participación.
  const que = xoga === "20" ? "décimo" : "xogados";
  return resto ? `${xoga} € ${que} + ${resto} € donativo` : `Xoga ${xoga} €`;
}

const lineas = (texto: string) =>
  texto
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

/**
 * O Nadal do Santiso: la lotaría del club y, si ese año lo hay, el sorteo do Baúl. El décimo
 * en amarillo es el protagonista; con Baúl, el cartel va a dos columnas. Fondo del club, solo
 * el escudo: sin patrocinadores ni otros logos.
 */
export function CartelLoteria({ datos }: { datos: DatosLoteria }) {
  const sorteo = SORTEOS_LOTERIA[datos.sorteo];
  // El del Neno se juega en xaneiro: el ano seguinte ao da tempada.
  const anio = datos.sorteo === "neno" ? datos.anio + 1 : datos.anio;
  const numeros = datos.numeros.length ? datos.numeros : ["·····"];
  const detalle = desglose(datos.prezo, datos.xoga);
  const puntos = lineas(datos.puntos);
  const baul = datos.baul;
  const titulo = datos.titulo || `${sorteo.etiqueta} ${anio}`;

  const loteria = (
    <section className={s.loteria}>
      {baul && (
        <div className={s.rotulo} data-lectura-bloque>
          LOTARÍA NACIONAL
        </div>
      )}
      {datos.decimoFoto ? (
        // El décimo de verdad, fotografiado o escaneado; el número, grande debajo para leerlo.
        <div className={s.conFotoDecimo}>
          <div className={s.decimoFoto}>
            <img src={urlFoto(datos.decimoFoto)} alt="" />
          </div>
          <div className={s.numeroFoto} data-lectura-bloque>
            <span className={s.numeroFotoEtiqueta}>NÚMERO</span>
            <span className={`${b.display} ${s.numeroFotoCifras}`}>{numeros.join(" · ")}</span>
            <span className={s.numeroFotoSorteo}>
              {sorteo.dia.toUpperCase()} DE {anio}
            </span>
          </div>
        </div>
      ) : (
        <div className={`${s.decimos} ${numeros.length === 2 ? s.dous : ""}`}>
          {numeros.map((n, i) => (
            <div key={i} className={s.decimo} data-lectura-bloque>
              <div className={s.numeroEtiqueta}>{sorteo.etiqueta}</div>
              <div className={`${b.display} ${s.numero}`}>{n}</div>
              <div className={s.sorteo}>
                {sorteo.dia.toUpperCase()} DE {anio}
              </div>
            </div>
          ))}
        </div>
      )}
      {datos.prezo && (
        <div className={s.prezo} data-lectura-bloque>
          <span className={`${b.display} ${s.importe}`}>{datos.prezo} €</span>
          {detalle && <span className={s.detalle}>{detalle}</span>}
        </div>
      )}
      {puntos.length > 0 && (
        <div className={s.puntos} data-lectura-bloque>
          <div className={s.rotulo}>PUNTOS DE VENDA</div>
          <ul className={puntos.length > 3 && !baul ? s.dosColumnas : ""}>
            {puntos.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );

  return (
    <Base
      compacto
      variante="club"
      izquierda={{ escudo: datos.escudoClub, propio: true, color: "#f5c518" }}
      institucionales={[]}
      patrocinadores={[]}
    >
      <div className={`${s.contenido} ${baul ? s.conBaul : ""}`}>
        <header className={s.cabecera} data-lectura-bloque>
          {datos.escudoClub && <img className={s.escudo} src={datos.escudoClub} alt="" />}
          <div className={s.cabeceraTexto}>
            <div className={s.club}>UNIÓN DEPORTIVA SANTISO</div>
            <h1 className={`${b.display} ${s.titulo}`} data-lectura-columna>
              {titulo.toUpperCase()}
            </h1>
          </div>
        </header>

        <div className={s.cuerpo}>
          {loteria}
          {baul && (
            <section className={`${s.baul} ${baul.foto ? "" : s.sinFoto}`}>
              <div className={s.rotulo} data-lectura-bloque>
                SORTEO DO BAÚL
              </div>
              {baul.foto && (
                <div className={s.foto}>
                  <img src={urlFoto(baul.foto)} alt="" />
                </div>
              )}
              {baul.participar && (
                <div className={s.participar} data-lectura-bloque data-lectura-columna>
                  <div className={s.rotulo}>COMO PARTICIPAR?</div>
                  {lineas(baul.participar).map((l, i) =>
                    l.endsWith(":") ? (
                      <h2 key={i}>{l.slice(0, -1).toUpperCase()}</h2>
                    ) : (
                      <p key={i}>{l}</p>
                    ),
                  )}
                </div>
              )}
            </section>
          )}
        </div>

        <footer className={s.grazas} data-lectura-bloque>
          GRAZAS POLO VOSO APOIO
        </footer>
      </div>
    </Base>
  );
}
