"use client";
/* eslint-disable @next/next/no-img-element -- PNG local generado, sin optimizador */
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCartelAssets } from "@/components/admin/cartel/useCartelAssets";
import { useUnsavedChanges } from "@/components/studio/StudioContext";
import { Button } from "@/components/ui/foundation/Button";
import { Field, Select, Textarea } from "@/components/ui/foundation/Fields";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/foundation/States";
import { nombreDeCartel } from "@/lib/alineacion/modelo";
import { aHex, COLOR_RIVAL_RESERVA } from "@/lib/cartel2/color";
import { fechaCorta } from "@/lib/cartel2/modelo";
import {
  convocatoriaInicial,
  errorDeConvocatoria,
  peticionDeConvocatoria,
  textoWhatsApp,
  type Convocatoria,
  type PantallaConvocatoria,
} from "@/lib/convocatoria/modelo";
import {
  cargarPantallaConvocatoria,
  guardarConvocatoria,
} from "@/lib/server/acciones/convocatoria";
import s from "./Convocatoria.module.css";

export default function AdminConvocatoria({
  categoria,
  partidoInicial,
  showToast,
}: {
  categoria: string;
  partidoInicial?: string | null;
  showToast: (msg: string, type?: "success" | "error") => void;
}) {
  const router = useRouter();
  const recursos = useCartelAssets("noso11");
  const [pantalla, setPantalla] = useState<PantallaConvocatoria | null>(null);
  const [c, setC] = useState<Convocatoria>(convocatoriaInicial([]));
  const [guardada, setGuardada] = useState<Convocatoria>(convocatoriaInicial([]));
  const [persistida, setPersistida] = useState(false);
  const [ocupada, setOcupada] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [png, setPng] = useState<{ url: string; fichero: File } | null>(null);
  const generacion = useRef(0);
  const sucio = JSON.stringify(c) !== JSON.stringify(guardada);
  useUnsavedChanges(sucio);
  const cargar = useCallback(
    async (id: string | null) => {
      const turno = ++generacion.current;
      setOcupada(true);
      try {
        const r = await cargarPantallaConvocatoria(categoria, id);
        if (turno !== generacion.current) return;
        if (!r.ok) {
          setError(r.error);
          return;
        }
        setError(null);
        setPantalla(r.datos);
        setC(r.datos.convocatoria);
        setGuardada(r.datos.convocatoria);
        setPersistida(r.datos.guardada);
        setPng(null);
      } catch {
        if (turno === generacion.current) setError("No se pudo cargar la convocatoria.");
      } finally {
        if (turno === generacion.current) setOcupada(false);
      }
    },
    [categoria],
  );
  const invalidarCarga = useCallback(() => {
    ++generacion.current;
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void cargar(partidoInicial ?? null), 0);
    return () => {
      window.clearTimeout(timer);
      invalidarCarga();
    };
  }, [cargar, partidoInicial, invalidarCarga]);
  const url = png?.url;
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );

  const partido = pantalla?.partidos.find((p) => p.id === pantalla.partidoId);
  const bloqueada = Boolean(partido?.finalizado);
  const invalid = errorDeConvocatoria(c);
  function cambiar(patch: Partial<Convocatoria>) {
    setPng(null);
    setC((antes) => ({ ...antes, ...patch }));
  }
  async function guardar() {
    if (!partido) return false;
    const turno = generacion.current;
    const r = await guardarConvocatoria(partido.id, c);
    if (turno !== generacion.current) return false;
    if (!r.ok) {
      showToast(r.error, "error");
      return false;
    }
    setGuardada(c);
    setPersistida(true);
    return true;
  }
  async function ejecutar(accion: () => Promise<void>) {
    const turno = generacion.current;
    setOcupada(true);
    try {
      await accion();
    } catch {
      if (turno === generacion.current)
        showToast("No se pudo completar la operación. Vuelve a intentarlo.", "error");
    } finally {
      if (turno === generacion.current) setOcupada(false);
    }
  }
  async function generar() {
    if (!partido || !pantalla || invalid) return;
    const turno = generacion.current;
    if (!bloqueada && (!persistida || sucio) && !(await guardar())) return;
    const peticion = peticionDeConvocatoria(categoria, partido, pantalla.jugadores, c, {
      institucionales: (recursos.xuntaIsLeft
        ? [recursos.xunta, recursos.rfgf]
        : [recursos.rfgf, recursos.xunta]
      ).filter(Boolean),
      patrocinadores: recursos.sponsors,
      colorRival: aHex(COLOR_RIVAL_RESERVA),
    });
    const respuesta = await fetch("/api/carteles/png", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(peticion),
    });
    if (!respuesta.ok) throw new Error(String(respuesta.status));
    const blob = await respuesta.blob();
    if (turno !== generacion.current) return;
    const fichero = new File(
      [blob],
      `convocatoria-${partido.fecha?.slice(0, 10) || "partido"}.png`,
      { type: "image/png" },
    );
    setPng({ url: URL.createObjectURL(blob), fichero });
  }
  function descargar() {
    if (!png) return;
    const a = document.createElement("a");
    a.href = png.url;
    a.download = png.fichero.name;
    a.click();
  }
  async function compartir() {
    if (!png) return;
    const datos = { files: [png.fichero] };
    if (!navigator.canShare?.(datos)) {
      descargar();
      return;
    }
    try {
      await navigator.share(datos);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) descargar();
    }
  }
  if (error)
    return (
      <ErrorState
        title="No se pudo cargar la convocatoria"
        detail={error}
        action={<Button onClick={() => void cargar(null)}>Reintentar</Button>}
      />
    );
  if (!pantalla) return <LoadingState title="Cargando convocatoria…" />;
  if (!partido)
    return (
      <EmptyState
        title={`${categoria} no tiene partidos por jugar.`}
        detail="Aparecerán al añadirlos al Calendario."
      />
    );
  const texto = textoWhatsApp(partido, pantalla.jugadores, c);
  const noGuardar = ocupada || bloqueada || pantalla.migracionPendiente || Boolean(invalid);

  return (
    <div className={s.panel}>
      <header className={s.partido}>
        <Select
          label="Partido"
          value={partido.id}
          disabled={ocupada}
          onChange={(e) => {
            if (sucio && !window.confirm("Hay cambios sin guardar. ¿Descartarlos?")) return;
            void cargar(e.target.value);
          }}
        >
          {pantalla.partidos.map((p) => (
            <option key={p.id} value={p.id}>
              J{p.jornada} · {p.rival.nombre}
              {p.finalizado ? " (jugado)" : ""}
            </option>
          ))}
        </Select>
        <h3>
          {partido.santisoLocal
            ? `${partido.santiso.nombre} – ${partido.rival.nombre}`
            : `${partido.rival.nombre} – ${partido.santiso.nombre}`}
        </h3>
        <p>
          {[fechaCorta(partido.fecha?.slice(0, 10) ?? ""), partido.fecha?.slice(11), partido.campo]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </header>
      {pantalla.migracionPendiente && (
        <p role="status">Migración de convocatorias pendiente de aplicar.</p>
      )}
      {bloqueada && <p role="status">Partido ya jugado: convocatoria de solo lectura.</p>}
      {png ? (
        <section className={s.png} aria-label="Cartel generado">
          <img src={png.url} alt="Cartel de convocatoria" />
          <div className={s.acciones}>
            <Button onClick={() => void compartir()}>Compartir</Button>
            <Button variant="secondary" onClick={descargar}>
              Descargar
            </Button>
            <Button variant="secondary" onClick={() => setPng(null)}>
              Volver
            </Button>
          </div>
        </section>
      ) : (
        <>
          <p className={s.contador} role="status">
            {c.jugadores.length} convocados / {pantalla.jugadores.length}
          </p>
          <ul className={s.jugadores} aria-label={`Plantilla ${categoria}`}>
            {pantalla.jugadores.map((j) => (
              <li key={j.id}>
                <button
                  type="button"
                  aria-pressed={c.jugadores.includes(j.id)}
                  aria-label={`Convocar: ${nombreDeCartel(j)}`}
                  disabled={ocupada || bloqueada}
                  onClick={() =>
                    cambiar({
                      jugadores: c.jugadores.includes(j.id)
                        ? c.jugadores.filter((id) => id !== j.id)
                        : [...c.jugadores, j.id],
                    })
                  }
                >
                  <b>{j.dorsal ?? "—"}</b>
                  <span>{nombreDeCartel(j)}</span>
                </button>
              </li>
            ))}
          </ul>
          {invalid && <p role="status">{invalid}</p>}
          <details className={s.detalles}>
            <summary>Datos de la quedada</summary>
            <fieldset disabled={ocupada || bloqueada} className={s.campos}>
              <Field
                label="Hora de quedada"
                type="time"
                value={c.horaQuedada}
                onChange={(e) => cambiar({ horaQuedada: e.target.value })}
              />
              <Field
                label="Lugar de quedada"
                maxLength={200}
                value={c.lugarQuedada}
                onChange={(e) => cambiar({ lugarQuedada: e.target.value })}
              />
              <Field
                label="Equipación"
                maxLength={120}
                value={c.equipacion}
                onChange={(e) => cambiar({ equipacion: e.target.value })}
              />
              <Textarea
                label="Nota"
                rows={2}
                maxLength={400}
                value={c.nota}
                onChange={(e) => cambiar({ nota: e.target.value })}
              />
            </fieldset>
          </details>
          <details className={s.detalles}>
            <summary>Texto para WhatsApp</summary>
            <Textarea label="Convocatoria para WhatsApp" value={texto} readOnly rows={6} />
          </details>
          <div className={s.acciones}>
            <Button
              variant="secondary"
              disabled={ocupada || Boolean(invalid)}
              onClick={() =>
                void ejecutar(async () => {
                  await navigator.clipboard.writeText(texto);
                  showToast("Texto copiado");
                })
              }
            >
              Copiar texto
            </Button>
            <Button
              variant="secondary"
              disabled={noGuardar}
              onClick={() =>
                void ejecutar(async () => {
                  if ((!persistida || sucio) && !(await guardar())) return;
                  router.push(
                    `/admin/alineacion?categoria=${encodeURIComponent(categoria)}&partido=${partido.id}`,
                  );
                })
              }
            >
              Pasar a alineación
            </Button>
          </div>
          <div className={s.barra} aria-label="Acciones de convocatoria">
            <Button
              variant="secondary"
              disabled={noGuardar || (persistida && !sucio)}
              onClick={() =>
                void ejecutar(async () => {
                  if (await guardar()) showToast("Convocatoria guardada");
                })
              }
            >
              Guardar
            </Button>
            <Button
              pending={ocupada}
              pendingLabel="Preparando…"
              disabled={ocupada || Boolean(invalid) || pantalla.migracionPendiente}
              onClick={() => void ejecutar(generar)}
            >
              Ver cartel
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
