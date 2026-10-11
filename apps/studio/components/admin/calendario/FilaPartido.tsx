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

const FECHA_CORTA = new Intl.DateTimeFormat("es-ES", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** «dom, 18/10, 17:00 · A Merced · Finalizado»: lo que en móvil se ve sin desplegar la fila. */
function resumenDe(partido: LeagueMatch, campos: CampoDto[]): string {
  const local = matchDateTimeLocalInput(partido.fecha);
  const fecha = local ? new Date(local) : null;
  const campo = campos.find((c) => c.id === partido.campo_id)?.nombre;
  const estado = ESTADOS.find((e) => e.valor === partido.estado)?.etiqueta;
  return [
    fecha && !Number.isNaN(fecha.getTime()) ? FECHA_CORTA.format(fecha) : "Sin fecha",
    campo ?? "Sin campo",
    partido.estado && partido.estado !== "programado" ? estado : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

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
  /** En móvil campo, fecha y estado están plegados; en escritorio siempre se ven. */
  const [abierta, setAbierta] = useState(false);
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
    <section
      className={styles.partido}
      aria-label={nombre}
      data-cambios={conCambios}
      data-contexto={contexto !== undefined}
      data-abierta={abierta}
    >
      {contexto !== undefined && <span className={styles.contextoFila}>{contexto}</span>}
      <div className={`${styles.equipo} ${styles.local}`}>
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
      <button
        type="button"
        className={styles.desplegar}
        aria-expanded={abierta}
        aria-label={`${abierta ? "Ocultar" : "Ver"} campo, fecha y estado de ${nombre}`}
        onClick={() => setAbierta((actual) => !actual)}
      >
        <svg
          aria-hidden="true"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <p className={styles.resumenFila}>{resumenDe(p, campos)}</p>
      <div className={styles.campo}>
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
      </div>
      <div className={styles.fecha}>
        <Field
          label="Fecha y hora"
          type="datetime-local"
          value={matchDateTimeLocalInput(p.fecha)}
          onChange={(e) => onEditar({ fecha: e.target.value })}
          disabled={ocupada}
        />
      </div>
      <div className={styles.estado}>
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
      <div className={styles.accionesFila}>
        {conCambios && <span className={styles.oculto}>Cambios sin guardar</span>}
        <Button
          size="sm"
          variant={conCambios ? "primary" : "secondary"}
          onClick={() => void guardar()}
          pending={ocupada}
          pendingLabel="Guardando…"
        >
          Guardar
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className={styles.borrar}
          onClick={borrar}
          disabled={ocupada}
          aria-label={`Borrar ${nombre}`}
          title="Borrar partido"
        >
          ✕
        </Button>
      </div>
    </section>
  );
}

/** Nombres de columna de la lista de partidos: una vez arriba, no en cada fila. */
export function CabeceraPartidos({ conContexto = false }: { conContexto?: boolean }) {
  return (
    <div className={styles.partidoCabecera} data-contexto={conContexto} aria-hidden="true">
      {conContexto && <span>Jornada</span>}
      <span className={styles.local}>Local</span>
      <span className={styles.centro}>Resultado</span>
      <span>Visitante</span>
      <span>Campo</span>
      <span>Fecha y hora</span>
      <span>Estado</span>
      <span />
    </div>
  );
}
