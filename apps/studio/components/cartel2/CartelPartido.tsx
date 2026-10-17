import {
  categoriaCartel,
  cuerpo,
  fechaCorta,
  type Composicion,
  type DatosPartido,
  type EquipoCartel,
  type FormaEquipo,
  type FormatoCartel,
} from "@/lib/cartel2/modelo";
import { Base } from "./Base";
import { Escudo } from "./Escudo";
import s from "./CartelPartido.module.css";

/** Ancho de la columna de cada equipo en el cartel, en px. */
const ANCHO_COLUMNA = 440;
/** Ancho medio de un carácter de la letra de los nombres, en em (medido: ≈ 0,37). */
const EM_NOMBRE = 0.4;

/**
 * Cuerpo del nombre de un equipo. Si cabe en una línea a buen tamaño, va en una y grande
 * («Atlético Éter»). Si no, va en dos y más contenido («A.C.U.D. Camporrapado»), midiendo por su
 * palabra más larga para que ninguna se salga de la columna.
 */
export function cuerpoNombre(nombre: string, propio: boolean) {
  const enUnaLinea = cuerpo(nombre, ANCHO_COLUMNA, propio ? 58 : 80, 36, EM_NOMBRE);
  if (enUnaLinea >= 54) return enUnaLinea;
  const masLarga = nombre.split(/\s+/).reduce((a, b) => (b.length > a.length ? b : a), "");
  return Math.min(
    cuerpo(masLarga, ANCHO_COLUMNA, propio ? 52 : 64, 30, EM_NOMBRE),
    cuerpo(nombre, ANCHO_COLUMNA * 2, propio ? 52 : 64, 30, EM_NOMBRE),
  );
}

function Equipo({ equipo }: { equipo: EquipoCartel }) {
  return (
    <div className={s.equipo} data-propio={equipo.propio}>
      <div className={s.huecoEscudo}>
        {equipo.escudo && (
          <Escudo className={s.escudo} src={equipo.escudo} relieve={equipo.relieve} />
        )}
      </div>
      <div
        className={s.nombre}
        data-nombre-equipo
        style={{ fontSize: cuerpoNombre(equipo.nombre, equipo.propio) }}
      >
        {equipo.nombre}
      </div>
    </div>
  );
}
function Forma({ datos, nombre }: { datos: FormaEquipo; nombre: string }) {
  if (datos.posicion === null && !datos.racha.length) return null;
  return (
    <section className={s.forma} aria-label={`Forma de ${nombre}`}>
      {datos.posicion !== null && (
        <div className={s.puesto}>
          <span className={s.etiqueta}>NA TÁBOA</span>
          <strong>{datos.posicion}º</strong>
        </div>
      )}
      {!!datos.racha.length && (
        <div className={s.ultimos}>
          <span className={s.etiqueta}>ÚLTIMOS ENCONTROS</span>
          <div className={s.racha} aria-label="De máis antigo a máis recente">
            {datos.racha.slice(-5).map((r, i) => (
              <span key={i} data-resultado={r}>
                {r}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/** El rival manda; el resto del contenido fluye para cerrar huecos si no hay contexto. */
export function CartelPartido({
  datos,
  composicion,
  formato,
}: {
  datos: DatosPartido;
  composicion: Composicion;
  formato?: FormatoCartel;
}) {
  const historia = formato === "historia";
  const contexto = datos.contexto;
  const hayForma =
    contexto &&
    [contexto.local, contexto.visitante].some((f) => f.posicion !== null || f.racha.length);
  return (
    <Base
      variante={composicion === "diagonal" ? "diagonal" : "centro"}
      izquierda={datos.local}
      derecha={datos.visitante}
      lineas
      historia={historia}
      foto={datos.foto ?? null}
      logosArriba="centro"
      institucionales={datos.institucionales}
      patrocinadores={datos.patrocinadores}
      // El nombre de la composición va también tal cual: una composición sin estilos propios
      // no tiene clase en el módulo y aun así hay que poder reconocerla.
      className={[composicion, s[composicion], historia ? s.historia : ""]
        .filter(Boolean)
        .join(" ")}
    >
      <div className={s.contenido}>
        <header className={s.cabecera}>
          <div className={s.antetitulo}>
            {historia ? "HOXE XOGAMOS" : "DÍA DE PARTIDO"} · {categoriaCartel(datos.categoria)} ·{" "}
            {datos.local.propio ? "NA CASA" : "FÓRA"}
          </div>
          {datos.competicion && (
            <div
              className={s.competicion}
              style={{ fontSize: cuerpo(datos.competicion, 1800, 30, 20, 0.55) }}
            >
              {datos.competicion}
            </div>
          )}
          {datos.jornada && <div className={s.xornada}>XORNADA {datos.jornada}</div>}
        </header>
        <div className={s.duelo}>
          <Equipo equipo={datos.local} />
          <div className={s.vs}>VS</div>
          <Equipo equipo={datos.visitante} />
        </div>
        <div className={s.cando} data-cando>
          {datos.fecha ? (
            <span className={s.fecha}>{fechaCorta(datos.fecha)}</span>
          ) : (
            <span className={s.pendiente}>Data por confirmar</span>
          )}
          {datos.hora && <span className={s.hora}>{datos.hora} h</span>}
        </div>
        {(datos.campo || datos.localidad) && (
          <div className={s.sede}>
            {datos.campo && (
              <div
                className={s.campo}
                style={{ fontSize: cuerpo(datos.campo, 1800, 42, 22, 0.52) }}
              >
                {datos.campo}
              </div>
            )}
            {datos.localidad && <div className={s.localidad}>{datos.localidad}</div>}
          </div>
        )}
        {hayForma && contexto && (
          <div className={s.contexto}>
            <Forma datos={contexto.local} nombre={datos.local.nombre} />
            <Forma datos={contexto.visitante} nombre={datos.visitante.nombre} />
          </div>
        )}
      </div>
    </Base>
  );
}
