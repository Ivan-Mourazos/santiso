"use client";
import type { TipoEvento } from "@santiso/domain";
import { useCallback, useEffect, useRef, useState } from "react";
import { useStudio } from "@/components/studio/StudioContext";
import { Button } from "@/components/ui/foundation/Button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/foundation/States";
import { aplicarLocal, compactar, enviarCola, escribirCola, leerCola } from "@/lib/directo/cola";
import {
  avanzarReloj,
  etiquetaMinuto,
  minutoActual,
  segundosParte,
  type AccionReloj,
  type RelojDirecto,
} from "@/lib/directo/reloj";
import type { EventoDirecto, OperacionDirecto, PantallaDirecto } from "@/lib/directo/tipos";
import { aplicarDirecto, cargarDirecto } from "@/lib/server/acciones/directo";
import { CierreActa } from "./CierreActa";
import { descripcion, ICONO, marcador, NOMBRE_TIPO } from "./modelo";
import { PanelEvento } from "./PanelEvento";
import s from "./Directo.module.css";

const TIPOS: TipoEvento[] = ["gol", "tarjeta_amarilla", "tarjeta_roja", "cambio"];
const REINTENTO_MS = 20_000;

const reloj2 = (n: number) => String(n).padStart(2, "0");
const almacen = () => (typeof window === "undefined" ? null : window.localStorage);

/**
 * Libreta del partido en directo: apuntes del delegado para cerrar el acta con el árbitro.
 * Cada toque se ve al momento y va a una cola en el móvil; la cola se envía en cuanto hay red.
 */
export default function AdminDirecto({ partidoId }: { partidoId: string | null }) {
  const { showConfirm } = useStudio();
  const [pantalla, setPantalla] = useState<PantallaDirecto | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Lo que ya está en el servidor. */
  const [servidor, setServidor] = useState<EventoDirecto[]>([]);
  const [relojServidor, setRelojServidor] = useState<RelojDirecto | null>(null);
  /** Lo pendiente de enviar; espejo de lo guardado en el móvil. */
  const [cola, setCola] = useState<OperacionDirecto[]>([]);
  const colaRef = useRef<OperacionDirecto[]>([]);
  const enviando = useRef(false);
  const [ahora, setAhora] = useState(() => Date.now());
  const [vista, setVista] = useState<"apuntar" | "cierre">("apuntar");
  const [panel, setPanel] = useState<{ evento: EventoDirecto; nuevo: boolean } | null>(null);
  /** Texto tal cual se teclea: se valida al empezar, no a cada tecla. */
  const [duracion, setDuracion] = useState("45");
  /** Por qué no se pudo enviar la cola la última vez; `null` si se envió. */
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);

  const guardarCola = useCallback(
    (ops: OperacionDirecto[]) => {
      colaRef.current = ops;
      setCola(ops);
      const a = almacen();
      if (a && partidoId) escribirCola(a, partidoId, ops);
    },
    [partidoId],
  );

  const sincronizar = useCallback(async () => {
    if (!partidoId || enviando.current || colaRef.current.length === 0) return;
    enviando.current = true;
    const lote = colaRef.current;
    try {
      const r = await enviarCola(lote, (ops) => aplicarDirecto(partidoId, ops));
      setErrorEnvio(r.error ?? null);
      if (r.enviadas > 0) {
        setServidor((prev) => aplicarLocal(prev, lote));
        const ultimoReloj = [...lote].reverse().find((o) => o.op === "reloj");
        if (ultimoReloj?.op === "reloj") setRelojServidor(ultimoReloj.reloj);
        // Lo apuntado mientras se enviaba va detrás del lote: se conserva.
        guardarCola(colaRef.current.slice(lote.length));
      }
    } finally {
      enviando.current = false;
    }
  }, [partidoId, guardarCola]);

  useEffect(() => {
    if (!partidoId) return;
    let vivo = true;
    void cargarDirecto(partidoId)
      .then((r) => {
        if (!vivo) return;
        if (!r.ok) return setError(r.error);
        setPantalla(r.datos);
        setServidor(r.datos.eventos);
        setRelojServidor(r.datos.reloj);
        setDuracion(String(r.datos.reloj.duracionParte));
        const a = almacen();
        guardarCola(a ? leerCola(a, partidoId) : []);
        void sincronizar();
      })
      .catch(() => {
        // Sin red al abrir: si había cola en el móvil, al menos que no se pierda.
        if (vivo) setError("No se pudo conectar con el Studio. Abre el directo con cobertura.");
      });
    return () => {
      vivo = false;
    };
  }, [partidoId, guardarCola, sincronizar]);

  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 1000);
    const r = setInterval(() => void sincronizar(), REINTENTO_MS);
    const enLinea = () => void sincronizar();
    window.addEventListener("online", enLinea);
    return () => {
      clearInterval(t);
      clearInterval(r);
      window.removeEventListener("online", enLinea);
    };
  }, [sincronizar]);

  if (!partidoId) {
    return (
      <EmptyState
        title="Abre el directo desde la ficha del partido"
        detail="En Liga → Partidos, toca nuestro partido y pulsa «Directo»."
      />
    );
  }
  if (error) return <ErrorState title="No se pudo abrir el directo" detail={error} />;
  if (!pantalla || !relojServidor) return <LoadingState title="Abriendo el directo…" />;

  const eventos = aplicarLocal(servidor, cola);
  const ultimoReloj = [...cola].reverse().find((o) => o.op === "reloj");
  const reloj = ultimoReloj?.op === "reloj" ? ultimoReloj.reloj : relojServidor;
  const m = marcador(pantalla.partido, eventos);
  const seg = segundosParte(reloj, ahora);
  const pausado = reloj.pausaDesde !== null;

  function encolar(op: OperacionDirecto) {
    const pendientes = enviando.current
      ? [...colaRef.current, op]
      : compactar([...colaRef.current, op]);
    guardarCola(pendientes);
    void sincronizar();
  }

  function moverReloj(accion: AccionReloj) {
    const minutos = Math.trunc(Number(duracion));
    const duracionParte = minutos >= 10 && minutos <= 60 ? minutos : reloj.duracionParte;
    if (accion === "empezar") setDuracion(String(duracionParte));
    const base = accion === "empezar" ? { ...reloj, duracionParte } : reloj;
    const siguiente = avanzarReloj(base, accion, Date.now());
    if (siguiente !== base) encolar({ op: "reloj", reloj: siguiente });
  }

  function nuevo(tipo: TipoEvento) {
    const ahoraMismo = minutoActual(reloj, Date.now());
    const parte = ahoraMismo?.parte ?? (reloj.estado === "segunda" || reloj.estado === "final" ? 2 : 1);
    setPanel({
      nuevo: true,
      evento: {
        id: crypto.randomUUID(),
        tipo,
        lado: "propio",
        propia: false,
        parte,
        minuto: ahoraMismo?.minuto ?? null,
        jugadorId: null,
        jugadorSaleId: null,
        dorsal: null,
        dorsalSale: null,
        nota: "",
      },
    });
  }

  const pendientes = cola.length;

  return (
    <div className={s.pantalla}>
      <header className={s.cabecera}>
        <div className={s.marcador} aria-label="Marcador">
          <span>{pantalla.partido.local}</span>
          <strong>
            {m.local} – {m.visitante}
          </strong>
          <span>{pantalla.partido.visitante}</span>
        </div>
        <div className={s.reloj}>
          <span className={s.parte}>
            {
              {
                previo: "Sin empezar",
                primera: "1ª parte",
                descanso: "Descanso",
                segunda: "2ª parte",
                final: "Final",
              }[reloj.estado]
            }
          </span>
          <span className={s.tiempo} aria-label="Cronómetro" data-pausado={pausado || undefined}>
            {reloj2(Math.floor(seg / 60))}:{reloj2(seg % 60)}
          </span>
          {(reloj.estado === "primera" || reloj.estado === "segunda") && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => moverReloj(pausado ? "seguir" : "pausa")}
              aria-label={pausado ? "Seguir el cronómetro" : "Parar el cronómetro"}
            >
              {pausado ? "▶" : "⏸"}
            </Button>
          )}
        </div>
        <div className={s.accionesReloj}>
          {reloj.estado === "previo" && (
            <>
              <label className={s.duracion}>
                Minutos por parte
                <input
                  type="number"
                  inputMode="numeric"
                  min={10}
                  max={60}
                  value={duracion}
                  onChange={(e) => setDuracion(e.target.value)}
                />
              </label>
              <Button size="sm" onClick={() => moverReloj("empezar")}>
                Empezar 1ª parte
              </Button>
            </>
          )}
          {reloj.estado === "primera" && (
            <Button size="sm" variant="secondary" onClick={() => moverReloj("descanso")}>
              Descanso
            </Button>
          )}
          {reloj.estado === "descanso" && (
            <Button size="sm" onClick={() => moverReloj("segunda")}>
              Empezar 2ª parte
            </Button>
          )}
          {reloj.estado === "segunda" && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => showConfirm("¿Dar el partido por terminado?", () => moverReloj("final"))}
            >
              Final
            </Button>
          )}
        </div>
        {pendientes > 0 && (
          <p className={s.pendiente} role="status">
            Pendiente de enviar ({pendientes})
            {errorEnvio &&
              (errorEnvio === "Sin conexión"
                ? " · Sin conexión: se envía solo al volver la señal. Si tienes señal, vuelve a entrar en el Studio."
                : ` · ${errorEnvio}`)}
          </p>
        )}
      </header>

      <div className={s.vistas} role="tablist" aria-label="Vista">
        <button
          type="button"
          role="tab"
          aria-selected={vista === "apuntar"}
          onClick={() => setVista("apuntar")}
        >
          Apuntar
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={vista === "cierre"}
          onClick={() => setVista("cierre")}
        >
          Para cerrar el acta
        </button>
      </div>

      {vista === "apuntar" ? (
        <>
          <div className={s.botones}>
            {TIPOS.map((t) => (
              <button key={t} type="button" className={s.botonEvento} data-tipo={t} onClick={() => nuevo(t)}>
                <span aria-hidden>{ICONO[t]}</span>
                {NOMBRE_TIPO[t]}
              </button>
            ))}
          </div>
          {eventos.length === 0 ? (
            <p className={s.nota}>Toca un botón para apuntar lo que pase.</p>
          ) : (
            <ol className={s.lista} aria-label="Lo apuntado">
              {[...eventos].reverse().map((e) => (
                <li key={e.id} data-lado={e.lado}>
                  <button type="button" onClick={() => setPanel({ evento: e, nuevo: false })}>
                    <span className={s.minuto}>
                      {etiquetaMinuto(e.parte, e.minuto, reloj.duracionParte) || "—"}
                    </span>
                    <span aria-hidden>{ICONO[e.tipo]}</span>
                    <span className={s.texto}>
                      <span className={s.lado}>{e.lado === "propio" ? "Nosotros" : "Rival"}</span>{" "}
                      {NOMBRE_TIPO[e.tipo]} · {descripcion(e, pantalla.jugadores)}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </>
      ) : (
        <CierreActa pantalla={{ ...pantalla, reloj }} eventos={eventos} />
      )}

      {panel && (
        <PanelEvento
          key={panel.evento.id}
          inicial={panel.evento}
          nuevo={panel.nuevo}
          jugadores={pantalla.jugadores}
          duracion={reloj.duracionParte}
          onCerrar={() => setPanel(null)}
          onGuardar={(evento) => {
            encolar({ op: "guardar", evento });
            setPanel(null);
          }}
          onBorrar={(id) =>
            showConfirm("¿Borrar este apunte?", () => {
              encolar({ op: "borrar", id });
              setPanel(null);
            })
          }
        />
      )}
    </div>
  );
}
