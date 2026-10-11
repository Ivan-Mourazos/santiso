import { categoriaCartel, cuerpo, fechaCorta, type DatosConvocatoria } from "@/lib/cartel2/modelo";
import { Base } from "./Base";
import { Escudo } from "./Escudo";
import b from "./Base.module.css";
import s from "./CartelConvocatoria.module.css";

export function CartelConvocatoria({ datos }: { datos: DatosConvocatoria }) {
  const nota = datos.nota.replace(/\s+/g, " ").trim();
  const equipos = datos.local ? [datos.club, datos.rival] : [datos.rival, datos.club];
  return (
    <Base
      variante="club"
      izquierda={datos.club}
      institucionales={datos.institucionales}
      patrocinadores={datos.patrocinadores}
    >
      <div className={s.contenido}>
        <header>
          <div className={s.categoria}>{categoriaCartel(datos.categoria)}</div>
          <h1 className={b.display}>CONVOCATORIA</h1>
          <p>
            {datos.competicion} · XORNADA {datos.jornada}
          </p>
        </header>
        <div className={s.cruce}>
          {equipos.map((e, i) => (
            <div key={i} className={s.equipo}>
              {e.escudo && <Escudo className={s.escudo} src={e.escudo} relieve={e.relieve} />}
              <strong style={{ fontSize: cuerpo(e.nombre, 420, 36, 22, 0.5) }}>{e.nombre}</strong>
            </div>
          ))}
        </div>
        <div className={s.cuando}>
          {[fechaCorta(datos.fecha), datos.hora].filter(Boolean).join(" · ") || "DATA POR DEFINIR"}
        </div>
        {datos.campo && <div className={s.campo}>{datos.campo}</div>}
        {(datos.horaQuedada || datos.lugarQuedada || datos.equipacion) && (
          <div className={s.quedada}>
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
          style={{
            gridTemplateRows: `repeat(${Math.ceil(datos.convocados.length / 2)}, minmax(0, 1fr))`,
          }}
        >
          {datos.convocados.map((j, i) => (
            <li key={i}>
              <b>{j.dorsal}</b>
              <span style={{ fontSize: cuerpo(j.nombre, 360, 36, 22, 0.5) }}>{j.nombre}</span>
            </li>
          ))}
        </ol>
        {nota && (
          <p className={s.nota} style={{ fontSize: cuerpo(nota, 952 * 3, 23, 14, 0.5) }}>
            {nota}
          </p>
        )}
      </div>
    </Base>
  );
}
