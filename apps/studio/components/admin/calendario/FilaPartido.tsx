"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/foundation/Button";
import { Field, Select } from "@/components/ui/foundation/Fields";
import type { CampoDto } from "@/lib/dto";
import type { LeagueMatch } from "@/lib/lecturas-cliente";
import {
  borrarPartido,
  cambiarCampoPartido,
  cambiarEstadoPartido,
  cambiarFechaPartido,
  guardarMarcador,
} from "@/lib/server/acciones/calendario";
import { matchDateTimeLocalInput, matchLocalDateTimeToIso } from "../cartel/matchDateTime";
import styles from "./Calendario.module.css";

interface Props {
  /** Qué jornada es, cuando la lista mezcla varias (vista «Partidos del Santiso»). */
  contexto?: string;
  partido: LeagueMatch;
  local: string;
  visitante: string;
  escudoLocal: string;
  escudoVisitante: string;
  campos: CampoDto[];
  conCambios: boolean;
  onEditar: (cambio: Partial<LeagueMatch>) => void;
  /** Recarga los partidos; con id, esa fila deja de contar como borrador. */
  onRecargar: (guardadoId?: string) => Promise<void>;
  showToast: (msg: string, type?: "success" | "error") => void;
  showConfirm: (msg: string, onConfirm: () => void) => void;
}

const ESTADOS = [
  { valor: "programado", etiqueta: "Programado" },
  { valor: "en_juego", etiqueta: "En juego" },
  { valor: "finalizado", etiqueta: "Finalizado" },
];

const golesAlCampo = (valor: unknown): string =>
  typeof valor === "number" && Number.isFinite(valor) ? String(valor) : "";
const golesDelCampo = (texto: string): number | null => {
  if (texto.trim() === "") return null;
  const numero = Number.parseInt(texto, 10);
  return Number.isNaN(numero) ? null : numero;
};

/** Un partido de la jornada: marcador, campo, fecha y estado, con su «Guardar». */
export default function FilaPartido({
  contexto,
  partido: p,
  local,
  visitante,
  escudoLocal,
  escudoVisitante,
  campos,
  conCambios,
  onEditar,
  onRecargar,
  showToast,
  showConfirm,
}: Props) {
  const [ocupada, setOcupada] = useState(false);
  const enCurso = useRef(false);
  const nombre = `${local} - ${visitante}`;

  // Mismo orden que antes de la 6G: marcador, fecha y campo. Si uno falla, los siguientes no
  // se mandan y la fila conserva lo escrito.
  async function guardar() {
    if (enCurso.current) return;
    enCurso.current = true;
    setOcupada(true);
    try {
      const marcador = await guardarMarcador(
        p.id,
        golesAlCampo(p.goles_local),
        golesAlCampo(p.goles_visitante),
      );
      if (!marcador.ok) return showToast(marcador.error, "error");
      const fecha = await cambiarFechaPartido(p.id, matchLocalDateTimeToIso(p.fecha) ?? "");
      if (!fecha.ok) return showToast(fecha.error, "error");
      const campo = await cambiarCampoPartido(p.id, p.campo_id ?? "");
      if (!campo.ok) return showToast(campo.error, "error");
      await onRecargar(p.id);
      showToast("Cambios guardados");
    } catch {
      showToast(
        "No se pudieron guardar todos los cambios. Revisa el partido y vuelve a intentarlo.",
        "error",
      );
    } finally {
      enCurso.current = false;
      setOcupada(false);
    }
  }

  async function cambiarEstado(estado: string) {
    try {
      const resultado = await cambiarEstadoPartido(p.id, estado);
      if (resultado.ok) await onRecargar();
      else showToast(resultado.error, "error");
    } catch {
      showToast("No se pudo cambiar el estado. Comprueba la conexión.", "error");
    }
  }

  function borrar() {
    showConfirm(`¿Borrar el partido ${nombre} de la jornada?`, async () => {
      setOcupada(true);
      try {
        const resultado = await borrarPartido(p.id);
        if (resultado.ok) {
          await onRecargar();
          showToast("Partido eliminado");
        } else {
          showToast(resultado.error, "error");
        }
      } finally {
        setOcupada(false);
      }
    });
  }

  return (
    <section className={styles.partido} aria-label={nombre} data-cambios={conCambios}>
      {contexto && <p className={styles.contextoFila}>{contexto}</p>}
      <div className={styles.marcador}>
        <div className={styles.equipo}>
          <span>{local}</span>
          {escudoLocal && (
            // eslint-disable-next-line @next/next/no-img-element -- media local servida por el route handler
            <img src={escudoLocal} alt="" />
          )}
        </div>
        <div className={styles.goles}>
          <Field
            label={`Goles de ${local}`}
            type="number"
            min={0}
            inputMode="numeric"
            value={golesAlCampo(p.goles_local)}
            onChange={(e) => onEditar({ goles_local: golesDelCampo(e.target.value) })}
            disabled={ocupada}
          />
          <span aria-hidden="true">–</span>
          <Field
            label={`Goles de ${visitante}`}
            type="number"
            min={0}
            inputMode="numeric"
            value={golesAlCampo(p.goles_visitante)}
            onChange={(e) => onEditar({ goles_visitante: golesDelCampo(e.target.value) })}
            disabled={ocupada}
          />
        </div>
        <div className={styles.equipo}>
          {escudoVisitante && (
            // eslint-disable-next-line @next/next/no-img-element -- media local servida por el route handler
            <img src={escudoVisitante} alt="" />
          )}
          <span>{visitante}</span>
        </div>
      </div>

      <div className={styles.detalle}>
        <Select
          label="Campo"
          value={p.campo_id || ""}
          onChange={(e) => onEditar({ campo_id: e.target.value })}
          disabled={ocupada}
        >
          <option value="">Sin asignar</option>
          {campos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </Select>
        <Field
          label="Fecha y hora"
          type="datetime-local"
          value={matchDateTimeLocalInput(p.fecha)}
          onChange={(e) => onEditar({ fecha: e.target.value })}
          disabled={ocupada}
        />
        <Select
          label="Estado"
          value={p.estado ?? "programado"}
          onChange={(e) => void cambiarEstado(e.target.value)}
          disabled={ocupada}
        >
          {ESTADOS.map((e) => (
            <option key={e.valor} value={e.valor}>
              {e.etiqueta}
            </option>
          ))}
        </Select>
      </div>

      <div className={styles.pieFila}>
        {conCambios && <p className={styles.nota}>Cambios sin guardar</p>}
        <Button onClick={() => void guardar()} pending={ocupada} pendingLabel="Guardando…">
          Guardar
        </Button>
        <Button
          variant="danger"
          onClick={borrar}
          disabled={ocupada}
          aria-label={`Borrar ${nombre}`}
        >
          Borrar
        </Button>
      </div>
    </section>
  );
}
