"use client";

/* eslint-disable @next/next/no-img-element -- media local y PNG generado: sin optimizador */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCartelAssets } from "@/components/admin/cartel/useCartelAssets";
import { useUnsavedChanges } from "@/components/studio/StudioContext";
import { Button } from "@/components/ui/foundation/Button";
import { Select } from "@/components/ui/foundation/Fields";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/foundation/States";
import {
  ALINEACION_VACIA,
  alternar,
  conCapitan,
  nombreDeCartel,
  papelDe,
  peticionDeAlineacion,
  TITULARES,
  type Alineacion,
  type PantallaAlineacion,
} from "@/lib/alineacion/modelo";
import { aHex, COLOR_RIVAL_RESERVA } from "@/lib/cartel2/color";
import { fechaCorta } from "@/lib/cartel2/modelo";
import { cargarPantallaAlineacion, guardarAlineacion } from "@/lib/server/acciones/alineacion";
import styles from "./Alineacion.module.css";

interface Props {
  categoria: string;
  /** Partido ya elegido al abrir, desde «Jornada». */
  partidoInicial?: string | null;
  showToast: (msg: string, type?: "success" | "error") => void;
}

const ETIQUETA = { titular: "Titular", suplente: "Suplente", fuera: "—" } as const;

/**
 * Alineación antes del partido, pensada para hacerla con el móvil en el campo: se toca a cada
 * jugador (titular → suplente → fuera), se marca al capitán y se genera la historia de
 * Instagram (9:16) para compartirla. Se guarda aparte del acta.
 */
export default function AdminAlineacion({ categoria, partidoInicial, showToast }: Props) {
  const [pantalla, setPantalla] = useState<PantallaAlineacion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [alineacion, setAlineacion] = useState<Alineacion>(ALINEACION_VACIA);
  const [guardada, setGuardada] = useState<Alineacion>(ALINEACION_VACIA);
  const [ocupada, setOcupada] = useState(false);
  const [historia, setHistoria] = useState<{ url: string; fichero: File } | null>(null);
  const generacion = useRef(0);
  const recursos = useCartelAssets("noso11");

  const sucio = JSON.stringify(alineacion) !== JSON.stringify(guardada);
  useUnsavedChanges(sucio);

  const cargar = useCallback(
    async (partidoId: string | null) => {
      const esta = ++generacion.current;
      const r = await cargarPantallaAlineacion(categoria, partidoId);
      if (esta !== generacion.current) return;
      if (!r.ok) return setError(r.error);
      setError(null);
      setPantalla(r.datos);
      setAlineacion(r.datos.alineacion);
      setGuardada(r.datos.alineacion);
    },
    [categoria],
  );

  useEffect(() => {
    const id = window.setTimeout(() => void cargar(partidoInicial ?? null), 0);
    return () => window.clearTimeout(id);
  }, [cargar, partidoInicial]);

  // El PNG generado es un `blob:`: se libera al cambiarlo o al salir.
  const urlHistoria = historia?.url;
  useEffect(() => {
    return () => {
      if (urlHistoria) URL.revokeObjectURL(urlHistoria);
    };
  }, [urlHistoria]);

  const partido = pantalla?.partidos.find((p) => p.id === pantalla.partidoId) ?? null;
  const bloqueada = Boolean(partido?.finalizado);

  const peticion = useMemo(() => {
    if (!pantalla || !partido) return null;
    return peticionDeAlineacion(categoria, partido, pantalla.jugadores, alineacion, {
      institucionales: (recursos.xuntaIsLeft
        ? [recursos.xunta, recursos.rfgf]
        : [recursos.rfgf, recursos.xunta]
      ).filter(Boolean),
      patrocinadores: recursos.sponsors,
      colorRival: aHex(COLOR_RIVAL_RESERVA),
    });
  }, [pantalla, partido, categoria, alineacion, recursos]);

  function tocar(jugadorId: string) {
    if (bloqueada || !pantalla) return;
    setHistoria(null);
    setAlineacion((antes) => {
      let despues = alternar(antes, jugadorId);
      // El capitán de la plantilla se propone solo al entrar en el once.
      const jugador = pantalla.jugadores.find((j) => j.id === jugadorId);
      if (jugador?.capitan && !despues.capitanId && despues.titulares.includes(jugadorId)) {
        despues = conCapitan(despues, jugadorId);
      }
      return despues;
    });
  }

  async function guardar(): Promise<boolean> {
    if (!partido) return false;
    const r = await guardarAlineacion(partido.id, alineacion);
    if (!r.ok) {
      showToast(r.error, "error");
      return false;
    }
    setGuardada(alineacion);
    return true;
  }

  async function guardarSolo() {
    setOcupada(true);
    try {
      if (await guardar()) showToast("Alineación guardada");
    } finally {
      setOcupada(false);
    }
  }

  /** Guarda (si hace falta) y genera el PNG: compartir después es inmediato, como pide iOS. */
  async function generar() {
    if (!peticion || !partido) return;
    setOcupada(true);
    try {
      if (sucio && !bloqueada && !(await guardar())) return;
      const respuesta = await fetch("/api/carteles/png", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(peticion),
      });
      if (!respuesta.ok) throw new Error(String(respuesta.status));
      const blob = await respuesta.blob();
      const dia = (partido.fecha ?? "").slice(0, 10) || "partido";
      const fichero = new File([blob], `alineacion-${dia}.png`, { type: "image/png" });
      setHistoria({ url: URL.createObjectURL(blob), fichero });
    } catch {
      showToast("No se pudo generar la historia. Vuelve a intentarlo.", "error");
    } finally {
      setOcupada(false);
    }
  }

  function descargar() {
    if (!historia) return;
    const enlace = document.createElement("a");
    enlace.href = historia.url;
    enlace.download = historia.fichero.name;
    enlace.click();
  }

  async function compartir() {
    if (!historia) return;
    const datos = { files: [historia.fichero] };
    if (!navigator.canShare?.(datos)) return descargar();
    try {
      await navigator.share(datos);
    } catch (e) {
      // Cerrar la hoja de compartir no es un error.
      if (!(e instanceof DOMException && e.name === "AbortError")) descargar();
    }
  }

  if (error) {
    return (
      <ErrorState
        title="No se pudo cargar la alineación"
        detail={error}
        action={<Button onClick={() => void cargar(null)}>Reintentar</Button>}
      />
    );
  }
  if (!pantalla) return <LoadingState title="Cargando alineación…" />;
  if (!partido) {
    return (
      <EmptyState
        title={`${categoria} no tiene partidos por jugar.`}
        detail="Aparecen aquí en cuanto estén en el Calendario."
      />
    );
  }

  const cuando = [fechaCorta((partido.fecha ?? "").slice(0, 10)), (partido.fecha ?? "").slice(11)]
    .filter(Boolean)
    .join(" · ");
  const nombrePartido = partido.santisoLocal
    ? `${partido.santiso.nombre} – ${partido.rival.nombre}`
    : `${partido.rival.nombre} – ${partido.santiso.nombre}`;

  return (
    <div className={styles.panel}>
      <header className={styles.partido}>
        {pantalla.partidos.length > 1 && (
          <Select
            label="Partido"
            value={partido.id}
            disabled={ocupada}
            onChange={(e) => {
              if (sucio && !window.confirm("Hay cambios sin guardar. ¿Descartarlos?")) return;
              setHistoria(null);
              void cargar(e.target.value);
            }}
          >
            {pantalla.partidos.map((p) => (
              <option key={p.id} value={p.id}>
                J{p.jornada} · {p.rival.nombre}
                {p.fecha ? ` · ${fechaCorta(p.fecha.slice(0, 10))}` : ""}
                {p.finalizado ? " (jugado)" : ""}
              </option>
            ))}
          </Select>
        )}
        <h3 className={styles.cruce}>{nombrePartido}</h3>
        <p className={styles.detalle}>
          {[`Jornada ${partido.jornada}`, cuando, partido.campo].filter(Boolean).join(" · ")}
        </p>
        {bloqueada && (
          <p className={styles.aviso} role="status">
            Partido ya jugado: la alineación se puede ver y compartir, pero no cambiar.
          </p>
        )}
      </header>

      {historia ? (
        <section className={styles.historia} aria-label="Historia generada">
          <img src={historia.url} alt="Historia con la alineación" />
          <div className={styles.acciones}>
            <Button onClick={() => void compartir()}>Compartir</Button>
            <Button variant="secondary" onClick={descargar}>
              Descargar
            </Button>
            <Button variant="secondary" onClick={() => setHistoria(null)}>
              Volver
            </Button>
          </div>
        </section>
      ) : pantalla.jugadores.length === 0 ? (
        <EmptyState
          title={`La plantilla de ${categoria} está vacía.`}
          detail="Da de alta a los jugadores en Plantilla › Jugadores."
        />
      ) : (
        <>
          <p className={styles.contador} role="status">
            <strong data-completo={alineacion.titulares.length === TITULARES}>
              {alineacion.titulares.length} / {TITULARES} titulares
            </strong>
            <span>
              {alineacion.suplentes.length}{" "}
              {alineacion.suplentes.length === 1 ? "suplente" : "suplentes"}
            </span>
          </p>
          <ul className={styles.jugadores} aria-label={`Plantilla ${categoria}`}>
            {pantalla.jugadores.map((j) => {
              const papel = papelDe(alineacion, j.id);
              const nombre = nombreDeCartel(j);
              return (
                <li key={j.id} data-papel={papel}>
                  <button
                    type="button"
                    className={styles.jugador}
                    onClick={() => tocar(j.id)}
                    disabled={bloqueada || ocupada}
                    aria-label={`${nombre}: ${ETIQUETA[papel] === "—" ? "fuera" : ETIQUETA[papel]}`}
                  >
                    <span className={styles.dorsal}>{j.dorsal ?? ""}</span>
                    {j.fotoUrl ? (
                      <img className={styles.foto} src={`${j.fotoUrl}?ancho=480`} alt="" />
                    ) : (
                      <span className={styles.foto} aria-hidden="true" />
                    )}
                    <span className={styles.nombre}>{nombre}</span>
                    <span className={styles.papel}>{ETIQUETA[papel]}</span>
                  </button>
                  {papel === "titular" && (
                    <button
                      type="button"
                      className={styles.capitan}
                      aria-pressed={alineacion.capitanId === j.id}
                      aria-label={`Capitán: ${nombre}`}
                      disabled={bloqueada || ocupada}
                      onClick={() => {
                        setHistoria(null);
                        setAlineacion((antes) => conCapitan(antes, j.id));
                      }}
                    >
                      C
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          <div className={styles.barra}>
            {!bloqueada && (
              <Button
                variant="secondary"
                onClick={() => void guardarSolo()}
                disabled={!sucio || ocupada}
              >
                Guardar
              </Button>
            )}
            <Button
              onClick={() => void generar()}
              pending={ocupada}
              pendingLabel="Generando…"
              disabled={alineacion.titulares.length === 0}
            >
              Ver historia
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
