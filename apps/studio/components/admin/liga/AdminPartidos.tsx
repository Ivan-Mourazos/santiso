"use client";

import { sinConexion } from "@/lib/resultado";
import Link from "next/link";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { fechaPartido } from "@/lib/jornada/fecha";
import { useStudio } from "@/components/studio/StudioContext";
import { Button } from "@/components/ui/foundation/Button";
import { Dialog } from "@/components/ui/foundation/Dialog";
import { Select } from "@/components/ui/foundation/Fields";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/foundation/States";
import { ahoraLocal, partidoJugado } from "@/lib/actas/partido-por-defecto";
import { type CartelesDelPartido, preparaConvocatoria } from "@/lib/jornada/vestiario";
import {
  estadoPaso,
  NOMBRE_FORMATO,
  PASOS,
  PASOS_DESPUES,
  type PasoCartel,
} from "@/lib/cartel2/pasos";
import { cargarCartelesPartido } from "@/lib/server/acciones/carteles-guardados";
import { cargarPartidosLiga, ubicarPartido } from "@/lib/server/acciones/liga";
import { traerActaRfgf } from "@/lib/server/acciones/rfgf";
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

/** Las medidas de cada formato, para el botón de descarga: cabe en una línea. */
const FORMATO_CORTO = { publicacion: "4:5", historia: "9:16" } as const;

/** Dónde se hace el cartel de cada paso para un partido concreto. */
function enlaceDelPaso(paso: PasoCartel, partidoId: string, categoria: string) {
  const id = encodeURIComponent(partidoId);
  const cat = encodeURIComponent(categoria);
  if (paso === "convocatoria") return `/admin/convocatoria?categoria=${cat}&partido=${id}`;
  if (paso === "once") return `/admin/alineacion?categoria=${cat}&partido=${id}`;
  // Lo de después se hace junto, en el carrusel.
  const plantilla = paso === "resultado" || paso === "noso11" ? "despues" : paso;
  return `/admin/carteles?plantilla=${plantilla}&partido=${id}&categoria=${cat}`;
}

/**
 * Los carteles de un partido del Santiso que ya no está en la mesa (el de ayer, uno de hace
 * semanas): los guardados se descargan aquí mismo y cualquiera se puede hacer o rehacer.
 */
function CartelesDelPartidoLiga({
  partido: p,
  categoria,
}: {
  partido: PartidoDeLiga;
  categoria: string;
}) {
  const { acceso } = useStudio();
  const [carteles, setCarteles] = useState<{ id: string; deEste: CartelesDelPartido } | null>(null);
  // Si la búsqueda falla se dice, con «Reintentar»: antes se quedaba «Buscando…» para siempre.
  const [fallo, setFallo] = useState<{ id: string; error: string } | null>(null);
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    let vigente = true;
    void cargarCartelesPartido([p.id])
      .catch(sinConexion)
      .then((r) => {
        if (!vigente) return;
        if (r.ok) setCarteles({ id: p.id, deEste: r.datos[p.id] ?? {} });
        else setFallo({ id: p.id, error: r.error });
      });
    return () => {
      vigente = false;
    };
  }, [p.id, intento]);
  const error = fallo?.id === p.id ? fallo.error : null;
  const jugado = marcadorDe(p) !== null;
  const antes: PasoCartel[] = preparaConvocatoria(categoria)
    ? ["partido", "convocatoria", "once"]
    : ["partido"];
  const deEste = carteles?.id === p.id ? carteles.deEste : null;
  // Jugado, primero lo de después; los técnicos solo hacen convocatoria y once. Ya jugado, la
  // convocatoria y el once no se hacen: solo se ven los carteles que se guardaron.
  const pasos = (
    jugado ? ([...PASOS_DESPUES, ...antes] as PasoCartel[]) : antes
  )
    .filter((paso) => acceso?.rol !== "tecnico" || paso === "convocatoria" || paso === "once")
    .filter(
      (paso) =>
        !jugado || (paso !== "convocatoria" && paso !== "once") || (deEste?.[paso] ?? []).length > 0,
    );
  if (deEste && pasos.length === 0) return null;
  return (
    <section className={styles.carteles} aria-label="Carteles del partido">
      <p className={styles.etiqueta}>Carteles</p>
      {!deEste && error ? (
        <p className={styles.nota} role="alert">
          {error}{" "}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setFallo(null);
              setIntento((n) => n + 1);
            }}
          >
            Reintentar
          </Button>
        </p>
      ) : !deEste ? (
        <p className={styles.nota}>Buscando los carteles guardados…</p>
      ) : (
        <ul>
          {pasos.map((paso) => {
            const guardados = deEste[paso] ?? [];
            const estado = estadoPaso(guardados);
            return (
              <li key={paso} data-estado={estado}>
                <div>
                  <strong>{PASOS[paso].nombre}</strong>
                  {estado === "desactualizado" && <span>⚠ Con datos viejos</span>}
                </div>
                <div className={styles.accionesCartel}>
                  {guardados.map((g) => (
                    <a
                      key={g.formato}
                      href={g.url}
                      download={`${paso}-${g.formato}.png`}
                      aria-label={`Descargar ${PASOS[paso].nombre}: ${NOMBRE_FORMATO[g.formato]}`}
                    >
                      ↓ {guardados.length > 1 ? FORMATO_CORTO[g.formato] : ""}
                    </a>
                  ))}
                  {!(jugado && (paso === "convocatoria" || paso === "once")) && (
                    <Link
                      href={enlaceDelPaso(paso, p.id, categoria)}
                      transitionTypes={["nav-forward"]}
                      aria-label={`${guardados.length ? "Rehacer" : "Hacer"} ${PASOS[paso].nombre}`}
                      data-rehacer={guardados.length ? true : undefined}
                    >
                      {guardados.length ? "↻" : "Hacer"}
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/**
 * Traer el acta de la federación ya, sin esperar a la pasada automática: solo si aún falta, para
 * el administrador y con la competición enlazada. El acta no se corrige a mano: manda la federación.
 */
function TraerActa({
  partido: p,
  competicion,
  onNovedades,
}: {
  partido: PartidoDeLiga;
  competicion: PartidosDeLiga["competicion"];
  onNovedades: () => void;
}) {
  const { acceso, showToast } = useStudio();
  const [trayendo, setTrayendo] = useState(false);
  if (p.enlaceActa || !competicion.enlazada || acceso?.rol === "tecnico") return null;
  function traer() {
    setTrayendo(true);
    void traerActaRfgf(competicion.id, p.id)
      .then((r) => {
        if (!r.ok) return showToast(r.error, "error");
        const avisos = r.datos.avisos.join(" · ");
        showToast(
          r.datos.actas || r.datos.resultados
            ? "Acta traída de la federación"
            : avisos || "La federación no tiene nada nuevo de este partido.",
        );
        onNovedades();
      })
      .catch(() => showToast("No se pudo hablar con la federación.", "error"))
      .finally(() => setTrayendo(false));
  }
  return (
    <Button variant="secondary" pending={trayendo} pendingLabel="Trayendo…" onClick={traer}>
      Traer acta
    </Button>
  );
}

/** Goles o tarjetas del partido, en orden: minuto, qué, quién y el escudo de su equipo. */
function Eventos({
  titulo,
  eventos,
  partido: p,
}: {
  titulo: string;
  eventos: PartidoDeLiga["eventos"];
  partido: PartidoDeLiga;
}) {
  if (eventos.length === 0) return null;
  return (
    <section className={styles.eventos} aria-label={titulo}>
      <p className={styles.etiqueta}>{titulo}</p>
      <ol>
        {eventos.map((e, i) => {
          const equipo = e.lado === "local" ? p.local : p.visitante;
          return (
            <li key={i} data-propio={equipo.propio || undefined}>
              <span className={styles.minuto}>{e.minuto ? `${e.minuto}'` : ""}</span>
              <span aria-hidden="true">{EVENTO[e.tipo]}</span>
              <span className={styles.persona}>{e.persona}</span>
              <span className={styles.lado} aria-label={equipo.nombre}>
                <Escudo url={equipo.escudoUrl} />
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Detalle({
  partido: p,
  jornada,
  categoria,
  competicion,
  onNovedades,
  onClose,
}: {
  partido: PartidoDeLiga | null;
  jornada: number | null;
  categoria: string;
  competicion: PartidosDeLiga["competicion"];
  onNovedades: () => void;
  onClose: () => void;
}) {
  const cuando = fechaPartido(p?.fecha ?? null);
  const pasado =
    p !== null &&
    partidoJugado(
      { id: p.id, estado: p.estado, fecha: p.fecha, goles_local: p.golesLocal },
      ahoraLocal(),
    );
  const propio = !!p && (p.local.propio || p.visitante.propio);
  const goles = p?.eventos.filter((e) => e.tipo === "gol" || e.tipo === "gol_propia") ?? [];
  const tarjetas = p?.eventos.filter((e) => e.tipo !== "gol" && e.tipo !== "gol_propia") ?? [];
  return (
    <Dialog
      open={p !== null}
      onClose={onClose}
      title={jornada ? `Jornada ${jornada}` : "Partido"}
      closeLabel="Cerrar partido"
      mobilePresentation="sheet"
    >
      {p && (
        <div className={styles.detalle}>
          <div className={styles.marcador}>
            {/* Tocar un equipo abre su ficha. */}
            <Link
              href={`/admin/equipo?id=${encodeURIComponent(p.local.id)}`}
              transitionTypes={["nav-forward"]}
              aria-label={`Ficha de ${p.local.nombre}`}
              data-propio={p.local.propio || undefined}
            >
              <Escudo url={p.local.escudoUrl} />
              {p.local.nombre}
            </Link>
            <strong>{marcadorDe(p) ?? (cuando.hora || "—")}</strong>
            <Link
              href={`/admin/equipo?id=${encodeURIComponent(p.visitante.id)}`}
              transitionTypes={["nav-forward"]}
              aria-label={`Ficha de ${p.visitante.nombre}`}
              data-propio={p.visitante.propio || undefined}
            >
              <Escudo url={p.visitante.escudoUrl} />
              {p.visitante.nombre}
            </Link>
          </div>
          <p className={styles.cuando}>
            {cuando.dia}
            {/* Sin marcador, la hora ya sale en grande arriba: no se repite. */}
            {cuando.hora && marcadorDe(p) ? ` · ${cuando.hora}` : ""} ·{" "}
            {p.campo ?? "Campo por confirmar"}
            {p.arbitro && <small>Árbitro: {p.arbitro}</small>}
          </p>
          {propio && (
            <div className={styles.acciones}>
              <Link
                href={`/admin/directo?categoria=${encodeURIComponent(categoria)}&partido=${encodeURIComponent(p.id)}`}
                transitionTypes={["nav-forward"]}
              >
                Directo
              </Link>
              {pasado && (
                <TraerActa partido={p} competicion={competicion} onNovedades={onNovedades} />
              )}
            </div>
          )}
          {propio && <CartelesDelPartidoLiga partido={p} categoria={categoria} />}
          <Eventos titulo="Goles" eventos={goles} partido={p} />
          <Eventos titulo="Tarjetas" eventos={tarjetas} partido={p} />
          {p.eventos.length === 0 && marcadorDe(p) && (
            <p className={styles.nota}>Sin acta leída todavía.</p>
          )}
          {p.enlaceActa && (
            <a className={styles.externo} href={p.enlaceActa} target="_blank" rel="noreferrer">
              Acta en futgal.es ↗
            </a>
          )}
        </div>
      )}
    </Dialog>
  );
}

/**
 * Liga → Partidos: abre en la jornada que toca. Todos los partidos en filas, el nuestro el
 * primero; cada uno abre su hoja. Sin pasos ni tareas: los carteles se hacen desde la hoja.
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
  // `?partido=` abre el detalle de ese partido en su jornada (enlaces desde otras pantallas).
  const partidoPedido = params.get("partido");
  const [datos, setDatos] = useState<PartidosDeLiga | null>(null);
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

  // Primero se busca dónde está el partido pedido y se va a su competición y jornada.
  useEffect(() => {
    if (!partidoPedido) return;
    let vigente = true;
    void ubicarPartido(partidoPedido)
      .then((r) => {
        if (!vigente) return;
        if (!r.ok || !r.datos) return setParams({ partido: null }, true);
        setParams(
          {
            categoria: r.datos.categoria,
            competicion: r.datos.competicionId,
            j: String(r.datos.numero),
            partido: partidoPedido,
          },
          true,
        );
      })
      .catch(() => vigente && setParams({ partido: null }, true));
    return () => {
      vigente = false;
    };
  }, [partidoPedido, setParams]);
  // Con su jornada cargada, se abre su detalle y se quita del enlace (cerrar no lo reabre).
  useEffect(() => {
    if (!partidoPedido || !datos) return;
    const encontrado = datos.partidos.find((p) => p.id === partidoPedido);
    if (!encontrado) return;
    const id = window.setTimeout(() => {
      setAbierto(encontrado);
      setParams({ partido: null }, true);
    }, 0);
    return () => window.clearTimeout(id);
  }, [partidoPedido, datos, setParams]);

  if (errorCompeticiones || error)
    return (
      <ErrorState
        title="No se pudieron cargar los partidos"
        detail={errorCompeticiones ?? error ?? ""}
        action={
          <Button
            onClick={() => selectedCompetitionId && void cargar(selectedCompetitionId, pedida)}
          >
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
  // El nuestro, el primero; los demás por día y hora, y los que aún no tienen hora al final de
  // su día (antes salían en el orden de la federación: un «—» delante de las 12:00).
  const orden = (p: PartidoDeLiga) =>
    !p.fecha ? "~" : fechaPartido(p.fecha).hora ? p.fecha : `${p.fecha.slice(0, 10)}~`;
  const variosDias = new Set(datos.partidos.map((p) => fechaPartido(p.fecha).dia)).size > 1;
  const filas = [...datos.partidos].sort(
    (a, b) =>
      Number(b.local.propio || b.visitante.propio) - Number(a.local.propio || a.visitante.propio) ||
      (orden(a) < orden(b) ? -1 : orden(a) > orden(b) ? 1 : 0),
  );

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
      {filas.length > 0 ? (
        <div className={styles.lista} aria-label={`Partidos de la jornada ${datos.numero ?? ""}`}>
          {filas.map((p, i) => {
            // Jornada repartida en varios días: el día encima de cada grupo (la fila solo lleva
            // la hora). Con un solo día ya sale bajo «Jornada N».
            const dia = fechaPartido(p.fecha).dia;
            const nuevoDia = variosDias && (i === 0 || fechaPartido(filas[i - 1]!.fecha).dia !== dia);
            return (
              <Fragment key={p.id}>
                {nuevoDia && <h3 className={styles.dia}>{dia}</h3>}
                <Fila partido={p} onAbrir={() => setAbierto(p)} />
              </Fragment>
            );
          })}
        </div>
      ) : (
        <EmptyState title="Esta jornada no tiene partidos." />
      )}
      <Detalle
        partido={abierto ? (datos.partidos.find((p) => p.id === abierto.id) ?? abierto) : null}
        jornada={datos.numero}
        categoria={categoria}
        competicion={datos.competicion}
        onNovedades={() => void cargar(selectedCompetitionId, pedida)}
        onClose={() => setAbierto(null)}
      />
    </div>
  );
}
