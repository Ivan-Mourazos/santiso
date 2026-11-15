"use client";

import { useEffect, useMemo, useState } from "react";
import { aHex, COLOR_RIVAL_RESERVA } from "@/lib/cartel2/color";
import { peticionDeFormulario } from "@/lib/cartel2/formulario";
import { recursosDeCartel } from "@/lib/cartel2/recursos";
import { completar, type Colocacion } from "@/lib/cartel2/tactica";
import type { Player } from "@/lib/cartel/types";
import { sinConexion } from "@/lib/resultado";
import { cargarCartelesPartido } from "@/lib/server/acciones/carteles-guardados";
import { cargarColocacion, guardarColocacion } from "@/lib/server/acciones/colocacion";
import type { JugadorTactico } from "./EditorTactico";
import type { GuardadosDespues } from "./PaqueteDespues";
import { exportable, useColoresEscudos } from "./PilotoCartel";
import type { AssetUrls, FormState } from "./types";
import type { CartelTeam } from "./useCartelForm";

/** Cada jugador del formulario por su jugador de la base, o por su fila si se escribió a mano. */
const clave = (j: Player) => j.jugadorId ?? j.id;
const conNombre = (lista: Player[]) => lista.filter((j) => j.nome.trim());
const SISTEMA_INICIAL = "4-4-2";

/**
 * Lo que necesita la pantalla «Después del partido»: los carteles guardados del Resultado y de
 * O Noso 11, el once colocado en el campo (el guardado después del partido; si no, el de antes,
 * ajustado a los titulares del acta) y las dos peticiones del carrusel.
 */
export function useDespues({
  form,
  set,
  equipos,
  recursos,
  activo,
}: {
  /** Solo en la pantalla «Después del partido»: en el resto no se carga nada. */
  activo: boolean;
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  equipos: CartelTeam[];
  recursos: AssetUrls;
}) {
  const partidoId = (activo && form.partido_id) || null;
  const [cargado, setCargado] = useState<{
    partidoId: string;
    guardados: GuardadosDespues;
    colocacion: Colocacion | null;
  } | null>(null);
  const [elegida, setElegida] = useState<{ partidoId: string; colocacion: Colocacion } | null>(
    null,
  );

  useEffect(() => {
    if (!partidoId) return;
    let vigente = true;
    void Promise.all([
      cargarCartelesPartido([partidoId]).catch(sinConexion),
      cargarColocacion(partidoId, "final").catch(sinConexion),
      cargarColocacion(partidoId, "previa").catch(sinConexion),
    ]).then(([carteles, final, previa]) => {
      if (!vigente) return;
      const deEste = carteles.ok ? (carteles.datos[partidoId] ?? {}) : {};
      setCargado({
        partidoId,
        guardados: { resultado: deEste.resultado ?? [], noso11: deEste.noso11 ?? [] },
        colocacion: (final.ok && final.datos) || (previa.ok && previa.datos) || null,
      });
    });
    return () => {
      vigente = false;
    };
  }, [partidoId]);

  const titulares = conNombre(form.titulares);
  const suplentes = conNombre(form.suplentes);
  const base =
    elegida?.partidoId === partidoId
      ? elegida.colocacion
      : cargado?.partidoId === partidoId
        ? cargado.colocacion
        : null;
  const sistema = base?.sistema ?? SISTEMA_INICIAL;
  const claveTitulares = titulares.map((j) => `${clave(j)}:${j.posicion ?? ""}`).join("|");
  const colocacion: Colocacion = useMemo(
    () => ({
      sistema,
      huecos: completar(
        sistema,
        base?.huecos ?? [],
        titulares.map((j) => ({ id: clave(j), posicion: j.posicion ?? null })),
      ),
    }),
    // `claveTitulares` resume a los titulares y sus posiciones.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sistema, base, claveTitulares],
  );

  const jugadores: JugadorTactico[] = [...titulares, ...suplentes].map((j) => ({
    id: clave(j),
    nombre: j.nome.trim(),
    dorsal: j.dorsal.trim() ? Number.parseInt(j.dorsal, 10) || null : null,
    posicion: j.posicion ?? null,
  }));

  /** Tocar el campo: quien entra pasa a titular; quien sale, el primero del banco. */
  function cambiarColocacion(c: Colocacion) {
    if (!partidoId) return;
    setElegida({ partidoId, colocacion: c });
    const todos = new Map([...titulares, ...suplentes].map((j) => [clave(j), j]));
    const enCampo = c.huecos.filter((id): id is string => id !== null);
    const nuevosTitulares = enCampo.flatMap((id) => todos.get(id) ?? []);
    const salen = titulares.filter((j) => !enCampo.includes(clave(j)));
    set("titulares", nuevosTitulares);
    set("suplentes", [...salen, ...suplentes.filter((j) => !enCampo.includes(clave(j)))]);
  }

  const colores = useColoresEscudos(form);
  const opciones = {
    color: (url: string | null) => (url && colores[url]) || aHex(COLOR_RIVAL_RESERVA),
    composicion: "diagonal" as const,
    foto: null,
  };

  async function preparar() {
    const r = recursosDeCartel(equipos, recursos);
    return {
      resultado: await exportable(peticionDeFormulario("cronoloxia", form, r, opciones)),
      noso11: await exportable(peticionDeFormulario("noso11", form, r, { ...opciones, colocacion })),
    };
  }

  /** Guarda la colocación de O Noso 11 (solo los jugadores de la base: los escritos a mano no). */
  async function guardarFinal(): Promise<string | null> {
    if (!partidoId) return "Elige el partido.";
    const deLaBase = new Set(titulares.flatMap((j) => (j.jugadorId ? [j.jugadorId] : [])));
    const r = await guardarColocacion(partidoId, "final", {
      sistema: colocacion.sistema,
      huecos: colocacion.huecos.map((id) => (id && deLaBase.has(id) ? id : null)),
    });
    return r.ok ? null : r.error;
  }

  return {
    partidoId,
    guardados: cargado?.partidoId === partidoId ? cargado.guardados : null,
    colocacion,
    jugadores,
    cambiarColocacion,
    preparar,
    guardarFinal,
    motivo: !partidoId
      ? "Elige el partido."
      : titulares.length === 0
        ? "Falta el once: completa el acta del partido o su alineación."
        : null,
  };
}
