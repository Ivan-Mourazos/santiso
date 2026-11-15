"use client";

import { useEffect, useState } from "react";
import { aHex, COLOR_RIVAL_RESERVA } from "@/lib/cartel2/color";
import { peticionDeFormulario } from "@/lib/cartel2/formulario";
import { recursosDeCartel } from "@/lib/cartel2/recursos";
import type { Colocacion } from "@/lib/cartel2/tactica";
import { claveJugador as clave, onceDespues } from "@/lib/cartel2/despues";
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
const conNombre = (lista: Player[]) => lista.filter((j) => j.nome.trim());

/**
 * Lo que necesita la pantalla «Después del partido»: los carteles guardados del Resultado y de
 * O Noso 11, el once colocado en el campo (el guardado después del partido; si no, el de antes,
 * ajustado a los titulares del acta) y las dos peticiones del carrusel.
 */
export function useDespues({
  form,
  plantilla,
  jugadoresPartidoId,
  equipos,
  recursos,
  activo,
}: {
  /** Solo en la pantalla «Después del partido»: en el resto no se carga nada. */
  activo: boolean;
  form: FormState;
  plantilla: Player[];
  jugadoresPartidoId: string | null;
  equipos: CartelTeam[];
  recursos: AssetUrls;
}) {
  const partidoId = (activo && form.partido_id) || null;
  const [cargado, setCargado] = useState<{
    partidoId: string;
    guardados: GuardadosDespues;
    final: Colocacion | null;
    previa: Colocacion | null;
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
        final: final.ok ? final.datos : null,
        previa: previa.ok ? previa.datos : null,
      });
    });
    return () => {
      vigente = false;
    };
  }, [partidoId]);

  const titularesActa = conNombre(form.titulares);
  const suplentesActa = conNombre(form.suplentes);
  const sinActa = titularesActa.length + suplentesActa.length === 0;
  const disponibles = sinActa ? plantilla : [...titularesActa, ...suplentesActa];
  const datos = cargado?.partidoId === partidoId ? cargado : null;
  const final = elegida?.partidoId === partidoId ? elegida.colocacion : (datos?.final ?? null);
  const { colocacion, titulares, suplentes } = onceDespues(
    titularesActa,
    sinActa ? plantilla : suplentesActa,
    final,
    datos?.previa ?? null,
  );
  // Sin acta no se conocen suplentes: la plantilla completa solo sirve para elegir el once.
  const formulario = { ...form, titulares, suplentes: sinActa ? [] : suplentes };
  const jugadores: JugadorTactico[] = disponibles.map((j) => ({
    id: clave(j),
    nombre: j.nome.trim(),
    dorsal: j.dorsal.trim() ? Number.parseInt(j.dorsal, 10) || null : null,
    posicion: j.posicion ?? null,
  }));

  function cambiarColocacion(c: Colocacion) {
    if (partidoId) setElegida({ partidoId, colocacion: c });
  }

  const colores = useColoresEscudos(form);
  const opciones = {
    color: (url: string | null) => (url && colores[url]) || aHex(COLOR_RIVAL_RESERVA),
    composicion: "diagonal" as const,
    foto: null,
  };

  const r = recursosDeCartel(equipos, recursos);
  const peticiones = {
    resultado: peticionDeFormulario("cronoloxia", formulario, r, opciones),
    noso11: peticionDeFormulario("noso11", formulario, r, { ...opciones, colocacion }),
  };
  const firma = JSON.stringify(peticiones);
  const listo =
    jugadoresPartidoId === partidoId &&
    datos !== null &&
    [form.rivalEscudoUrl, ...form.matches.map((m) => m.rivalEscudoUrl)]
      .filter(Boolean)
      .every((url) => url in colores);

  async function preparar() {
    if (!listo) return null;
    const [resultado, noso11] = await Promise.all([
      exportable(peticiones.resultado),
      exportable(peticiones.noso11),
    ]);
    return { resultado, noso11 };
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
    guardados: listo ? datos.guardados : null,
    formulario,
    firma,
    sinActa,
    colocacion,
    jugadores,
    cambiarColocacion,
    preparar,
    guardarFinal,
    motivo: !partidoId
      ? "Elige el partido."
      : !listo
        ? "Cargando jugadores y colocación…"
        : titulares.length === 0
          ? "Elige al menos un jugador en el campo para O Noso 11."
          : null,
  };
}
