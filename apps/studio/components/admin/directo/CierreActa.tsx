"use client";
import { etiquetaMinuto } from "@/lib/directo/reloj";
import type { EventoDirecto, PantallaDirecto } from "@/lib/directo/tipos";
import { ICONO, NOMBRE_TIPO } from "../eventos-presentacion";
import { descripcion, marcador } from "./modelo";
import s from "./Directo.module.css";

/** Lo apuntado, en orden, para repasarlo con el árbitro al cerrar el acta. */
export function CierreActa({
  pantalla,
  eventos,
}: {
  pantalla: PantallaDirecto;
  eventos: EventoDirecto[];
}) {
  const { partido, reloj, jugadores } = pantalla;
  const m = marcador(partido, eventos);
  return (
    <section className={s.cierre} aria-label="Para cerrar el acta">
      <h3>
        {partido.local} {m.local} – {m.visitante} {partido.visitante}
      </h3>
      {eventos.length === 0 && <p className={s.nota}>Todavía no hay nada apuntado.</p>}
      {([1, 2] as const).map((parte) => {
        const deParte = eventos.filter((e) => e.parte === parte);
        if (deParte.length === 0) return null;
        return (
          <div key={parte}>
            <h4>{parte === 1 ? "1ª parte" : "2ª parte"}</h4>
            <ol className={s.cierreLista} aria-label={parte === 1 ? "1ª parte" : "2ª parte"}>
              {deParte.map((e) => (
                <li key={e.id} data-lado={e.lado}>
                  <div className={s.cierreArriba}>
                    <span className={s.minuto}>
                      {etiquetaMinuto(e.parte, e.minuto, reloj.duracionParte) || "—"}
                    </span>
                    <span>
                      {ICONO[e.tipo]} {NOMBRE_TIPO[e.tipo]}
                    </span>
                    <span className={s.lado}>{e.lado === "propio" ? "Nosotros" : "Rival"}</span>
                  </div>
                  <div className={s.cierreQuien}>{descripcion(e, jugadores)}</div>
                </li>
              ))}
            </ol>
          </div>
        );
      })}
    </section>
  );
}
