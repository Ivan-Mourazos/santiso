"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/foundation/Button";
import { Dialog } from "@/components/ui/foundation/Dialog";
import type { EquipoCatalogo } from "@/lib/equipos/modelo";
import { borrarEquipo, quitarEquipoDeCompeticion } from "@/lib/server/acciones/equipos";
import styles from "./Equipos.module.css";

export default function EliminarEquipo({
  equipo,
  competicion,
  modoInicial,
  onCerrar,
  onGuardado,
  onReleer,
}: {
  equipo: EquipoCatalogo;
  competicion?: { id: string; nombre: string };
  modoInicial: "quitar" | "eliminar";
  onCerrar: () => void;
  onGuardado: (mensaje: string) => void;
  onReleer: () => Promise<void>;
}) {
  const [modo, setModo] = useState(modoInicial);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState(false);
  const operacion = useRef(false);
  const inscrito = Boolean(
    competicion && equipo.competiciones.some((c) => c.id === competicion.id),
  );
  const protegido = modo === "eliminar" && equipo.numeroPartidos > 0;
  function cerrar() {
    if (!operacion.current) onCerrar();
  }
  async function confirmar() {
    if (operacion.current || protegido || (modo === "quitar" && (!competicion || !inscrito)))
      return;
    operacion.current = true;
    setPendiente(true);
    setError(null);
    try {
      const resultado =
        modo === "quitar" && competicion
          ? await quitarEquipoDeCompeticion(competicion.id, equipo.id)
          : await borrarEquipo(equipo.id);
      if (!resultado.ok) {
        setError(resultado.error);
        await onReleer();
        return;
      }
      onGuardado(
        modo === "quitar"
          ? "Equipo quitado de la competición. Su historial se conserva."
          : "Equipo eliminado de la biblioteca.",
      );
    } catch {
      setError("No se pudo completar la operación. Vuelve a intentarlo.");
    } finally {
      operacion.current = false;
      setPendiente(false);
    }
  }
  return (
    <Dialog
      open
      onClose={cerrar}
      pending={pendiente}
      title={
        protegido
          ? "Equipo con partidos"
          : modo === "quitar"
            ? "Quitar de competición"
            : "Eliminar de biblioteca"
      }
      footer={
        <>
          <Button variant="secondary" onClick={cerrar} disabled={pendiente}>
            Cancelar
          </Button>
          {protegido ? (
            inscrito && (
              <Button
                onClick={() => {
                  setModo("quitar");
                  setError(null);
                }}
                disabled={pendiente}
              >
                Quitar de esta competición
              </Button>
            )
          ) : (
            <Button
              variant="danger"
              pending={pendiente}
              disabled={modo === "quitar" && !inscrito}
              pendingLabel="Procesando…"
              onClick={() => void confirmar()}
            >
              {modo === "quitar" ? "Confirmar quitar" : "Confirmar eliminar"}
            </Button>
          )}
        </>
      }
    >
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {protegido ? (
        <>
          <p>
            {equipo.nombre} tiene {equipo.numeroPartidos}{" "}
            {equipo.numeroPartidos === 1 ? "partido" : "partidos"}. No se puede eliminar de la
            biblioteca porque perdería su referencia en el historial.
          </p>
          <p>
            {inscrito
              ? `Puedes quitarlo de ${competicion?.nombre} sin borrar sus partidos.`
              : "Selecciona una competición en la que esté inscrito para quitarlo de ella."}
          </p>
        </>
      ) : modo === "quitar" ? (
        <p>
          ¿Quitar a {equipo.nombre} de {competicion?.nombre}? El equipo y sus partidos se conservan;
          sus otras competiciones no cambian.
        </p>
      ) : (
        <p>
          ¿Eliminar a {equipo.nombre} de la biblioteca? Se quitará de todas sus competiciones. Esta
          acción no se puede deshacer.
        </p>
      )}
    </Dialog>
  );
}
