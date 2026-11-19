"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CartelesDelPaso } from "@/components/admin/cartel/CartelesDelPaso";
import { useCartelAssets } from "@/components/admin/cartel/useCartelAssets";
import { EditorTactico } from "@/components/admin/cartel/EditorTactico";
import { useStudio, useUnsavedChanges } from "@/components/studio/StudioContext";
import { Button } from "@/components/ui/foundation/Button";
import { Select } from "@/components/ui/foundation/Fields";
import { EmptyState, ErrorState, LoadingState, StateLink } from "@/components/ui/foundation/States";
import {
  ALINEACION_VACIA,
  aplicarColocacion,
  alternarSuplente,
  colocacionDeAlineacion,
  conCapitan,
  nombreDeCartel,
  peticionDeAlineacion,
  TITULARES,
  type Alineacion,
  type PantallaAlineacion,
} from "@/lib/alineacion/modelo";
import { aHex, COLOR_RIVAL_RESERVA } from "@/lib/cartel2/color";
import { fechaCorta } from "@/lib/cartel2/modelo";
import type { Colocacion } from "@/lib/cartel2/tactica";
import type { CartelGuardado } from "@/lib/cartel2/pasos";
import { cargarPantallaAlineacion, guardarAlineacion } from "@/lib/server/acciones/alineacion";
import { guardarColocacion } from "@/lib/server/acciones/colocacion";
import {
  cargarCartelesPartido,
} from "@/lib/server/acciones/carteles-guardados";
import styles from "./Alineacion.module.css";

interface Props {
  categoria: string;
  /** Partido ya elegido al abrir, desde «Jornada». */
  partidoInicial?: string | null;
  showToast: (msg: string, type?: "success" | "error") => void;
}

/**
 * Alineación antes del partido, pensada para hacerla con el móvil en el campo: se toca un hueco
 * del campo y se elige quién va (y si es el capitán); debajo, el banquillo. Genera la historia
 * de Instagram (9:16), que queda guardada con el partido. Se guarda aparte del acta.
 */
export default function AdminAlineacion({ categoria, partidoInicial, showToast }: Props) {
  const [pantalla, setPantalla] = useState<PantallaAlineacion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [alineacion, setAlineacion] = useState<Alineacion>(ALINEACION_VACIA);
  const [guardada, setGuardada] = useState<Alineacion>(ALINEACION_VACIA);
  const [ocupada, setOcupada] = useState(false);
  // Dónde va cada titular en el campo: lo elegido en el editor y lo que hay guardado.
  const [colocacion, setColocacion] = useState<Colocacion | null>(null);
  const [colocacionGuardada, setColocacionGuardada] = useState<Colocacion | null>(null);
  const [carteles, setCarteles] = useState<CartelGuardado[] | null>(null);
  const generacion = useRef(0);
  const recursos = useCartelAssets("noso11");

  // La colocación siempre casa con los titulares: lo elegido y, los que falten, por posición.
  const enCampo = useMemo(
    () =>
      pantalla ? colocacionDeAlineacion(pantalla.jugadores, alineacion, colocacion) : null,
    [pantalla, alineacion, colocacion],
  );
  const sucio =
    JSON.stringify(alineacion) !== JSON.stringify(guardada) ||
    (alineacion.titulares.length > 0 &&
      JSON.stringify(enCampo) !== JSON.stringify(colocacionGuardada));
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
      setColocacion(r.datos.colocacion);
      setColocacionGuardada(
        r.datos.alineacion.titulares.length
          ? colocacionDeAlineacion(r.datos.jugadores, r.datos.alineacion, r.datos.colocacion)
          : null,
      );
      if (!r.datos.partidoId) return;
      const guardados = await cargarCartelesPartido([r.datos.partidoId]);
      if (esta !== generacion.current) return;
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
    // El once en el campo: la colocación guardada, o la automática por posiciones.
    return peticionDeAlineacion(
      categoria,
      partido,
      pantalla.jugadores,
      alineacion,
      {
        institucionales: (recursos.xuntaIsLeft
          ? [recursos.xunta, recursos.rfgf]
          : [recursos.rfgf, recursos.xunta]
        ).filter(Boolean),
        patrocinadores: recursos.sponsors,
        colorRival: aHex(COLOR_RIVAL_RESERVA),
      },
      enCampo,
    );
  }, [pantalla, partido, categoria, alineacion, recursos, enCampo]);

  /** El capitán de la plantilla se propone solo en cuanto entra en el once. */
  function conCapitanDePlantilla(a: Alineacion): Alineacion {
    if (a.capitanId || !pantalla) return a;
    const capitan = pantalla.jugadores.find((j) => j.capitan && a.titulares.includes(j.id));
    return capitan ? conCapitan(a, capitan.id) : a;
  }
  // Los convocados que no están en el campo: se tocan para ponerlos o quitarlos del banco.
  const banco = pantalla?.jugadores.filter((j) => !alineacion.titulares.includes(j.id)) ?? [];

  async function guardar(): Promise<boolean> {
    if (!partido) return false;
    const r = await guardarAlineacion(partido.id, alineacion);
    if (!r.ok) {
      showToast(r.error, "error");
      return false;
    }
    setGuardada(alineacion);
    if (enCampo && alineacion.titulares.length > 0) {
      const c = await guardarColocacion(partido.id, "previa", enCampo);
      if (!c.ok) {
        showToast(c.error, "error");
        return false;
      }
      setColocacionGuardada(enCampo);
    }
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
        detail="Necesitas un partido pendiente para colocar a los titulares. Consulta en Liga la jornada de esta categoría."
        action={<StateLink href={`/admin/partidos?categoria=${encodeURIComponent(categoria)}`}>Ver jornadas</StateLink>}
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
                J{p.jornada} · {p.fecha ? fechaCorta(p.fecha.slice(0, 10)) : "Sin fecha"} · {p.rival.nombre}
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
          detail="Añade jugadores a la plantilla para poder formar el once."
          action={<StateLink href={`/admin/jugadores?categoria=${encodeURIComponent(categoria)}`}>Ir a Plantilla</StateLink>}
        />
      ) : (
        <>
          {/* El cartel queda al final, tras el campo y el banco: desde arriba se llega de un toque. */}
          {alineacion.titulares.length > 0 && (
            <Button
              variant="secondary"
              className={styles.irCartel}
              onClick={() =>
                document
                  .getElementById("cartel-once")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
            >
              {carteles?.length ? "Compartir el cartel del once ↓" : "Generar el cartel del once ↓"}
            </Button>
          )}
          {enCampo && (
            <div className={styles.titulares}>
              <h4 className={styles.tituloGrupo}>
                Titulares
                <span className={styles.contador} role="status" data-completo={alineacion.titulares.length === TITULARES}>
                  {alineacion.titulares.length} / {TITULARES} titulares
                </span>
              </h4>
              <EditorTactico
                jugadores={pantalla.jugadores.map((j) => ({
                  id: j.id,
                  nombre: nombreDeCartel(j),
                  dorsal: j.dorsal,
                  posicion: j.posicion,
                }))}
                colocacion={enCampo}
                soloLectura={bloqueada || ocupada}
                capitanId={alineacion.capitanId}
                onCapitan={(id) => setAlineacion((antes) => conCapitan(antes, id))}
                onCambio={(c) => {
                  setColocacion(c);
                  setAlineacion((antes) => conCapitanDePlantilla(aplicarColocacion(antes, c.huecos)));
                }}
              />
            </div>
          )}
          {banco.length > 0 && (
            <section className={styles.banco} aria-label="Banquillo">
              <h4 className={styles.tituloGrupo}>
                Banquillo
                <span className={styles.contador} role="status">
                  {alineacion.suplentes.length}{" "}
                  {alineacion.suplentes.length === 1 ? "suplente" : "suplentes"}
                </span>
              </h4>
              <ul>
                {banco.map((j) => {
                  const nombre = nombreDeCartel(j);
                  const suplente = alineacion.suplentes.includes(j.id);
                  return (
                    <li key={j.id}>
                      <button
                        type="button"
                        aria-pressed={suplente}
                        aria-label={`Suplente: ${nombre}`}
                        disabled={bloqueada || ocupada}
                        onClick={() => setAlineacion((antes) => alternarSuplente(antes, j.id))}
                      >
                        <b>{j.dorsal ?? ""}</b>
                        <span>{nombre}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          {!bloqueada && (sucio || ocupada) && (
            <div className={styles.barra}>
              <Button onClick={() => void guardarSolo()} disabled={ocupada}>
                Guardar
              </Button>
            </div>
          )}
          <div id="cartel-once" className={styles.anclaCartel} />
          {carteles === null ? (
            <LoadingState title="Cargando carteles guardados…" />
          ) : (
            <CartelesDelPaso
              key={partido.id}
              partidoId={partido.id}
              paso="once"
              generarSecundario={sucio || ocupada}
              guardados={carteles}
              onCambio={setCarteles}
              preparar={prepararCartel}
              motivo={alineacion.titulares.length === 0 ? "Elige al menos un titular." : null}
              showToast={showToast}
            />
          )}
        </>
      )}
    </div>
  );
}
