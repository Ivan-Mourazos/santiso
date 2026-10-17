"use client";

import { useState } from "react";
import { cargarPartidosHistoricosRfgf } from "@/lib/server/acciones/rfgf";
import s from "./Federacion.module.css";

type Archivo = Extract<
  Awaited<ReturnType<typeof cargarPartidosHistoricosRfgf>>,
  { ok: true }
>["datos"];
type Evento = Archivo["partidos"][number]["eventos"][number];

const ICONO: Record<Evento["tipo"], string> = {
  gol: "⚽",
  gol_propia: "⚽ (p.p.)",
  amarilla: "🟨",
  doble_amarilla: "🟨🟨",
  roja: "🟥",
};

const FECHA = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "numeric", year: "2-digit" });
function fecha(texto: string | null) {
  if (!texto) return "";
  const f = new Date(texto);
  return Number.isNaN(f.getTime()) ? texto : FECHA.format(f);
}

/**
 * Los partidos del Santiso de una temporada pasada, ya traídos de la federación. Se leen al
 * desplegar: solo datos guardados, sin salir a la red.
 */
export function ArchivoPartidos({ codGrupo }: { codGrupo: string }) {
  const [archivo, setArchivo] = useState<Archivo | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    const r = await cargarPartidosHistoricosRfgf(codGrupo);
    if (!r.ok) return setError(r.error);
    setError(null);
    setArchivo(r.datos);
  }

  return (
    <details
      className={s.archivoPartidos}
      onToggle={(e) => {
        if ((e.currentTarget as HTMLDetailsElement).open && !archivo) void cargar();
      }}
    >
      <summary>Ver partidos</summary>
      {error && <p role="alert">{error}</p>}
      {!archivo && !error && <p className={s.nota}>Cargando…</p>}
      {archivo && archivo.partidos.length === 0 && (
        <p className={s.nota}>Todavía no hay partidos traídos de esta temporada.</p>
      )}
      {archivo && archivo.partidos.length > 0 && (
        <ol className={s.partidosHistoricos}>
          {archivo.partidos.map((p) => (
            <li key={p.id}>
              <div className={s.cabeceraHistorico}>
                <span>
                  J{p.jornada} · {fecha(p.fecha ?? p.fechaNominal)}
                </span>
                <strong>
                  {p.local} {p.golesLocal ?? "–"}–{p.golesVisitante ?? "–"} {p.visitante}
                </strong>
              </div>
              {p.eventos.length > 0 && (
                <p className={s.eventos}>
                  {p.eventos
                    .map(
                      (e) =>
                        `${ICONO[e.tipo]} ${e.persona}${e.minuto ? ` ${e.minuto}'` : ""}`,
                    )
                    .join(" · ")}
                </p>
              )}
              {p.aviso && <p className={s.nota}>{p.aviso}</p>}
              {p.enlaceActa && (
                <a href={p.enlaceActa} target="_blank" rel="noreferrer" className={s.enlaceActa}>
                  Acta oficial ↗
                </a>
              )}
            </li>
          ))}
        </ol>
      )}
    </details>
  );
}
