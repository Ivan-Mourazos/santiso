import { categoriaCartel, fechaCorta, goleadores, type DatosResultado } from "@/lib/cartel2/modelo";
import { Balon } from "./Balon";
import { Escudo } from "./Escudo";
import { Base } from "./Base";
import b from "./Base.module.css";
import s from "./CartelResultado.module.css";

export function CartelResultado({ datos }: { datos: DatosResultado }) {
  const golesPor = {
    local: goleadores(datos.goles, "local"),
    visitante: goleadores(datos.goles, "visitante"),
  };
  const pie = [fechaCorta(datos.fecha), datos.campo].filter(Boolean).join(" · ");
  return (
    <Base
      compacto
      variante="centro"
      izquierda={datos.local}
      derecha={datos.visitante}
      foto={datos.foto}
      institucionales={datos.institucionales}
      patrocinadores={datos.patrocinadores}
    >
      <div className={s.contenido}>
        <header className={s.cabecera} data-lectura-bloque>
          <h1 className={b.display}>RESULTADO</h1>
          <p>
            {categoriaCartel(datos.categoria)} · {datos.competicion}
            {datos.jornada ? ` · XORNADA ${datos.jornada}` : ""}
          </p>
        </header>
        <div className={s.cruce} data-lectura-bloque>
          {datos.local.escudo ? (
            <Escudo className={s.escudo} src={datos.local.escudo} relieve={datos.local.relieve} />
          ) : (
            <span className={s.escudo} />
          )}
          <div className={s.marcador} data-resultado-marcador>
            <strong className={datos.local.propio ? s.propio : ""}>{datos.golesLocal}</strong>
            <span>–</span>
            <strong className={datos.visitante.propio ? s.propio : ""}>
              {datos.golesVisitante}
            </strong>
          </div>
          {datos.visitante.escudo ? (
            <Escudo
              className={s.escudo}
              src={datos.visitante.escudo}
              relieve={datos.visitante.relieve}
            />
          ) : (
            <span className={s.escudo} />
          )}
        </div>
        <div className={s.nombres} data-lectura-bloque>
          <strong data-lectura-columna>{datos.local.nombre}</strong>
          <strong data-lectura-columna>{datos.visitante.nombre}</strong>
        </div>
        <div className={s.goleadores} data-lectura-bloque>
          {(["local", "visitante"] as const).map((lado) => (
            <ul key={lado}>
              {golesPor[lado].map((g) => (
                <li key={g.nombre} data-lectura-fila>
                  <Balon tamano={28} />
                  <span className={s.nombre} data-lectura-columna>
                    {g.nombre}
                    {g.goles > 1 && <span className={s.veces}> ×{g.goles}</span>}
                  </span>
                </li>
              ))}
            </ul>
          ))}
        </div>
        {pie && (
          <div className={s.pie} data-lectura-bloque>
            {pie}
          </div>
        )}
      </div>
    </Base>
  );
}
