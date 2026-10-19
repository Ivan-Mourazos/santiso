"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import TarjetaPartido, { fechaPartido } from "@/components/admin/jornada/TarjetaPartido";
import { useStudio } from "@/components/studio/StudioContext";
import { Button } from "@/components/ui/foundation/Button";
import { Dialog } from "@/components/ui/foundation/Dialog";
import { Select } from "@/components/ui/foundation/Fields";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/foundation/States";
import { ahoraLocal, partidoJugado } from "@/lib/actas/partido-por-defecto";
import { hoyLocal } from "@/lib/jornada/semana";
import {
  type CartelesDelPartido,
  partidoEnMesa,
  preparaConvocatoria,
} from "@/lib/jornada/vestiario";
import { estadoPaso, NOMBRE_FORMATO, PASOS, type PasoCartel } from "@/lib/cartel2/pasos";
import { cargarCartelesPartido } from "@/lib/server/acciones/carteles-guardados";
import { cargarPantallaJornada } from "@/lib/server/acciones/jornada";
import { cargarPartidosLiga, ubicarPartido } from "@/lib/server/acciones/liga";
import { traerActaRfgf } from "@/lib/server/acciones/rfgf";
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

/** Dónde se hace el cartel de cada paso para un partido concreto. */
function enlaceDelPaso(paso: PasoCartel, partidoId: string, categoria: string) {
  const id = encodeURIComponent(partidoId);
  const cat = encodeURIComponent(categoria);
  if (paso === "convocatoria") return `/admin/convocatoria?categoria=${cat}&partido=${id}`;
  if (paso === "once") return `/admin/alineacion?categoria=${cat}&partido=${id}`;
  const plantilla = paso === "resultado" ? "resumo" : paso;
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
  useEffect(() => {
    let vigente = true;
    void cargarCartelesPartido([p.id]).then((r) => {
      if (vigente && r.ok) setCarteles({ id: p.id, deEste: r.datos[p.id] ?? {} });
    });
    return () => {
      vigente = false;
    };
  }, [p.id]);
  const jugado = marcadorDe(p) !== null;
  const antes: PasoCartel[] = preparaConvocatoria(categoria)
    ? ["partido", "convocatoria", "once"]
    : ["partido"];
  const deEste = carteles?.id === p.id ? carteles.deEste : null;
  // Jugado, primero lo de después; los técnicos solo hacen convocatoria y once. Ya jugado, la
  // convocatoria y el once no se hacen: solo se ven los carteles que se guardaron.
  const pasos = (
    jugado ? (["resultado", "cronoloxia", "noso11", ...antes] as PasoCartel[]) : antes
  )
    .filter((paso) => acceso?.rol !== "tecnico" || paso === "convocatoria" || paso === "once")
    .filter(
      (paso) =>
        !jugado || (paso !== "convocatoria" && paso !== "once") || (deEste?.[paso] ?? []).length > 0,
    );
  if (deEste && pasos.length === 0) return null;
  return (
    <section className={styles.carteles} aria-label="Carteles del partido">
      <p className={styles.etiqueta}>Carteles del partido</p>
      {!deEste ? (
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
                  <span>
                    {estado === "hecho"
                      ? "✓ Guardado"
                      : estado === "desactualizado"
                        ? "⚠ Guardado con datos viejos"
                        : "Sin hacer"}
                  </span>
                </div>
                <div className={styles.accionesCartel}>
                  {guardados.map((g) => (
                    <a
                      key={g.formato}
                      href={g.url}
                      download={`${paso}-${g.formato}.png`}
                      aria-label={`Descargar ${PASOS[paso].nombre}: ${NOMBRE_FORMATO[g.formato]}`}
                    >
                      ↓ {guardados.length > 1 ? NOMBRE_FORMATO[g.formato] : "Descargar"}
                    </a>
                  ))}
                  {!(jugado && (paso === "convocatoria" || paso === "once")) && (
                    <Link
                      href={enlaceDelPaso(paso, p.id, categoria)}
                      transitionTypes={["nav-forward"]}
                      aria-label={`${guardados.length ? "Rehacer" : "Hacer"} ${PASOS[paso].nombre}`}
                    >
                      {guardados.length ? "Rehacer" : "Hacer"}
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
 * El acta de un partido propio ya jugado: traerla de la federación (solo el administrador, con la
 * competición enlazada) y meterla a mano o corregirla.
 */
function ActaDelPartido({
  partido: p,
  categoria,
  competicion,
  onNovedades,
}: {
  partido: PartidoDeLiga;
  categoria: string;
  competicion: PartidosDeLiga["competicion"];
  onNovedades: () => void;
}) {
  const { acceso, showToast } = useStudio();
  const [trayendo, setTrayendo] = useState(false);
  const href = `/admin/actas?categoria=${encodeURIComponent(categoria)}&competicion=${encodeURIComponent(competicion.id)}&partido=${encodeURIComponent(p.id)}`;
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
    <div className={styles.accionesCartel}>
      {competicion.enlazada && acceso?.rol !== "tecnico" && (
        <Button
          size="sm"
          variant="secondary"
          pending={trayendo}
          pendingLabel="Trayendo el acta…"
          onClick={traer}
        >
          Traer acta
        </Button>
      )}
      <Link href={href} transitionTypes={["nav-forward"]}>
        {p.conActa ? "Corregir acta" : "Meter acta a mano"}
      </Link>
    </div>
  );
}

function Detalle({
  partido: p,
  categoria,
  competicion,
  onNovedades,
  onClose,
}: {
  partido: PartidoDeLiga | null;
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
            {/* Tocar un equipo abre su ficha. */}
            <Link
              href={`/admin/equipo?id=${encodeURIComponent(p.local.id)}`}
              transitionTypes={["nav-forward"]}
              aria-label={`Ficha de ${p.local.nombre}`}
            >
              <Escudo url={p.local.escudoUrl} />
              {p.local.nombre}
            </Link>
            <strong>{marcadorDe(p) ?? (cuando.hora || "—")}</strong>
            {/* Tocar un equipo abre su ficha. */}
            <Link
              href={`/admin/equipo?id=${encodeURIComponent(p.visitante.id)}`}
              transitionTypes={["nav-forward"]}
              aria-label={`Ficha de ${p.visitante.nombre}`}
            >
              <Escudo url={p.visitante.escudoUrl} />
              {p.visitante.nombre}
            </Link>
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
          {(p.local.propio || p.visitante.propio) && pasado && (
            <ActaDelPartido
              partido={p}
              categoria={categoria}
              competicion={competicion}
              onNovedades={onNovedades}
            />
          )}
          {(p.local.propio || p.visitante.propio) && (
            <CartelesDelPartidoLiga partido={p} categoria={categoria} />
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
  // `?partido=` abre el detalle de ese partido en su jornada (enlaces desde otras pantallas).
  const partidoPedido = params.get("partido");
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
  const enMesa = mesa && datos.partidos.some((p) => p.id === mesa.partido.id) ? mesa.partido : null;
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
      <Detalle
        partido={abierto ? (datos.partidos.find((p) => p.id === abierto.id) ?? abierto) : null}
        categoria={categoria}
        competicion={datos.competicion}
        onNovedades={() => void cargar(selectedCompetitionId, pedida)}
        onClose={() => setAbierto(null)}
      />
    </div>
  );
}
