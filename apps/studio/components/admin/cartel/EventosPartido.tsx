"use client";
/**
 * Eventos del partido como un acta: una línea por evento (minuto, icono, jugador, equipo).
 * Al tocar una línea se abre una hoja con los controles grandes; «+ Evento» añade uno y abre
 * su hoja directamente.
 */
import { useState } from "react";
import { Button } from "@/components/ui/foundation/Button";
import { Dialog } from "@/components/ui/foundation/Dialog";
import type { CronEvent } from "@/lib/cartel/types";
import { nombreDeCartel } from "@/lib/cartel2/modelo";
import s from "./EventosPartido.module.css";

export interface JugadorEvento {
  id: string;
  nombre?: string | null;
  apodo?: string | null;
  dorsal?: number | string | null;
}

const TIPOS: { tipo: CronEvent["tipo"]; icono: string; nombre: string }[] = [
  { tipo: "gol", icono: "⚽", nombre: "Gol" },
  { tipo: "penalti", icono: "🥅", nombre: "Penalti" },
  { tipo: "propia", icono: "🔴", nombre: "En propia" },
  { tipo: "amarela", icono: "🟨", nombre: "Amarela" },
  { tipo: "doble_amarela", icono: "🟨🟨", nombre: "Doble amarela" },
  { tipo: "vermella", icono: "🟥", nombre: "Vermella" },
  { tipo: "cambio", icono: "🔁", nombre: "Cambio" },
];
const DEL_TIPO = Object.fromEntries(TIPOS.map((t) => [t.tipo, t])) as Record<
  CronEvent["tipo"],
  (typeof TIPOS)[number]
>;

/** Apodo, o nombre y primer apellido: como sale el jugador en el cartel. */
export function nombreJugador(j: JugadorEvento) {
  if (j.apodo) return j.apodo;
  if (!j.nombre) return "";
  const partes = j.nombre.split(" ");
  return partes.length > 1 ? `${partes[0]} ${partes[1]}` : j.nombre;
}

/** «45+2» → 45,002: para ordenar la lista por minuto sin tocar el orden guardado. */
function valorMinuto(minuto: string) {
  const m = /^(\d+)(?:\s*\+\s*(\d+))?/.exec(minuto.trim());
  if (!m) return Number.POSITIVE_INFINITY;
  return Number(m[1]) + Number(m[2] ?? 0) / 1000;
}

function textoEvento(ev: CronEvent) {
  const sale = nombreDeCartel(ev.jugador ?? "");
  if (ev.tipo === "cambio") {
    const entra = nombreDeCartel(ev.jugadorEntra ?? "");
    if (!sale && !entra) return "";
    return `${sale || "?"} ⇄ ${entra || "?"}`;
  }
  return sale;
}

export function EventosPartido({
  eventos,
  jugadores,
  addEvent,
  updateEvent,
  removeEvent,
  titulo = true,
}: {
  eventos: CronEvent[];
  /** Plantilla de la categoría del partido. */
  jugadores: JugadorEvento[];
  addEvent: () => void;
  updateEvent: (i: number, patch: Partial<CronEvent>) => void;
  removeEvent: (id: string) => void;
  /** Sin título cuando ya lo lleva el desplegable que lo envuelve. */
  titulo?: boolean;
}) {
  const [elegido, setElegido] = useState<string | null>(null);
  // Tras «+ Evento», cuántos había: en cuanto aparece el nuevo (el último), se abre su hoja.
  const [nuevoDesde, setNuevoDesde] = useState<number | null>(null);
  const editando =
    elegido ??
    (nuevoDesde !== null && eventos.length > nuevoDesde ? eventos[eventos.length - 1]!.id : null);
  const cerrar = () => {
    setElegido(null);
    setNuevoDesde(null);
  };

  const orden = eventos
    .map((ev, i) => ({ ev, i }))
    .sort((a, b) => valorMinuto(a.ev.minuto) - valorMinuto(b.ev.minuto) || a.i - b.i);

  const indice = editando ? eventos.findIndex((e) => e.id === editando) : -1;
  const actual = indice >= 0 ? eventos[indice]! : null;

  return (
    <section className={s.eventos} aria-label="Eventos del partido">
      <div className={s.cabecera}>
        {titulo ? (
          <h3 className={s.titulo}>
            Eventos <span>{eventos.length}</span>
          </h3>
        ) : (
          <span />
        )}
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setElegido(null);
            setNuevoDesde(eventos.length);
            addEvent();
          }}
        >
          + Evento
        </Button>
      </div>
      {eventos.length === 0 ? (
        <p className={s.vacio}>No hay eventos registrados</p>
      ) : (
        <ul className={s.lista}>
          {orden.map(({ ev }) => {
            const texto = textoEvento(ev);
            const tipo = DEL_TIPO[ev.tipo] ?? DEL_TIPO.gol;
            return (
              <li key={ev.id}>
                <button
                  type="button"
                  className={s.fila}
                  data-equipo={ev.equipo}
                  onClick={() => {
                    setNuevoDesde(null);
                    setElegido(ev.id);
                  }}
                  aria-label={`Editar: ${ev.minuto || "sin minuto"}' ${tipo.nombre} ${texto || "sin jugador"}, ${ev.equipo === "local" ? "Santiso" : "rival"}`}
                >
                  <span className={s.minuto}>{ev.minuto ? `${ev.minuto}'` : "–"}</span>
                  <span className={s.icono} aria-hidden="true">
                    {tipo.icono}
                  </span>
                  <span className={s.jugador} data-vacio={!texto}>
                    {texto || "Sin jugador"}
                  </span>
                  <span className={s.equipo}>{ev.equipo === "local" ? "Santiso" : "Rival"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog
        open={actual !== null}
        onClose={() => cerrar()}
        title="Evento del partido"
        mobilePresentation="sheet"
        footer={
          actual && (
            <div className={s.pie}>
              <Button
                variant="danger"
                onClick={() => {
                  removeEvent(actual.id);
                  cerrar();
                }}
              >
                Borrar evento
              </Button>
              <Button onClick={() => cerrar()}>Listo</Button>
            </div>
          )
        }
      >
        {actual && (
          <EditorEvento
            ev={actual}
            jugadores={jugadores}
            cambiar={(patch) => updateEvent(indice, patch)}
          />
        )}
      </Dialog>
    </section>
  );
}

function EditorEvento({
  ev,
  jugadores,
  cambiar,
}: {
  ev: CronEvent;
  jugadores: JugadorEvento[];
  cambiar: (patch: Partial<CronEvent>) => void;
}) {
  const idDe = (nombre: string | undefined) =>
    jugadores.find((j) => nombreJugador(j) === nombre)?.id ?? "";
  const nombreDe = (id: string) => {
    const j = jugadores.find((x) => x.id === id);
    return j ? nombreJugador(j) : "";
  };

  const selector = (campo: "jugador" | "jugadorEntra", etiqueta: string, conDorsal: boolean) =>
    ev.equipo === "local" ? (
      <label className={s.campo}>
        <span>{etiqueta}</span>
        <select
          value={idDe(ev[campo])}
          onChange={(e) => cambiar({ [campo]: nombreDe(e.target.value) })}
        >
          <option value="">—</option>
          {jugadores.map((j) => (
            <option key={j.id} value={j.id}>
              {nombreJugador(j)}
              {conDorsal && j.dorsal != null && j.dorsal !== "" ? ` (#${j.dorsal})` : ""}
            </option>
          ))}
        </select>
      </label>
    ) : (
      <label className={s.campo}>
        <span>{etiqueta}</span>
        <input
          type="text"
          value={ev[campo] ?? ""}
          placeholder="Nombre del rival"
          onChange={(e) => cambiar({ [campo]: e.target.value })}
        />
      </label>
    );

  return (
    <div className={s.editor}>
      <div className={s.par}>
        <label className={s.campo}>
          <span>Minuto</span>
          <input
            type="text"
            inputMode="numeric"
            placeholder="Min"
            value={ev.minuto}
            onChange={(e) => cambiar({ minuto: e.target.value })}
          />
        </label>
        <div className={s.campo}>
          <span>Equipo</span>
          <div role="group" aria-label="Equipo del evento" className={s.lados}>
            {(["local", "rival"] as const).map((equipo) => (
              <Button
                key={equipo}
                variant={ev.equipo === equipo ? "primary" : "secondary"}
                aria-pressed={ev.equipo === equipo}
                onClick={() =>
                  ev.equipo !== equipo && cambiar({ equipo, jugador: "", jugadorEntra: "" })
                }
              >
                {equipo === "local" ? "Santiso" : "Rival"}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div role="group" aria-label="Tipo de evento" className={s.tipos}>
        {TIPOS.map((t) => (
          <button
            key={t.tipo}
            type="button"
            className={s.tipo}
            aria-pressed={ev.tipo === t.tipo}
            onClick={() => cambiar({ tipo: t.tipo, jugadorEntra: "" })}
          >
            <span aria-hidden="true">{t.icono}</span>
            {t.nombre}
          </button>
        ))}
      </div>

      {ev.tipo === "cambio" ? (
        <div className={`${s.par} ${s.parIgual}`}>
          {selector("jugador", "Sale", false)}
          {selector("jugadorEntra", "Entra", false)}
        </div>
      ) : (
        selector("jugador", "Jugador", true)
      )}
    </div>
  );
}
