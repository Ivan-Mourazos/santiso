/* eslint-disable @next/next/no-img-element -- el cartel se exporta como imagen: sin optimizador */
import type { CSSProperties } from "react";
import {
  categoriaCartel,
  cuerpo,
  fechaCartel,
  type DatosProximos,
  type PartidoProximo,
} from "@/lib/cartel2/modelo";
import { Base, coloresDe } from "./Base";
import b from "./Base.module.css";
import s from "./CartelProximos.module.css";

function Banda({ partido, uno }: { partido: PartidoProximo; uno: boolean }) {
  const l = coloresDe(partido.local);
  const v = coloresDe(partido.visitante);
  const estilo = {
    "--l-base": l.base,
    "--l-luz": l.luz,
    "--v-base": v.base,
    "--v-luz": v.luz,
  } as CSSProperties;
  const fecha = fechaCartel(partido.fecha);
  const nombre = (texto: string) => ({
    fontSize: cuerpo(texto, uno ? 380 : 300, uno ? 34 : 28, 18, 0.5),
  });

  return (
    <section className={`${s.banda} ${uno ? s.uno : ""}`} style={estilo}>
      <div className={s.color} />
      <div className={s.corte} />
      {partido.local.escudo && (
        <img className={`${b.escudo} ${s.escudoLocal}`} src={partido.local.escudo} alt="" />
      )}
      {partido.visitante.escudo && (
        <img className={`${b.escudo} ${s.escudoVisitante}`} src={partido.visitante.escudo} alt="" />
      )}
      <div className={`${b.nombre} ${s.nombreLocal}`} style={nombre(partido.local.nombre)}>
        {partido.local.nombre.toUpperCase()}
      </div>
      <div className={`${b.nombre} ${s.nombreVisitante}`} style={nombre(partido.visitante.nombre)}>
        {partido.visitante.nombre.toUpperCase()}
      </div>
      <div className={s.centro}>
        <div className={s.categoria}>{categoriaCartel(partido.categoria)}</div>
        <div className={`${b.display} ${s.dia}`}>
          {fecha ? `${fecha.dia} ${fecha.numero} ${fecha.mes}` : "DATA POR DEFINIR"}
        </div>
        {partido.hora && <div className={`${b.display} ${s.hora}`}>{partido.hora}</div>}
        {partido.campo && (
          <div className={`${b.dato} ${s.campo}`}>{partido.campo.toUpperCase()}</div>
        )}
      </div>
    </section>
  );
}

/**
 * Próximos encuentros: una banda de lado a lado por partido (sénior y veteranos, dos como
 * mucho), con los colores de cada equipo partidos en diagonal. Con uno solo, ocupa todo.
 */
export function CartelProximos({ datos }: { datos: DatosProximos }) {
  const partidos = datos.partidos.slice(0, 2);
  return (
    <Base
      variante="club"
      logosArriba="centro"
      institucionales={datos.institucionales}
      patrocinadores={datos.patrocinadores}
    >
      <header className={s.cabecera}>
        <div className={s.antetitulo}>AXENDA DA FIN DE SEMANA</div>
        <div className={b.xornada}>PRÓXIMOS ENCONTROS</div>
      </header>
      <div className={`${s.bandas} ${partidos.length === 1 ? s.bandasUna : ""}`}>
        {partidos.map((p, i) => (
          <Banda key={`${p.categoria}-${i}`} partido={p} uno={partidos.length === 1} />
        ))}
      </div>
    </Base>
  );
}
