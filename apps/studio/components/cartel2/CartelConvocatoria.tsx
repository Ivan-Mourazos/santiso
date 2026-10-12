import { categoriaCartel, fechaCorta, type DatosConvocatoria } from "@/lib/cartel2/modelo";
import { Base } from "./Base";
import { Escudo } from "./Escudo";
import b from "./Base.module.css";
import s from "./CartelConvocatoria.module.css";

export function CartelConvocatoria({ datos }: { datos: DatosConvocatoria }) {
  const nota = datos.nota.replace(/\s+/g, " ").trim();
  const equipos = datos.local ? [datos.club, datos.rival] : [datos.rival, datos.club];
  return (
    <Base
      compacto
      variante="club"
      izquierda={datos.club}
      institucionales={datos.institucionales}
      patrocinadores={datos.patrocinadores}
    >
      <div className={s.contenido} data-ampliada={datos.convocados.length > 16}>
        <header data-lectura-bloque>
          <div className={s.categoria}>{categoriaCartel(datos.categoria)}</div>
          <h1 className={b.display}>CONVOCATORIA</h1>
          <p>
            {datos.competicion} · XORNADA {datos.jornada}
          </p>
        </header>
        <div className={s.cruce} data-lectura-bloque>
          {equipos.map((e, i) => (
            <div key={i} className={s.equipo} data-propio={e.propio}>
              {e.escudo && <Escudo className={s.escudo} src={e.escudo} relieve={e.relieve} />}
              <strong data-lectura-columna>{e.nombre}</strong>
            </div>
          ))}
        </div>
        <div className={s.cuando} data-lectura-bloque>
          {[fechaCorta(datos.fecha), datos.hora].filter(Boolean).join(" · ") || "DATA POR DEFINIR"}
        </div>
        {datos.campo && (
          <div className={s.campo} data-lectura-bloque>
            {datos.campo}
          </div>
        )}
        {(datos.horaQuedada || datos.lugarQuedada || datos.equipacion) && (
          <div className={s.quedada} data-lectura-bloque>
            {(datos.horaQuedada || datos.lugarQuedada) && (
              <p>
                <b>Quedada</b> {[datos.horaQuedada, datos.lugarQuedada].filter(Boolean).join(" · ")}
              </p>
            )}
            {datos.equipacion && (
              <p>
                <b>Equipación</b> {datos.equipacion}
              </p>
            )}
          </div>
        )}
        <ol
          className={s.lista}
          data-lectura-bloque
          style={{
            gridTemplateRows: `repeat(${Math.ceil(datos.convocados.length / 2)}, minmax(0, 1fr))`,
          }}
        >
          {datos.convocados.map((j, i) => (
            <li key={i} data-lectura-fila>
              <b>{j.dorsal}</b>
              <span data-lectura-columna>{j.nombre}</span>
            </li>
          ))}
        </ol>
        {nota && (
          <p className={s.nota} data-lectura-bloque>
            {nota}
          </p>
        )}
      </div>
    </Base>
  );
}
