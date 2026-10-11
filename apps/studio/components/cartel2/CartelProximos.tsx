import type { CSSProperties } from "react";
import {
  categoriaCartel,
  fechaCartel,
  type DatosProximos,
  type FormatoCartel,
  type PartidoProximo,
} from "@/lib/cartel2/modelo";
import { Base, coloresDe } from "./Base";
import { Escudo } from "./Escudo";
import s from "./CartelProximos.module.css";

function Banda({ partido }: { partido: PartidoProximo }) {
  const rival = partido.local.propio ? partido.visitante : partido.local;
  const color = coloresDe(rival);
  const fecha = fechaCartel(partido.fecha);
  return (
    <section
      data-axenda-partido
      className={s.banda}
      style={{ "--rival-base": color.base, "--rival-luz": color.luz } as CSSProperties}
    >
      <div className={s.informacion}>
        <div className={s.categoria}>
          <span>{categoriaCartel(partido.categoria)}</span>
          <span className={s.localia}>{partido.local.propio ? "NA CASA" : "FÓRA"}</span>
        </div>
        <div className={s.rival}>{rival.nombre}</div>
        <div className={s.momento}>
          {fecha ? (
            <div className={s.fecha}>
              <span className={s.dia}>{fecha.dia}</span>
              <span className={s.numero}>
                {fecha.numero} {fecha.mes}
              </span>
            </div>
          ) : (
            <div className={s.pendiente}>Data por confirmar</div>
          )}
          {partido.hora && (
            <div className={s.hora}>
              {partido.hora}
              <span> h</span>
            </div>
          )}
        </div>
      </div>
      <div className={s.escudoZona}>
        {rival.escudo ? (
          <Escudo className={s.escudo} src={rival.escudo} relieve={rival.relieve} />
        ) : (
          <span className={s.sinEscudo}>VS</span>
        )}
      </div>
    </section>
  );
}

/** Agenda mínima; todas las bandas se reparten el alto disponible, de uno a cuatro partidos. */
export function CartelProximos({
  datos,
  formato,
}: {
  datos: DatosProximos;
  formato?: FormatoCartel;
}) {
  const partidos = datos.partidos.slice(0, 4);
  const historia = formato === "historia";
  return (
    <Base
      variante="club"
      historia={historia}
      logosArriba="centro"
      institucionales={datos.institucionales}
      patrocinadores={datos.patrocinadores}
      className={`${s.cartel} ${historia ? s.historia : ""}`}
    >
      <header className={s.cabecera}>
        <div className={s.antetitulo}>{historia ? "HOXE XOGAMOS" : "AXENDA DA FIN DE SEMANA"}</div>
        <h1 className={s.titulo}>{historia ? "DÍA DE FÚTBOL" : "PRÓXIMOS ENCONTROS"}</h1>
      </header>
      <div
        data-axenda-bandas
        data-cantidad={partidos.length}
        className={s.bandas}
        style={{ gridTemplateRows: `repeat(${Math.max(1, partidos.length)}, minmax(0, 1fr))` }}
      >
        {partidos.map((p, i) => (
          <Banda key={i} partido={p} />
        ))}
        {!partidos.length && <div className={s.vacia}>A nosa próxima axenda, en breve.</div>}
      </div>
    </Base>
  );
}
