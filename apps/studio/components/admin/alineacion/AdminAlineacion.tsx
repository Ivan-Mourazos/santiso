"use client";

/* eslint-disable @next/next/no-img-element -- fotos de la plantilla en /media: sin optimizador */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CartelesDelPaso } from "@/components/admin/cartel/CartelesDelPaso";
import { useCartelAssets } from "@/components/admin/cartel/useCartelAssets";
import { AvisosPartido, avisoDe, MarcaAviso } from "@/components/admin/liga/AvisosPartido";
import { FotoFondoControl } from "@/components/cartel2/FotoFondoControl";
import { useStudio, useUnsavedChanges } from "@/components/studio/StudioContext";
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
import { fechaCorta, type FotoCartel } from "@/lib/cartel2/modelo";
import type { CartelGuardado } from "@/lib/cartel2/pasos";
import { cargarPantallaAlineacion, guardarAlineacion } from "@/lib/server/acciones/alineacion";
import {
  cargarCartelesPartido,
  cargarFotoGuardada,
} from "@/lib/server/acciones/carteles-guardados";
import styles from "./Alineacion.module.css";
import { iniciales } from "@/lib/iniciales";

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
 * Instagram (9:16), que queda guardada con el partido. Se guarda aparte del acta.
 */
export default function AdminAlineacion({ categoria, partidoInicial, showToast }: Props) {
  const [pantalla, setPantalla] = useState<PantallaAlineacion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [alineacion, setAlineacion] = useState<Alineacion>(ALINEACION_VACIA);
  const [guardada, setGuardada] = useState<Alineacion>(ALINEACION_VACIA);
  const [ocupada, setOcupada] = useState(false);
  const [fotoFondo, setFotoFondo] = useState<FotoCartel | null>(null);
  // La foto con la que se generó el cartel guardado: si la de pantalla es otra, hay que actualizarlo.
  const [fotoGenerada, setFotoGenerada] = useState<FotoCartel | null>(null);
  const [carteles, setCarteles] = useState<CartelGuardado[] | null>(null);
  const generacion = useRef(0);
  const recursos = useCartelAssets("noso11");

  const sucio = JSON.stringify(alineacion) !== JSON.stringify(guardada);
  useUnsavedChanges(sucio);
  const { showConfirm } = useStudio();

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
      setCarteles(null);
      setFotoFondo(null);
      setFotoGenerada(null);
      if (!r.datos.partidoId) return;
      const [guardados, foto] = await Promise.all([
        cargarCartelesPartido([r.datos.partidoId]),
        cargarFotoGuardada(r.datos.partidoId, "once"),
      ]);
      if (esta !== generacion.current) return;
      // La foto de fondo con la que se guardó vuelve a salir, para no perderla al regenerar.
      const conFoto = foto.ok ? foto.datos : null;
      setFotoFondo(conFoto);
      setFotoGenerada(conFoto);
      setCarteles(guardados.ok ? (guardados.datos[r.datos.partidoId]?.once ?? []) : []);
    },
    [categoria],
  );

  useEffect(() => {
    const id = window.setTimeout(() => void cargar(partidoInicial ?? null), 0);
    return () => window.clearTimeout(id);
  }, [cargar, partidoInicial]);

  const partido = pantalla?.partidos.find((p) => p.id === pantalla.partidoId) ?? null;
  const bloqueada = Boolean(partido?.finalizado);

  const peticion = useMemo(() => {
    if (!pantalla || !partido) return null;
    const p = peticionDeAlineacion(categoria, partido, pantalla.jugadores, alineacion, {
      institucionales: (recursos.xuntaIsLeft
        ? [recursos.xunta, recursos.rfgf]
        : [recursos.rfgf, recursos.xunta]
      ).filter(Boolean),
      patrocinadores: recursos.sponsors,
      colorRival: aHex(COLOR_RIVAL_RESERVA),
    });
    return p.plantilla === "alineacion" ? { ...p, datos: { ...p.datos, foto: fotoFondo } } : p;
  }, [pantalla, partido, categoria, alineacion, recursos, fotoFondo]);

  function tocar(jugadorId: string) {
    if (bloqueada || !pantalla) return;
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

  /** La historia con lo que hay en pantalla; antes se guarda, para que el cartel case con la base. */
  async function prepararCartel() {
    if (!peticion) return null;
    if (sucio && !bloqueada && !(await guardar())) return null;
    return [peticion];
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
              const id = e.target.value;
              if (sucio) showConfirm("Hay cambios sin guardar. ¿Descartarlos?", () => cargar(id));
              else void cargar(id);
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

      {pantalla.jugadores.length === 0 ? (
        <EmptyState
          title={`La plantilla de ${categoria} está vacía.`}
          detail="Da de alta a los jugadores en Plantilla › Jugadores."
        />
      ) : (
        <>
          <AvisosPartido avisos={pantalla.avisos} />
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
              const aviso = avisoDe(pantalla.avisos, j.id);
              return (
                <li key={j.id} data-papel={papel}>
                  <button
                    type="button"
                    className={styles.jugador}
                    onClick={() => tocar(j.id)}
                    disabled={bloqueada || ocupada}
                    aria-label={`${nombre}: ${ETIQUETA[papel] === "—" ? "fuera" : ETIQUETA[papel]}${aviso ? `, ${aviso.situacion}` : ""}`}
                  >
                    <span className={styles.dorsal}>{j.dorsal ?? ""}</span>
                    {j.fotoUrl ? (
                      <img className={styles.foto} src={`${j.fotoUrl}?ancho=480`} alt="" />
                    ) : (
                      <span className={styles.foto} aria-hidden="true">
                        {iniciales(nombre)}
                      </span>
                    )}
                    <span className={styles.nombre}>
                      {nombre}
                      <MarcaAviso aviso={aviso} />
                    </span>
                    <span className={styles.papel}>{ETIQUETA[papel]}</span>
                  </button>
                  {papel === "titular" && (
                    <button
                      type="button"
                      className={styles.capitan}
                      aria-pressed={alineacion.capitanId === j.id}
                      aria-label={`Capitán: ${nombre}`}
                      disabled={bloqueada || ocupada}
                      onClick={() => setAlineacion((antes) => conCapitan(antes, j.id))}
                    >
                      C
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          <FotoFondoControl foto={fotoFondo} onChange={setFotoFondo} />
          {carteles === null ? (
            <LoadingState title="Cargando carteles guardados…" />
          ) : (
            <CartelesDelPaso
              key={partido.id}
              partidoId={partido.id}
              paso="once"
              guardados={carteles}
              preparar={prepararCartel}
              cambios={
                JSON.stringify(fotoFondo) !== JSON.stringify(fotoGenerada)
                  ? "Has cambiado la foto de fondo: actualiza el cartel para que la lleve."
                  : null
              }
              onCambio={() => setFotoGenerada(fotoFondo)}
              motivo={alineacion.titulares.length === 0 ? "Elige al menos un titular." : null}
              showToast={showToast}
            />
          )}
          {!bloqueada && (
            <div className={styles.barra}>
              <Button
                variant="secondary"
                onClick={() => void guardarSolo()}
                disabled={!sucio || ocupada}
              >
                Guardar
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
