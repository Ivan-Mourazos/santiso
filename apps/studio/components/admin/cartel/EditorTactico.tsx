"use client";

import { useState } from "react";
import type { Posicion } from "@santiso/domain";
import { Camiseta } from "@/components/cartel2/Camiseta";
import { Button } from "@/components/ui/foundation/Button";
import { Dialog } from "@/components/ui/foundation/Dialog";
import { Select } from "@/components/ui/foundation/Fields";
import {
  cambiarSistema,
  huecosDe,
  ponerEnHueco,
  quitarDeHueco,
  SISTEMAS,
  type Colocacion,
  type Sistema,
} from "@/lib/cartel2/tactica";
import s from "./EditorTactico.module.css";

export interface JugadorTactico {
  id: string;
  nombre: string;
  dorsal: number | null;
  posicion: Posicion | null;
}

const LINEA = { POR: "Portero", DEF: "Defensa", MED: "Medio", DEL: "Delantero" } as const;

function Opcion({ j, onElegir }: { j: JugadorTactico; onElegir: (id: string) => void }) {
  return (
    <li>
      <button type="button" className={s.opcion} onClick={() => onElegir(j.id)}>
        <span className={s.opcionDorsal}>{j.dorsal ?? ""}</span>
        <span>{j.nombre}</span>
      </button>
    </li>
  );
}

/**
 * El once en el campo, como en las apps de fantasy: se elige el sistema, se toca un hueco y se
 * elige quién va; tocando a uno ya colocado se cambia por otro o se quita. Sin arrastrar.
 * `jugadores` son todos los que se pueden poner (titulares y banco); quién entra o sale del
 * once lo decide quien recibe `onCambio`. Con `onCapitan`, al tocar a uno colocado se le
 * puede dar o quitar la capitanía (la «C» sobre su camiseta).
 */
export function EditorTactico({
  jugadores,
  colocacion,
  onCambio,
  soloLectura = false,
  capitanId = null,
  onCapitan,
}: {
  jugadores: JugadorTactico[];
  colocacion: Colocacion;
  onCambio: (c: Colocacion) => void;
  soloLectura?: boolean;
  capitanId?: string | null;
  onCapitan?: (jugadorId: string) => void;
}) {
  const [elegido, setElegido] = useState<number | null>(null);
  const porId = new Map(jugadores.map((j) => [j.id, j]));
  const puntos = huecosDe(colocacion.sistema);
  const ocupante = elegido === null ? null : (colocacion.huecos[elegido] ?? null);
  const fuera = jugadores.filter((j) => !colocacion.huecos.includes(j.id));
  const enCampo = jugadores.filter((j) => colocacion.huecos.includes(j.id) && j.id !== ocupante);

  function elegir(jugadorId: string) {
    if (elegido === null) return;
    onCambio({ ...colocacion, huecos: ponerEnHueco(colocacion.huecos, elegido, jugadorId) });
    setElegido(null);
  }

  function quitar() {
    if (elegido === null) return;
    onCambio({ ...colocacion, huecos: quitarDeHueco(colocacion.huecos, elegido) });
    setElegido(null);
  }

  function sistema(nuevo: Sistema) {
    const actuales = colocacion.huecos
      .filter((id): id is string => id !== null)
      .map((id) => ({ id, posicion: porId.get(id)?.posicion ?? null }));
    onCambio({ sistema: nuevo, huecos: cambiarSistema(colocacion.huecos, nuevo, actuales) });
  }

  return (
    <section className={s.editor} aria-label="Once en el campo">
      <Select
        label="Sistema"
        value={colocacion.sistema}
        disabled={soloLectura}
        onChange={(e) => sistema(e.target.value as Sistema)}
      >
        {SISTEMAS.map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
      </Select>

      <div className={s.campo}>
        <div className={s.medio} />
        <div className={s.circulo} />
        <div className={`${s.area} ${s.arriba}`} />
        <div className={s.area} />
        {puntos.map((p, i) => {
          const id = colocacion.huecos[i] ?? null;
          const j = id ? porId.get(id) : undefined;
          const nombre = j?.nombre ?? "";
          return (
            <button
              key={i}
              type="button"
              className={s.hueco}
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              data-vacio={!j || undefined}
              disabled={soloLectura}
              onClick={() => setElegido(i)}
              aria-label={j ? `${LINEA[p.linea]}: ${nombre}${id === capitanId ? " (capitán)" : ""}. Cambiar` : `${LINEA[p.linea]}: vacío. Elegir jugador`}
            >
              {j ? (
                <Camiseta
                  className={s.camiseta}
                  dorsal={j.dorsal === null ? "" : String(j.dorsal)}
                  portero={i === 0}
                />
              ) : (
                <span className={s.mas} aria-hidden="true">
                  +
                </span>
              )}
              {j && id === capitanId && (
                <span className={s.capitan} aria-hidden="true">
                  C
                </span>
              )}
              <span className={s.nombre}>{j ? nombre : p.linea}</span>
            </button>
          );
        })}
      </div>

      <Dialog
        open={elegido !== null}
        onClose={() => setElegido(null)}
        title={
          elegido === null
            ? ""
            : ocupante
              ? `Cambiar a ${porId.get(ocupante)?.nombre ?? ""}`
              : `${LINEA[puntos[elegido]!.linea]}: elegir jugador`
        }
        mobilePresentation="sheet"
        footer={
          ocupante ? (
            <>
              {onCapitan && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    onCapitan(ocupante);
                    setElegido(null);
                  }}
                >
                  {ocupante === capitanId ? "Quitar capitanía" : "Hacer capitán"}
                </Button>
              )}
              <Button variant="secondary" onClick={quitar}>
                Quitar del campo
              </Button>
            </>
          ) : undefined
        }
      >
        {fuera.length > 0 && (
          <>
            <p className={s.grupo}>{ocupante ? "Entra" : "Sin colocar"}</p>
            <ul className={s.opciones}>
              {fuera.map((j) => (
                <Opcion key={j.id} j={j} onElegir={elegir} />
              ))}
            </ul>
          </>
        )}
        {enCampo.length > 0 && (
          <>
            <p className={s.grupo}>Cambiar de sitio con</p>
            <ul className={s.opciones}>
              {enCampo.map((j) => (
                <Opcion key={j.id} j={j} onElegir={elegir} />
              ))}
            </ul>
          </>
        )}
      </Dialog>
    </section>
  );
}
