"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/foundation/Button";
import { Field, Select } from "@/components/ui/foundation/Fields";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/foundation/States";
import { Tabs } from "@/components/ui/foundation/Tabs";
import type { Disciplina, Goleador } from "@/lib/liga/tablas";
import { cargarLiga, guardarCicloAmarillas } from "@/lib/server/acciones/liga";
import type { PantallaLiga } from "@/lib/server/consultas/liga";
import { useCompeticiones } from "@/lib/useCompeticiones";
import styles from "./Liga.module.css";

interface Props {
  categoria: string;
  showToast: (msg: string, type?: "success" | "error") => void;
}

const SITUACION = {
  expulsado: "Expulsado",
  sancionado: "Sancionado",
  apercibido: "Apercibido",
} as const;

function Goleadores({ filas, propios }: { filas: Goleador[]; propios: Set<string> }) {
  if (filas.length === 0) return <p className={styles.vacio}>Todavía no hay goles cargados.</p>;
  return (
    <ol className={styles.lista} aria-label="Goleadores de la liga">
      {filas.map((g) => (
        <li
          key={`${g.equipoId}-${g.persona}`}
          className={styles.fila}
          data-propio={propios.has(g.equipoId)}
        >
          <span className={styles.puesto}>{g.puesto}</span>
          <span className={styles.quien}>
            <strong>{g.persona}</strong>
            <small>{g.equipo}</small>
          </span>
          <span className={styles.cifra} aria-label={`${g.goles} goles`}>
            {g.goles}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Tarjetas({ filas, propios }: { filas: Disciplina[]; propios: Set<string> }) {
  if (filas.length === 0) return <p className={styles.vacio}>Todavía no hay tarjetas cargadas.</p>;
  return (
    <ul className={styles.lista} aria-label="Tarjetas de la liga">
      {filas.map((d) => (
        <li
          key={`${d.equipoId}-${d.persona}`}
          className={styles.fila}
          data-propio={propios.has(d.equipoId)}
          data-situacion={d.situacion ?? undefined}
        >
          <span className={styles.quien}>
            <strong>{d.persona}</strong>
            <small>{d.equipo}</small>
            {d.situacion && (
              <small className={styles.motivo}>
                <b>{SITUACION[d.situacion]}.</b> {d.motivo}
              </small>
            )}
          </span>
          <span className={styles.tarjetas}>
            <span aria-label={`${d.amarillas} amarillas`}>
              <i className={styles.amarilla} aria-hidden="true" />
              {d.amarillas}
            </span>
            {d.expulsiones > 0 && (
              <span aria-label={`${d.expulsiones} expulsiones`}>
                <i className={styles.roja} aria-hidden="true" />
                {d.expulsiones}
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Goleadores y tarjetas de toda la liga, de todos los equipos. Salen de las actas que la
 * sincronización con la federación va cargando sola; aquí solo se consultan.
 */
export default function AdminLiga({ categoria, showToast }: Props) {
  const {
    selectedCompetitionId,
    setSelectedCompetitionId,
    competicionesEnCategoria,
    loadingCompeticiones,
    errorCompeticiones,
    loadCompeticiones,
  } = useCompeticiones(categoria, true);
  const [pantalla, setPantalla] = useState<PantallaLiga | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [pestana, setPestana] = useState("avisos");
  const [soloRival, setSoloRival] = useState("");
  const [ciclo, setCiclo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const generacion = useRef(0);

  const cargar = useCallback(async (competicionId: string) => {
    const esta = ++generacion.current;
    setCargando(true);
    setError(null);
    try {
      const resultado = await cargarLiga(competicionId);
      if (esta !== generacion.current) return;
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      setPantalla(resultado.datos);
      setCiclo(String(resultado.datos.ciclo));
    } catch {
      if (esta === generacion.current) setError("No se pudieron cargar los datos de la liga.");
    } finally {
      if (esta === generacion.current) setCargando(false);
    }
  }, []);
  useEffect(() => {
    if (selectedCompetitionId) void cargar(selectedCompetitionId);
  }, [selectedCompetitionId, cargar]);

  async function guardarCiclo() {
    if (!selectedCompetitionId || guardando) return;
    setGuardando(true);
    try {
      const resultado = await guardarCicloAmarillas(selectedCompetitionId, Number(ciclo));
      if (!resultado.ok) {
        showToast(resultado.error, "error");
        return;
      }
      showToast("Ciclo de amarillas guardado");
      await cargar(selectedCompetitionId);
    } finally {
      setGuardando(false);
    }
  }

  if (loadingCompeticiones) return <LoadingState title="Cargando competiciones…" />;
  if (errorCompeticiones)
    return (
      <ErrorState
        title={errorCompeticiones}
        action={<Button onClick={() => void loadCompeticiones()}>Reintentar</Button>}
      />
    );
  if (competicionesEnCategoria.length === 0)
    return <EmptyState title={`${categoria} no tiene competiciones esta temporada.`} />;

  const propios = new Set(pantalla?.propios ?? []);
  const equipos = [...new Set((pantalla?.disciplina ?? []).map((d) => d.equipo))].sort((a, b) =>
    a.localeCompare(b, "es"),
  );
  const tarjetas = (pantalla?.disciplina ?? []).filter((d) => !soloRival || d.equipo === soloRival);
  const avisos = tarjetas.filter((d) => d.situacion);

  return (
    <div className={styles.panel}>
      <div className={styles.selectores}>
        <Select
          label="Competición"
          value={selectedCompetitionId}
          onChange={(e) => setSelectedCompetitionId(e.target.value)}
        >
          {competicionesEnCategoria.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </Select>
        <Select label="Equipo" value={soloRival} onChange={(e) => setSoloRival(e.target.value)}>
          <option value="">Todos los equipos</option>
          {equipos.map((equipo) => (
            <option key={equipo} value={equipo}>
              {equipo}
            </option>
          ))}
        </Select>
      </div>
      {error ? (
        <ErrorState
          title={error}
          action={
            <Button onClick={() => selectedCompetitionId && void cargar(selectedCompetitionId)}>
              Reintentar
            </Button>
          }
        />
      ) : !pantalla || cargando ? (
        <LoadingState title="Cargando la liga…" />
      ) : (
        <>
          <p className={styles.estado} role="status">
            {pantalla.partidosJugados === 0
              ? "Todavía no se ha jugado ningún partido."
              : pantalla.partidosCargados < pantalla.partidosJugados
                ? `Cargadas las actas de ${pantalla.partidosCargados} de ${pantalla.partidosJugados} partidos jugados. Las demás van llegando solas de la federación.`
                : `Al día: ${pantalla.partidosJugados} partidos jugados.`}
            {pantalla.partidosSinLeer > 0 &&
              ` Hay ${pantalla.partidosSinLeer} acta${pantalla.partidosSinLeer > 1 ? "s" : ""} que no se supo leer: sus goles y tarjetas faltan aquí.`}
          </p>
          <Tabs
            label="Datos de la liga"
            value={pestana}
            onValueChange={setPestana}
            items={[
              {
                value: "avisos",
                label: `Avisos${avisos.length ? ` (${avisos.length})` : ""}`,
                content:
                  avisos.length === 0 ? (
                    <p className={styles.vacio}>
                      Nadie apercibido, sancionado ni expulsado
                      {soloRival ? ` en ${soloRival}` : ""}.
                    </p>
                  ) : (
                    <Tarjetas filas={avisos} propios={propios} />
                  ),
              },
              {
                value: "goleadores",
                label: "Goleadores",
                content: (
                  <Goleadores
                    filas={pantalla.goleadores.filter((g) => !soloRival || g.equipo === soloRival)}
                    propios={propios}
                  />
                ),
              },
              {
                value: "tarjetas",
                label: "Tarjetas",
                content: <Tarjetas filas={tarjetas} propios={propios} />,
              },
            ]}
          />
          <details className={styles.ajuste}>
            <summary>Cómo se calculan los avisos</summary>
            <p>
              Salen de las actas. Quien completa un ciclo de amarillas, o es expulsado, en el último
              partido de su equipo se pierde al menos el siguiente. Cuántos partidos caen por una
              roja lo decide el comité y no está en las actas: compruébalo.
            </p>
            <div className={styles.ciclo}>
              <Field
                label="Amarillas por ciclo"
                type="number"
                inputMode="numeric"
                min={2}
                max={20}
                value={ciclo}
                onChange={(e) => setCiclo(e.target.value)}
              />
              <Button
                variant="secondary"
                pending={guardando}
                disabled={Number(ciclo) === pantalla.ciclo}
                onClick={() => void guardarCiclo()}
              >
                Guardar
              </Button>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
