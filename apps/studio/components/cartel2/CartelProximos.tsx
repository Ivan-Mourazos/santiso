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

function Banda({ partido, compacta }: { partido: PartidoProximo; compacta: boolean }) {
  const rival = partido.local.propio ? partido.visitante : partido.local;
  const color = coloresDe(rival);
  const fecha = fechaCartel(partido.fecha);
  return (
    <section
      data-axenda-partido
      className={s.banda}
      style={
        {
          "--rival-luz": color.luz,
          "--rival-luz2": color.luz2,
        } as CSSProperties
      }
    >
      <div className={s.informacion}>
        <div className={s.categoria} data-lectura-bloque>
          <span>{categoriaCartel(partido.categoria)}</span>
          <span className={s.localia}>{partido.local.propio ? "NA CASA" : "FÓRA"}</span>
        </div>
        <div className={s.rival} data-lectura-bloque data-lectura-columna>
          <span className={s.contra}>VS</span> {rival.nombre}
        </div>
        <div className={s.momento} data-lectura-bloque>
          {fecha ? (
            <div className={s.fecha}>
              <span className={s.dia}>{compacta ? fecha.dia.slice(0, 3) : fecha.dia}</span>
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
  // «Hoxe» solo vale si todo se juega el mismo día: una historia con sábado y domingo no es de hoy.
  const unSoloDia = new Set(partidos.map((p) => p.fecha)).size <= 1;
  const deHoy = historia && unSoloDia;
  return (
    <Base
      compacto
      variante="club"
      historia={historia}
      logosArriba="centro"
      institucionales={datos.institucionales}
      patrocinadores={datos.patrocinadores}
      className={`${s.cartel} ${historia ? s.historia : ""}`}
    >
      <header className={s.cabecera} data-lectura-bloque>
        <div className={s.antetitulo}>{deHoy ? "HOXE XOGAMOS" : "AXENDA DA FIN DE SEMANA"}</div>
        <h1 className={s.titulo}>{deHoy ? "DÍA DE FÚTBOL" : "PRÓXIMOS ENCONTROS"}</h1>
      </header>
      <div
        data-axenda-bandas
        data-cantidad={partidos.length}
        className={s.bandas}
        style={{ gridTemplateRows: `repeat(${Math.max(1, partidos.length)}, minmax(0, 1fr))` }}
      >
        {partidos.map((p, i) => (
          <Banda key={i} partido={p} compacta={partidos.length >= 3} />
        ))}
        {!partidos.length && <div className={s.vacia}>A nosa próxima axenda, en breve.</div>}
      </div>
    </Base>
  );
}
