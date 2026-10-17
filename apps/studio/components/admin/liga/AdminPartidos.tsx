"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import TarjetaPartido, { fechaPartido } from "@/components/admin/jornada/TarjetaPartido";
import { useStudio } from "@/components/studio/StudioContext";
import { Button } from "@/components/ui/foundation/Button";
import { Dialog } from "@/components/ui/foundation/Dialog";
import { Select } from "@/components/ui/foundation/Fields";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/foundation/States";
import { hoyLocal } from "@/lib/jornada/semana";
import { partidoEnMesa } from "@/lib/jornada/vestiario";
import { cargarPantallaJornada } from "@/lib/server/acciones/jornada";
import { cargarPartidosLiga } from "@/lib/server/acciones/liga";
import type { PantallaJornada, PartidoDeLaSemana } from "@/lib/server/consultas/jornada";
import type { PartidoDeLiga, PartidosDeLiga } from "@/lib/server/consultas/partidos-liga";
import { useCompeticiones } from "@/lib/useCompeticiones";
import styles from "./Partidos.module.css";

const EVENTO = {
  gol: "⚽",
  gol_propia: "⚽ (p.p.)",
  amarilla: "🟨",
  doble_amarilla: "🟨🟥",
  roja: "🟥",
} as const;

function Escudo({ url }: { url: string | null }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- escudo del catálogo local
    <img className={styles.escudo} src={url} alt="" />
  ) : (
    <span className={styles.escudo} aria-hidden="true" />
  );
}

function marcadorDe(p: PartidoDeLiga) {
  return p.golesLocal !== null && p.golesVisitante !== null
    ? `${p.golesLocal}–${p.golesVisitante}`
    : null;
}

/** Fila de un partido: hora · local / visitante · marcador. Al tocarla se abre su detalle. */
function Fila({ partido: p, onAbrir }: { partido: PartidoDeLiga; onAbrir: () => void }) {
  const propio = p.local.propio || p.visitante.propio;
  const resultado = marcadorDe(p);
  const cuando = fechaPartido(p.fecha);
  return (
    <button
      type="button"
      className={styles.fila}
      data-propio={propio || undefined}
      onClick={onAbrir}
      aria-label={`${p.local.nombre} ${resultado ?? "contra"} ${p.visitante.nombre}`}
    >
      <span className={styles.hora}>
        {p.estado === "aplazado" ? "Apl." : resultado ? "Final" : cuando.hora || "—"}
      </span>
      <span className={styles.equipos}>
        <span data-propio={p.local.propio || undefined}>
          <Escudo url={p.local.escudoUrl} />
          {p.local.nombre}
        </span>
        <span data-propio={p.visitante.propio || undefined}>
          <Escudo url={p.visitante.escudoUrl} />
          {p.visitante.nombre}
        </span>
      </span>
      <span className={styles.goles}>
        <span>{p.golesLocal ?? ""}</span>
        <span>{p.golesVisitante ?? ""}</span>
      </span>
    </button>
  );
}

function Detalle({
  partido: p,
  onClose,
}: {
  partido: PartidoDeLiga | null;
  onClose: () => void;
}) {
  const cuando = fechaPartido(p?.fecha ?? null);
  return (
    <Dialog
      open={p !== null}
      onClose={onClose}
      title={p ? `${p.local.nombre} – ${p.visitante.nombre}` : "Partido"}
      closeLabel="Cerrar partido"
      mobilePresentation="sheet"
    >
      {p && (
        <div className={styles.detalle}>
          <div className={styles.marcador}>
            <span>
              <Escudo url={p.local.escudoUrl} />
              {p.local.nombre}
            </span>
            <strong>{marcadorDe(p) ?? (cuando.hora || "—")}</strong>
            <span>
              <Escudo url={p.visitante.escudoUrl} />
              {p.visitante.nombre}
            </span>
          </div>
          <dl className={styles.datos}>
            <div>
              <dt>Día</dt>
              <dd>
                {cuando.dia}
                {cuando.hora ? ` · ${cuando.hora}` : ""}
              </dd>
            </div>
            <div>
              <dt>Campo</dt>
              <dd>{p.campo ?? "Por confirmar"}</dd>
            </div>
            {p.arbitro && (
              <div>
                <dt>Árbitro</dt>
                <dd>{p.arbitro}</dd>
              </div>
            )}
          </dl>
          {p.eventos.length > 0 ? (
            <ol className={styles.eventos} aria-label="Goles y tarjetas">
              {p.eventos.map((e, i) => (
                <li key={i} data-lado={e.lado}>
                  <span className={styles.minuto}>{e.minuto ? `${e.minuto}'` : ""}</span>
                  <span>
                    {EVENTO[e.tipo]} {e.persona}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            marcadorDe(p) && <p className={styles.nota}>Sin acta leída todavía.</p>
          )}
          {p.enlaceActa && (
            <a className={styles.enlace} href={p.enlaceActa} target="_blank" rel="noreferrer">
              Acta en futgal.es ↗
            </a>
          )}
        </div>
      )}
    </Dialog>
  );
}

/**
 * Liga → Partidos: abre en la jornada que toca. Si en ella juega el Santiso y es el partido de la
 * mesa, va arriba entero con sus pasos (convocatoria, once, carteles…); el resto, en filas.
 */
export default function AdminPartidos({ categoria }: { categoria: string }) {
  const { params, setParams } = useStudio();
  const {
    selectedCompetitionId,
    setSelectedCompetitionId,
    competicionesEnCategoria,
    loadingCompeticiones,
    errorCompeticiones,
  } = useCompeticiones(categoria, true);
  const pedida = Number(params.get("j")) || null;
  const [datos, setDatos] = useState<PartidosDeLiga | null>(null);
  const [mesa, setMesa] = useState<{ momento: string; partido: PartidoDeLaSemana } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<PartidoDeLiga | null>(null);
  const generacion = useRef(0);

  const cargar = useCallback(async (competicionId: string, numero: number | null) => {
    const esta = ++generacion.current;
    const resultado = await cargarPartidosLiga(competicionId, numero);
    if (esta !== generacion.current) return;
    if (!resultado.ok) return setError(resultado.error);
    setDatos(resultado.datos);
    setError(null);
  }, []);
  useEffect(() => {
    if (!selectedCompetitionId) return;
    const id = window.setTimeout(() => void cargar(selectedCompetitionId, pedida), 0);
    return () => window.clearTimeout(id);
  }, [cargar, selectedCompetitionId, pedida]);

  // El partido de la mesa (el mismo de Inicio), para enseñarlo entero con sus pasos.
  const cargarMesa = useCallback(async () => {
    const r = await cargarPantallaJornada(hoyLocal());
    if (!r.ok) return;
    const pantalla: PantallaJornada = r.datos;
    const c = pantalla.categorias.find((x) => x.categoria === categoria);
    const partido = c ? partidoEnMesa(c.proximo, c.ultimo, pantalla.momento) : null;
    setMesa(partido ? { momento: pantalla.momento, partido } : null);
  }, [categoria]);
  useEffect(() => {
    const id = window.setTimeout(() => void cargarMesa(), 0);
    return () => window.clearTimeout(id);
  }, [cargarMesa]);

  if (errorCompeticiones || error)
    return (
      <ErrorState
        title="No se pudieron cargar los partidos"
        detail={errorCompeticiones ?? error ?? ""}
        action={
          <Button onClick={() => selectedCompetitionId && void cargar(selectedCompetitionId, pedida)}>
            Reintentar
          </Button>
        }
      />
    );
  if (!loadingCompeticiones && competicionesEnCategoria.length === 0)
    return (
      <EmptyState
        title="No hay competiciones de esta categoría."
        detail="Créalas en Equipos o carga el calendario de la federación."
      />
    );
  if (!datos || datos.competicion.id !== selectedCompetitionId)
    return <LoadingState title="Cargando la jornada…" />;

  const numeros = datos.jornadas.map((j) => j.numero);
  const posicion = datos.numero === null ? -1 : numeros.indexOf(datos.numero);
  const fechaJornada = datos.jornadas[posicion]?.fecha ?? null;
  const ir = (numero: number | undefined) =>
    numero !== undefined && setParams({ j: numero === datos.actual ? null : String(numero) });
  const enMesa =
    mesa && datos.partidos.some((p) => p.id === mesa.partido.id) ? mesa.partido : null;
  const resto = datos.partidos.filter((p) => p.id !== enMesa?.id);

  return (
    <div className={styles.pantalla}>
      {competicionesEnCategoria.length > 1 && (
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
      )}
      <nav className={styles.jornada} aria-label="Jornada">
        <button
          type="button"
          aria-label="Jornada anterior"
          disabled={posicion <= 0}
          onClick={() => ir(numeros[posicion - 1])}
        >
          ‹
        </button>
        <div>
          <strong>Jornada {datos.numero ?? "—"}</strong>
          <span>
            {fechaJornada ? fechaPartido(fechaJornada).dia : "Sin fecha"}
            {datos.numero !== datos.actual && datos.actual !== null && (
              <>
                {" · "}
                <button type="button" className={styles.volver} onClick={() => ir(datos.actual!)}>
                  Ir a la actual
                </button>
              </>
            )}
          </span>
        </div>
        <button
          type="button"
          aria-label="Jornada siguiente"
          disabled={posicion < 0 || posicion >= numeros.length - 1}
          onClick={() => ir(numeros[posicion + 1])}
        >
          ›
        </button>
      </nav>
      {enMesa && mesa && (
        <TarjetaPartido
          key={enMesa.id}
          partido={enMesa}
          categoria={categoria}
          momento={mesa.momento}
          onNovedades={() => {
            void cargarMesa();
            void cargar(selectedCompetitionId, pedida);
          }}
        />
      )}
      {resto.length > 0 ? (
        <div className={styles.lista} aria-label={`Partidos de la jornada ${datos.numero ?? ""}`}>
          {resto.map((p) => (
            <Fila key={p.id} partido={p} onAbrir={() => setAbierto(p)} />
          ))}
        </div>
      ) : (
        !enMesa && <EmptyState title="Esta jornada no tiene partidos." />
      )}
      <Detalle partido={abierto} onClose={() => setAbierto(null)} />
    </div>
  );
}
