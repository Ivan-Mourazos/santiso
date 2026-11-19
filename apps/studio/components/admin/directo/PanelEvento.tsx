"use client";
import { MINUTO_MAXIMO, type LadoEvento, type TipoEvento } from "@santiso/domain";
import { useState } from "react";
import { Button } from "@/components/ui/foundation/Button";
import { Field, Select } from "@/components/ui/foundation/Fields";
import { Dialog } from "@/components/ui/foundation/Dialog";
import { parteDeMinuto } from "@/lib/directo/reloj";
import type { EventoDirecto, JugadorDirecto } from "@/lib/directo/tipos";
import { NOMBRE_TIPO } from "../eventos-presentacion";
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
      <Field
        label={`${titulo}: dorsal del rival`}
        hint="Déjalo vacío si no conoces el dorsal."
        type="number"
        inputMode="numeric"
        min={0}
        max={999}
        value={dorsal ?? ""}
        onChange={(e) => {
          const n = e.target.value === "" ? null : Math.trunc(Number(e.target.value));
          onCambio(null, n !== null && Number.isFinite(n) && n >= 0 ? n : null);
        }}
      />
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
  const finParte = duracion * e.parte;
  const descuento = e.minuto !== null && e.minuto > finParte
    ? `Descuento: ${finParte}+${e.minuto - finParte}`
    : undefined;
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
          <Field
            label="Minuto"
            hint={descuento}
            type="number"
            inputMode="numeric"
            min={0}
            max={MINUTO_MAXIMO}
            value={e.minuto ?? ""}
            onChange={(ev) => {
              const n = ev.target.value === "" ? null : Math.trunc(Number(ev.target.value));
              const minuto = n !== null && n >= 0 && n <= MINUTO_MAXIMO ? n : null;
              cambiar({ minuto, parte: parteDeMinuto(minuto, parteElegida, duracion) });
            }}
          />
          <Select
            label="Parte"
            value={e.parte}
            onChange={(ev) => {
              const parte = ev.target.value === "2" ? 2 : 1;
              setParteElegida(parte);
              cambiar({ parte });
            }}
          >
            <option value={1}>1ª parte</option>
            <option value={2}>2ª parte</option>
          </Select>
        </div>
      </div>
    </Dialog>
  );
}
