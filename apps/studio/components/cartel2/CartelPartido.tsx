import {
  categoriaCartel,
  cuerpo,
  fechaCartel,
  type Composicion,
  type DatosPartido,
} from "@/lib/cartel2/modelo";
import { Escudo } from "./Escudo";
import { Base } from "./Base";
import b from "./Base.module.css";
import s from "./CartelPartido.module.css";

/**
 * Cartel de partido (previa). Dos composiciones sobre el mismo marcado: `diagonal` (por
 * defecto) y `enfrentados`. Nada se sale del cartel: escudos enteros y nombres a una línea.
 */
export function CartelPartido({
  datos,
  composicion,
}: {
  datos: DatosPartido;
  composicion: Composicion;
}) {
  const fecha = fechaCartel(datos.fecha);
  const huecoNombre = composicion === "enfrentados" ? 440 : 470;
  const nombre = (texto: string) => ({ fontSize: cuerpo(texto, huecoNombre, 40, 24, 0.5) });

  return (
    <Base
      variante={composicion === "diagonal" ? "diagonal" : "centro"}
      izquierda={datos.local}
      derecha={datos.visitante}
      lineas
      logosArriba={composicion === "diagonal" ? "derecha" : "centro"}
      institucionales={datos.institucionales}
      patrocinadores={datos.patrocinadores}
      className={s[composicion]}
    >
      {datos.local.escudo && (
        <Escudo
          className={`${b.escudo} ${s.escudoLocal}`}
          src={datos.local.escudo}
          relieve={datos.local.relieve}
        />
      )}
      {datos.visitante.escudo && (
        <Escudo
          className={`${b.escudo} ${s.escudoVisitante}`}
          src={datos.visitante.escudo}
          relieve={datos.visitante.relieve}
        />
      )}

      <div className={s.vs}>VS</div>

      <header className={`${b.cabecera} ${s.cabecera}`}>
        <div className={b.xornada}>
          {datos.jornada ? `XORNADA ${datos.jornada}` : "DÍA DE PARTIDO"}
        </div>
        <div className={b.competicion}>
          {categoriaCartel(datos.categoria)}
          {datos.competicion ? ` · ${datos.competicion.toUpperCase()}` : ""}
        </div>
      </header>

      <div className={`${b.nombre} ${s.nombreLocal}`} style={nombre(datos.local.nombre)}>
        {datos.local.nombre.toUpperCase()}
      </div>
      <div className={`${b.nombre} ${s.nombreVisitante}`} style={nombre(datos.visitante.nombre)}>
        {datos.visitante.nombre.toUpperCase()}
      </div>

      <div className={s.cuando}>
        {fecha ? (
          <div className={`${b.display} ${s.fecha}`}>
            <span className={s.dia}>{fecha.dia}</span>
            <span className={s.numero}>
              {fecha.numero} {fecha.mes}
            </span>
          </div>
        ) : (
          <div className={`${b.display} ${s.fecha}`}>
            <span className={s.sinFecha}>DATA POR DEFINIR</span>
          </div>
        )}
        {datos.hora && <div className={`${b.display} ${s.hora}`}>{datos.hora}</div>}
        {datos.campo && <div className={`${b.dato} ${s.campo}`}>{datos.campo.toUpperCase()}</div>}
      </div>
    </Base>
  );
}
