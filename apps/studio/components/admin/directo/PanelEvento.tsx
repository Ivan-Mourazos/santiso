"use client";
import type { LadoEvento, TipoEvento } from "@santiso/domain";
import { useState } from "react";
import { Button } from "@/components/ui/foundation/Button";
import { Dialog } from "@/components/ui/foundation/Dialog";
import { parteDeMinuto } from "@/lib/directo/reloj";
import type { EventoDirecto, JugadorDirecto } from "@/lib/directo/tipos";
import { NOMBRE_TIPO } from "./modelo";
import s from "./Directo.module.css";

/** Elegir jugador: rejilla de dorsales de los nuestros o teclado de dorsal del rival. */
function Eleccion({
  titulo,
  lado,
  jugadores,
  jugadorId,
  dorsal,
  onCambio,
}: {
  titulo: string;
  lado: LadoEvento;
  jugadores: JugadorDirecto[];
  jugadorId: string | null;
  dorsal: number | null;
  onCambio: (jugadorId: string | null, dorsal: number | null) => void;
}) {
  if (lado === "rival") {
    return (
      <label className={s.campo}>
        <span>{titulo}: dorsal del rival</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={999}
          placeholder="Sin dorsal"
          value={dorsal ?? ""}
          onChange={(e) => {
            const n = e.target.value === "" ? null : Math.trunc(Number(e.target.value));
            onCambio(null, n !== null && Number.isFinite(n) && n >= 0 ? n : null);
          }}
        />
      </label>
    );
  }
  return (
    <fieldset className={s.rejillaCampo}>
      <legend>{titulo}</legend>
      <ul className={s.rejilla}>
        {jugadores.map((j) => (
          <li key={j.id}>
            <button
              type="button"
              aria-pressed={jugadorId === j.id}
              aria-label={`${titulo}: ${j.dorsal !== null ? `#${j.dorsal} ` : ""}${j.nombre}`}
              onClick={() =>
                jugadorId === j.id ? onCambio(null, null) : onCambio(j.id, j.dorsal)
              }
            >
              <strong>{j.dorsal ?? "–"}</strong>
              <span>{j.nombre}</span>
            </button>
          </li>
        ))}
      </ul>
      {jugadores.length === 0 && <p className={s.nota}>No hay jugadores en la plantilla.</p>}
    </fieldset>
  );
}

export function PanelEvento({
  inicial,
  nuevo,
  jugadores,
  duracion,
  onGuardar,
  onBorrar,
  onCerrar,
}: {
  inicial: EventoDirecto;
  nuevo: boolean;
  jugadores: JugadorDirecto[];
  duracion: number;
  onGuardar: (e: EventoDirecto) => void;
  onBorrar: (id: string) => void;
  onCerrar: () => void;
}) {
  const [e, setE] = useState<EventoDirecto>(inicial);
  /** La parte elegida a propósito; el minuto a medio teclear no la cambia por el camino. */
  const [parteElegida, setParteElegida] = useState<1 | 2>(inicial.parte);
  const cambiar = (parche: Partial<EventoDirecto>) => setE((x) => ({ ...x, ...parche }));
  const tipo: TipoEvento = e.tipo;
  const cambiarLado = (lado: LadoEvento) =>
    cambiar({ lado, jugadorId: null, jugadorSaleId: null, dorsal: null, dorsalSale: null });

  return (
    <Dialog
      open
      onClose={onCerrar}
      title={`${nuevo ? "" : "Editar · "}${NOMBRE_TIPO[tipo]}`}
      mobilePresentation="sheet"
      footer={
        <div className={s.pie}>
          {!nuevo && (
            <Button variant="danger" onClick={() => onBorrar(e.id)}>
              Borrar
            </Button>
          )}
          <Button onClick={() => onGuardar(e)}>Guardar</Button>
        </div>
      }
    >
      <div className={s.panel}>
        <div className={s.lados} role="group" aria-label="Equipo">
          {(["propio", "rival"] as const).map((lado) => (
            <button
              key={lado}
              type="button"
              aria-pressed={e.lado === lado}
              onClick={() => cambiarLado(lado)}
            >
              {lado === "propio" ? "Nosotros" : "Rival"}
            </button>
          ))}
        </div>

        <Eleccion
          titulo={tipo === "cambio" ? "Entra" : tipo === "gol" ? "Marca" : "Jugador"}
          lado={e.lado}
          jugadores={jugadores}
          jugadorId={e.jugadorId}
          dorsal={e.dorsal}
          onCambio={(jugadorId, dorsal) => cambiar({ jugadorId, dorsal })}
        />
        {tipo === "cambio" && (
          <Eleccion
            titulo="Sale"
            lado={e.lado}
            jugadores={jugadores}
            jugadorId={e.jugadorSaleId}
            dorsal={e.dorsalSale}
            onCambio={(jugadorSaleId, dorsalSale) => cambiar({ jugadorSaleId, dorsalSale })}
          />
        )}
        {tipo === "gol" && (
          <label className={s.casilla}>
            <input
              type="checkbox"
              checked={e.propia}
              onChange={(ev) => cambiar({ propia: ev.target.checked })}
            />
            En propia puerta
          </label>
        )}

        <div className={s.fila}>
          <label className={s.campo}>
            <span>Minuto</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={130}
              value={e.minuto ?? ""}
              onChange={(ev) => {
                const n = ev.target.value === "" ? null : Math.trunc(Number(ev.target.value));
                const minuto = n !== null && n >= 0 && n <= 130 ? n : null;
                cambiar({ minuto, parte: parteDeMinuto(minuto, parteElegida, duracion) });
              }}
            />
          </label>
          <label className={s.campo}>
            <span>Parte</span>
            <select
              value={e.parte}
              onChange={(ev) => {
                const parte = ev.target.value === "2" ? 2 : 1;
                setParteElegida(parte);
                cambiar({ parte });
              }}
            >
              <option value={1}>1ª parte</option>
              <option value={2}>2ª parte</option>
            </select>
          </label>
        </div>
        {e.minuto !== null && e.minuto > duracion * e.parte && (
          <p className={s.nota}>
            Descuento: {duracion * e.parte}+{e.minuto - duracion * e.parte}
          </p>
        )}
      </div>
    </Dialog>
  );
}
