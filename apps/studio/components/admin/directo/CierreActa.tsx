"use client";
import { etiquetaMinuto } from "@/lib/directo/reloj";
import type { EventoDirecto, PantallaDirecto } from "@/lib/directo/tipos";
import { descripcion, ICONO, marcador, NOMBRE_TIPO } from "./modelo";
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
  const equipo = (e: EventoDirecto) =>
    e.lado === "propio"
      ? partido.somosLocal
        ? partido.local
        : partido.visitante
      : partido.somosLocal
        ? partido.visitante
        : partido.local;
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
            <table className={s.tabla}>
              <thead>
                <tr>
                  <th>Min.</th>
                  <th>Equipo</th>
                  <th>Qué</th>
                  <th>Quién</th>
                </tr>
              </thead>
              <tbody>
                {deParte.map((e) => (
                  <tr key={e.id} data-lado={e.lado}>
                    <td>{etiquetaMinuto(e.parte, e.minuto, reloj.duracionParte) || "—"}</td>
                    <td>{equipo(e)}</td>
                    <td>
                      {ICONO[e.tipo]} {NOMBRE_TIPO[e.tipo]}
                    </td>
                    <td>{descripcion(e, jugadores)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </section>
  );
}
