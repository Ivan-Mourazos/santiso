"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CartelesDelPaso } from "@/components/admin/cartel/CartelesDelPaso";
import { useCartelAssets } from "@/components/admin/cartel/useCartelAssets";
import { useStudio, useUnsavedChanges } from "@/components/studio/StudioContext";
import { Button } from "@/components/ui/foundation/Button";
import { Field, Select, Textarea } from "@/components/ui/foundation/Fields";
import { AvisosPartido, avisoDe, MarcaAviso } from "@/components/admin/liga/AvisosPartido";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/foundation/States";
import { nombreDeCartel } from "@/lib/alineacion/modelo";
import { aHex, COLOR_RIVAL_RESERVA } from "@/lib/cartel2/color";
import { fechaCorta } from "@/lib/cartel2/modelo";
import type { CartelGuardado } from "@/lib/cartel2/pasos";
import {
  convocatoriaInicial,
  errorDeConvocatoria,
  peticionDeConvocatoria,
  textoWhatsApp,
  type Convocatoria,
  type PantallaConvocatoria,
} from "@/lib/convocatoria/modelo";
import { cargarCartelesPartido } from "@/lib/server/acciones/carteles-guardados";
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
  const [carteles, setCarteles] = useState<CartelGuardado[] | null>(null);
  const generacion = useRef(0);
  const sucio = JSON.stringify(c) !== JSON.stringify(guardada);
  useUnsavedChanges(sucio);
  const { showConfirm } = useStudio();
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
        setCarteles(null);
        if (r.datos.partidoId) {
          const guardados = await cargarCartelesPartido([r.datos.partidoId]);
          if (turno !== generacion.current) return;
          setCarteles(guardados.ok ? (guardados.datos[r.datos.partidoId]?.convocatoria ?? []) : []);
        }
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

  const partido = pantalla?.partidos.find((p) => p.id === pantalla.partidoId);
  const bloqueada = Boolean(partido?.finalizado);
  const invalid = errorDeConvocatoria(c);
  function cambiar(patch: Partial<Convocatoria>) {
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
  /**
   * La petición del cartel con lo que hay en pantalla. Antes se guarda la convocatoria: el
   * cartel guardado tiene que corresponder a lo guardado, o el aviso de «desactualizado» mentiría.
   */
  async function prepararCartel() {
    if (!partido || !pantalla || invalid) return null;
    if (!bloqueada && (!persistida || sucio) && !(await guardar())) return null;
    return [
      peticionDeConvocatoria(categoria, partido, pantalla.jugadores, c, {
        institucionales: (recursos.xuntaIsLeft
          ? [recursos.xunta, recursos.rfgf]
          : [recursos.rfgf, recursos.xunta]
        ).filter(Boolean),
        patrocinadores: recursos.sponsors,
        colorRival: aHex(COLOR_RIVAL_RESERVA),
      }),
    ];
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
            const id = e.target.value;
            if (sucio) showConfirm("Hay cambios sin guardar. ¿Descartarlos?", () => cargar(id));
            else void cargar(id);
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
      {bloqueada && (
        <p role="status">
          {persistida || c.jugadores.length > 0
            ? "Partido ya jugado: convocatoria de solo lectura."
            : "Partido ya jugado: no se guardó convocatoria."}
        </p>
      )}
      <AvisosPartido avisos={pantalla.avisos} />
      <p className={s.contador} role="status">
        {c.jugadores.length} convocados / {pantalla.jugadores.length}
      </p>
      <ul className={s.jugadores} aria-label={`Plantilla ${categoria}`}>
        {pantalla.jugadores.map((j) => {
          const aviso = avisoDe(pantalla.avisos, j.id);
          return (
            <li key={j.id}>
              <button
                type="button"
                aria-pressed={c.jugadores.includes(j.id)}
                aria-label={`Convocar: ${nombreDeCartel(j)}${aviso ? `, ${aviso.situacion}` : ""}`}
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
                <span>
                  {nombreDeCartel(j)}
                  <MarcaAviso aviso={aviso} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {invalid && <p role="status">{invalid}</p>}
      <details className={s.detalles} open>
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
          {!persistida || sucio ? "Guardar y pasar al once inicial" : "Pasar al once inicial"}
        </Button>
      </div>
      {carteles === null ? (
        <LoadingState title="Cargando carteles guardados…" />
      ) : (
        <CartelesDelPaso
          key={partido.id}
          partidoId={partido.id}
          paso="convocatoria"
          guardados={carteles}
          preparar={prepararCartel}
          motivo={
            invalid ?? (pantalla.migracionPendiente ? "Falta aplicar la migración." : null)
          }
          showToast={showToast}
        />
      )}
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
      </div>
    </div>
  );
}
