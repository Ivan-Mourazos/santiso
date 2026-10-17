"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ProblemasFederacion } from "@/components/admin/jornada/ProblemasFederacion";
import { Button } from "@/components/ui/foundation/Button";
import { Field, Select } from "@/components/ui/foundation/Fields";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/foundation/States";
import {
  actualizarClasificacionRfgf,
  cargarEstadoFederacion,
  cargarEstadoHistoricoRfgf,
  cargarEstadoRfgf,
  comprobarRfgfAhora,
  guardarEnlaceRfgf,
  reintentarActaRfgf,
  traerActaRfgf,
  traerCifrasJugadoresRfgf,
  traerHorariosRfgf,
  traerJornadaRfgf,
  traerTemporadaHistoricaRfgf,
  type CompeticionRfgf,
} from "@/lib/server/acciones/rfgf";
import type { Resultado } from "@/lib/resultado";
import type { EstadoFederacion, PartidoFederacion } from "@/lib/server/rfgf/estado";
import type { ResultadoClasificacionRfgf } from "@/lib/server/rfgf/demanda";
import s from "./Federacion.module.css";

type Historico = Extract<Awaited<ReturnType<typeof cargarEstadoHistoricoRfgf>>, { ok: true }>["datos"];

const FECHA = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "numeric" });
const MOMENTO = new Intl.DateTimeFormat("es-ES", {
  weekday: "short",
  day: "numeric",
  month: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function fecha(iso: string | null) {
  if (!iso) return "";
  const f = new Date(iso);
  return Number.isNaN(f.getTime()) ? "" : FECHA.format(f);
}
function momento(iso: string | null) {
  if (!iso) return "nunca";
  const f = new Date(iso);
  return Number.isNaN(f.getTime()) ? "—" : MOMENTO.format(f);
}

const ESTADO_JORNADA = {
  completa: "✓ Completa",
  incompleta: "⚠ Falta algo",
  por_jugar: "Por jugar",
} as const;

const ESTADO_ACTA: Record<PartidoFederacion["acta"]["estado"], string> = {
  guardada: "Acta guardada",
  resultado: "Resultado, goles y tarjetas",
  revisar: "⚠ Acta por revisar",
  error: "⚠ No se pudo traer",
  sin_acta: "Sin acta",
};

const ESTADO_GRUPO: Record<string, string> = {
  listo: "✓ Traída",
  pendiente: "Pendiente",
  error: "⚠ Con errores",
};

/** Una frase con lo que trajo una petición a la federación. */
function frase(r: {
  resultados?: number;
  actas?: number;
  horarios?: string[];
  jugadores?: number;
  paginas?: number;
  revisar?: string[];
  avisos?: string[];
  errores?: string[];
}) {
  const partes = [
    r.resultados ? `${r.resultados} resultado${r.resultados > 1 ? "s" : ""}` : "",
    r.actas ? `${r.actas} acta${r.actas > 1 ? "s" : ""}` : "",
    r.horarios?.length ? `${r.horarios.length} cambio${r.horarios.length > 1 ? "s" : ""} de horario` : "",
    r.jugadores ? `cifras de ${r.jugadores} jugador${r.jugadores > 1 ? "es" : ""}` : "",
    r.paginas ? `${r.paginas} página${r.paginas > 1 ? "s" : ""}` : "",
    r.revisar?.length ? `${r.revisar.length} por revisar` : "",
    ...(r.avisos ?? []),
  ].filter(Boolean);
  return partes.length ? `Traído: ${partes.join(" · ")}.` : "Nada nuevo en la federación.";
}

/**
 * Lo que hay traído de la federación y lo que falta, por jornada y partido, con un botón para
 * traer cada cosa concreta cuando haga falta. Lo normal llega solo cada noche desde las 21:00.
 */
export default function AdminFederacion({
  categoria,
  showToast,
}: {
  categoria: string;
  showToast: (msg: string, type?: "success" | "error") => void;
}) {
  const [competiciones, setCompeticiones] = useState<CompeticionRfgf[] | null>(null);
  const [elegida, setElegida] = useState<string | null>(null);
  const [estado, setEstado] = useState<EstadoFederacion | null>(null);
  const [historico, setHistorico] = useState<Historico | null>(null);
  const [clasificacion, setClasificacion] = useState<ResultadoClasificacionRfgf | null>(null);
  const [enlaces, setEnlaces] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  // Qué se está trayendo ahora mismo; nunca dos a la vez (la federación corta si se le pide mucho).
  const [trayendo, setTrayendo] = useState<string | null>(null);
  const turno = useRef(0);

  const cargarCompeticiones = useCallback(async () => {
    const r = await cargarEstadoRfgf();
    if (!r.ok) return setError(r.error);
    setCompeticiones(r.datos);
    setEnlaces(Object.fromEntries(r.datos.map((c) => [c.competicionId, c.enlace])));
  }, []);

  const cargarEstado = useCallback(async (competicionId: string) => {
    const esta = ++turno.current;
    const r = await cargarEstadoFederacion(competicionId);
    if (esta !== turno.current) return;
    if (!r.ok) return setError(r.error);
    setError(null);
    setEstado(r.datos);
  }, []);

  const cargarHistorico = useCallback(async () => {
    const r = await cargarEstadoHistoricoRfgf();
    if (r.ok) setHistorico(r.datos);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void cargarCompeticiones();
      void cargarHistorico();
    }, 0);
    return () => window.clearTimeout(id);
  }, [cargarCompeticiones, cargarHistorico]);

  const deCategoria = (competiciones ?? []).filter((c) => c.categoria === categoria);
  const actual =
    deCategoria.find((c) => c.competicionId === elegida) ??
    deCategoria.find((c) => c.enlace) ??
    deCategoria[0] ??
    null;
  const actualId = actual?.competicionId ?? null;

  useEffect(() => {
    if (!actualId) return;
    const id = window.setTimeout(() => {
      setEstado(null);
      setClasificacion(null);
      void cargarEstado(actualId);
    }, 0);
    return () => window.clearTimeout(id);
  }, [actualId, cargarEstado]);

  /** Lanza una petición a la federación, avisa de lo que trajo y refresca lo que se ve. */
  async function traer<T>(
    clave: string,
    accion: () => Promise<Resultado<T>>,
    resumen: (datos: T) => string,
  ) {
    if (trayendo) return;
    setTrayendo(clave);
    try {
      const r = await accion();
      if (!r.ok) return showToast(r.error, "error");
      showToast(resumen(r.datos));
      await Promise.all([actualId ? cargarEstado(actualId) : null, cargarCompeticiones()]);
    } catch {
      showToast("No se pudo hablar con la federación. Vuelve a intentarlo en un rato.", "error");
    } finally {
      setTrayendo(null);
    }
  }

  if (error) {
    return (
      <ErrorState
        title="No se pudo cargar la federación"
        detail={error}
        action={<Button onClick={() => void cargarCompeticiones()}>Reintentar</Button>}
      />
    );
  }
  if (!competiciones) return <LoadingState title="Cargando la federación…" />;
  if (!actual) {
    return (
      <EmptyState
        title={`${categoria} no tiene competiciones esta temporada.`}
        detail="Créalas en Equipos o al importar el calendario."
      />
    );
  }

  const ocupado = trayendo !== null;
  const porRevisar = deCategoria.flatMap((c) => c.revisar);
  const jornadas = estado?.jornadas ?? [];
  const jugadas = jornadas.filter((j) => j.estado !== "por_jugar");
  const completas = jugadas.filter((j) => j.estado === "completa").length;
  const comparacion = estado?.competicion.clasificacion ?? null;

  return (
    <div className={s.panel}>
      <header className={s.cabecera}>
        {deCategoria.length > 1 && (
          <Select
            label="Competición"
            value={actual.competicionId}
            disabled={ocupado}
            onChange={(e) => setElegida(e.target.value)}
          >
            {deCategoria.map((c) => (
              <option key={c.competicionId} value={c.competicionId}>
                {c.nombre}
              </option>
            ))}
          </Select>
        )}
        <h2>{actual.nombre}</h2>
        {actual.enlace ? (
          <p className={s.nota}>
            Se mira sola cada noche desde las 21:00 (última: {momento(actual.comprobadoEn)}). Aquí
            se trae lo que quieras ya, cosa por cosa.
          </p>
        ) : (
          <p className={s.aviso} role="status">
            Sin enlazar con la federación: pega el enlace de su calendario en «Enlaces» (abajo).
          </p>
        )}
        {estado && (
          <p className={s.cifras}>
            <strong>
              {completas}/{jugadas.length}
            </strong>{" "}
            jornadas jugadas completas · {jornadas.length - jugadas.length} por jugar
          </p>
        )}
      </header>

      <ProblemasFederacion
        actas={porRevisar}
        ocupado={ocupado}
        onReintentar={(codActa) =>
          void traer(
            `reintentar:${codActa}`,
            async () => {
              const preparado = await reintentarActaRfgf(codActa);
              return preparado.ok ? comprobarRfgfAhora() : preparado;
            },
            (texto) => texto,
          )
        }
      />

      {actual.enlace && (
        <section className={s.bloque} aria-label="Traer de la federación">
          <h3>Traer ahora</h3>
          <div className={s.opcion}>
            <div>
              <strong>Horarios</strong>
              <span>Fechas, horas y campos de lo que queda por jugar.</span>
              <small>Última vez: {momento(estado?.competicion.horariosEn ?? null)}</small>
            </div>
            <Button
              variant="secondary"
              pending={trayendo === "horarios"}
              pendingLabel="Trayendo…"
              disabled={ocupado}
              onClick={() =>
                void traer("horarios", () => traerHorariosRfgf(actual.competicionId), frase)
              }
            >
              Traer horarios
            </Button>
          </div>
          <div className={s.opcion}>
            <div>
              <strong>Cifras de jugadores</strong>
              <span>
                {estado
                  ? `${estado.jugadores.conCifras} de ${estado.jugadores.plantilla} jugadores con sus cifras oficiales.`
                  : "Cifras oficiales de la plantilla."}{" "}
                Cuatro por vez.
              </span>
              <small>Última lectura: {momento(estado?.jugadores.lecturaMasReciente ?? null)}</small>
            </div>
            <Button
              variant="secondary"
              pending={trayendo === "jugadores"}
              pendingLabel="Trayendo…"
              disabled={ocupado}
              onClick={() =>
                void traer(
                  "jugadores",
                  () => traerCifrasJugadoresRfgf(actual.competicionId),
                  frase,
                )
              }
            >
              Traer cifras
            </Button>
          </div>
          <div className={s.opcion}>
            <div>
              <strong>Clasificación</strong>
              <span>
                {comparacion
                  ? comparacion.diferencias.length
                    ? `No cuadraba con la oficial (J${comparacion.jornada}) en ${comparacion.diferencias.length} equipo${comparacion.diferencias.length > 1 ? "s" : ""}.`
                    : `Cuadra con la oficial (J${comparacion.jornada}).`
                  : "Compárala con la oficial; si no cuadra, se traen los resultados que falten."}
              </span>
            </div>
            <Button
              variant="secondary"
              pending={trayendo === "clasificacion"}
              pendingLabel="Comparando…"
              disabled={ocupado}
              onClick={() =>
                void traer(
                  "clasificacion",
                  async () => {
                    const r = await actualizarClasificacionRfgf(actual.competicionId);
                    if (r.ok) setClasificacion(r.datos);
                    return r;
                  },
                  (c) =>
                    c.cuadra
                      ? "La clasificación coincide con la federación ✓"
                      : "La clasificación no coincide: mira el detalle.",
                )
              }
            >
              Actualizar
            </Button>
          </div>
          {clasificacion && !clasificacion.cuadra && (
            <div className={s.detalle} role="status">
              <strong>
                No coincide con la oficial
                {clasificacion.jornadaOficial ? ` (J${clasificacion.jornadaOficial})` : ""}:
              </strong>
              <ul>
                {clasificacion.diferencias.map((d, i) => (
                  <li key={d}>
                    {d}
                    {clasificacion.motivos[i] ? <em> — {clasificacion.motivos[i]}</em> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <section className={s.bloque} aria-label="Jornadas">
        <h3>Jornadas</h3>
        {!estado ? (
          <LoadingState title="Cargando jornadas…" />
        ) : (
          <ol className={s.jornadas}>
            {jornadas.map((j) => (
              <li key={j.numero}>
                <details className={s.jornada} data-estado={j.estado}>
                  <summary>
                    <span className={s.numero}>J{j.numero}</span>
                    <span className={s.fecha}>{fecha(j.fecha)}</span>
                    <span className={s.resumen}>
                      {j.estado === "por_jugar"
                        ? `${j.partidos} partidos`
                        : `${j.conResultado}/${j.partidos} resultados · ${j.conActaTratada}/${j.partidos} actas`}
                    </span>
                    <span className={s.estado}>{ESTADO_JORNADA[j.estado]}</span>
                  </summary>
                  <ul className={s.partidos}>
                    {j.encuentros.map((p) => (
                      <li key={p.id} data-propio={p.propio}>
                        <span className={s.cruce}>
                          {p.local} – {p.visitante}
                        </span>
                        <strong className={s.marcador}>
                          {p.marcador ? `${p.marcador[0]}–${p.marcador[1]}` : "—"}
                        </strong>
                        <span className={s.acta} data-acta={p.acta.estado}>
                          {ESTADO_ACTA[p.acta.estado]}
                          {p.acta.aviso ? ` · ${p.acta.aviso}` : ""}
                        </span>
                        {actual.enlace && j.estado !== "por_jugar" && (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={ocupado}
                            pending={trayendo === `acta:${p.id}`}
                            pendingLabel="Trayendo…"
                            aria-label={`Traer acta: ${p.local} – ${p.visitante}`}
                            onClick={() =>
                              void traer(
                                `acta:${p.id}`,
                                () => traerActaRfgf(actual.competicionId, p.id),
                                frase,
                              )
                            }
                          >
                            Traer acta
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                  {actual.enlace && (
                    <Button
                      variant="secondary"
                      disabled={ocupado}
                      pending={trayendo === `jornada:${j.numero}`}
                      pendingLabel="Trayendo…"
                      onClick={() =>
                        void traer(
                          `jornada:${j.numero}`,
                          () => traerJornadaRfgf(actual.competicionId, j.numero),
                          frase,
                        )
                      }
                    >
                      Traer jornada {j.numero}
                    </Button>
                  )}
                </details>
              </li>
            ))}
          </ol>
        )}
      </section>

      {historico && historico.length > 0 && (
        <section className={s.bloque} aria-label="Temporadas pasadas">
          <h3>Temporadas pasadas</h3>
          <p className={s.nota}>
            Las temporadas anteriores del club se repasan solas, poco a poco. Aquí ves cómo van y
            puedes adelantar una.
          </p>
          <ul className={s.historico}>
            {historico.map((g) => (
              <li key={g.codGrupo}>
                <div>
                  <strong>
                    {g.temporada} · {g.categoria}
                  </strong>
                  <span>
                    {g.competicion} · {g.grupo}
                  </span>
                  <small>
                    {ESTADO_GRUPO[g.estado] ?? g.estado} · {g.conCifras} jugadores con cifras
                    {g.intentos ? ` · ${g.intentos} intentos` : ""}
                  </small>
                </div>
                {g.estado !== "listo" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={ocupado}
                    pending={trayendo === `grupo:${g.codGrupo}`}
                    pendingLabel="Trayendo…"
                    aria-label={`Traer temporada ${g.temporada} · ${g.competicion}`}
                    onClick={() =>
                      void traer(
                        `grupo:${g.codGrupo}`,
                        async () => {
                          const r = await traerTemporadaHistoricaRfgf(g.codGrupo);
                          await cargarHistorico();
                          return r;
                        },
                        frase,
                      )
                    }
                  >
                    Traer
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <details className={s.bloque}>
        <summary>Enlaces con la federación</summary>
        <p className={s.nota}>
          Pega una vez el enlace del calendario de cada competición en futgal.es.
        </p>
        {deCategoria.map((c) => (
          <div key={c.competicionId} className={s.enlace}>
            <Field
              label={`Enlace de ${c.nombre}`}
              type="url"
              inputMode="url"
              placeholder="https://www.futgal.es/pnfg/NPcd/NFG_VisCalendario_Vis?…"
              value={enlaces[c.competicionId] ?? ""}
              onChange={(e) => setEnlaces({ ...enlaces, [c.competicionId]: e.target.value })}
              disabled={ocupado}
            />
            <Button
              variant="secondary"
              disabled={ocupado || (enlaces[c.competicionId] ?? "") === c.enlace}
              onClick={() =>
                void traer(
                  `enlace:${c.competicionId}`,
                  () => guardarEnlaceRfgf(c.competicionId, enlaces[c.competicionId] ?? ""),
                  () => "Enlace guardado",
                )
              }
            >
              Guardar
            </Button>
          </div>
        ))}
      </details>
    </div>
  );
}
