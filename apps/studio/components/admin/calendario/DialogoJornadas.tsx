"use client";

import { useRef, useState } from "react";
import { useUnsavedChanges } from "@/components/studio/StudioContext";
import { Button } from "@/components/ui/foundation/Button";
import { Dialog } from "@/components/ui/foundation/Dialog";
import { Field } from "@/components/ui/foundation/Fields";
import { crearJornada, crearJornadasEnLote } from "@/lib/server/acciones/calendario";
import styles from "./Calendario.module.css";

interface Props {
  competicionId: string;
  competicion: string;
  onCerrar: () => void;
  onCreadas: () => Promise<void>;
  showToast: (msg: string, type?: "success" | "error") => void;
}

const LOTE_POR_DEFECTO = "30";

/** Crear una jornada suelta, o todas las que falten hasta un número, de golpe. */
export default function DialogoJornadas({
  competicionId,
  competicion,
  onCerrar,
  onCreadas,
  showToast,
}: Props) {
  const [numero, setNumero] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fase, setFase] = useState("");
  const [hasta, setHasta] = useState(LOTE_POR_DEFECTO);
  const [pendiente, setPendiente] = useState(false);
  const enviando = useRef(false);
  const numeroRef = useRef<HTMLInputElement>(null);
  const sucio = Boolean(numero || fechaInicio || fase || hasta !== LOTE_POR_DEFECTO);
  useUnsavedChanges(sucio);

  async function enviar(tarea: () => Promise<void>) {
    if (enviando.current) return;
    enviando.current = true;
    setPendiente(true);
    try {
      await tarea();
    } catch {
      showToast("No se pudo crear. Comprueba la conexión.", "error");
    } finally {
      enviando.current = false;
      setPendiente(false);
    }
  }

  const crearUna = (e: React.FormEvent) => {
    e.preventDefault();
    void enviar(async () => {
      const resultado = await crearJornada({
        competicionId,
        numero,
        fechaInicio,
        nombreFase: fase,
      });
      if (!resultado.ok) return showToast(resultado.error, "error");
      setNumero("");
      setFechaInicio("");
      setFase("");
      showToast("Jornada creada");
      await onCreadas();
    });
  };

  const crearLote = (e: React.FormEvent) => {
    e.preventDefault();
    const cuantas = Number.parseInt(hasta, 10);
    if (!Number.isFinite(cuantas) || cuantas < 1) {
      return showToast("Indica hasta qué jornada crear", "error");
    }
    void enviar(async () => {
      // La acción calcula cuáles faltan de 1..n y devuelve cuántas creó.
      const resultado = await crearJornadasEnLote(competicionId, cuantas);
      if (!resultado.ok) return showToast(resultado.error, "error");
      showToast(
        resultado.datos === 0
          ? "Las jornadas ya estaban creadas"
          : `Generadas ${resultado.datos} jornadas faltantes`,
      );
      setHasta(LOTE_POR_DEFECTO);
      await onCreadas();
    });
  };

  function cerrar() {
    if (pendiente) return;
    if (sucio && !window.confirm("Hay cambios sin guardar. ¿Descartarlos?")) return;
    onCerrar();
  }

  return (
    <Dialog
      open
      onClose={cerrar}
      pending={pendiente}
      title="Jornadas"
      description={competicion}
      initialFocusRef={numeroRef}
    >
      <form onSubmit={crearUna}>
        <h4 className={styles.titulo}>Una jornada</h4>
        <div className={styles.fila}>
          <Field
            ref={numeroRef}
            label="Número de jornada"
            inputMode="numeric"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            disabled={pendiente}
          />
          <Field
            label="Fecha de inicio"
            type="date"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            disabled={pendiente}
          />
          <Field
            label="Fase"
            hint="Opcional: «Fase previa», «Cuartos»…"
            value={fase}
            onChange={(e) => setFase(e.target.value)}
            disabled={pendiente}
          />
          <Button type="submit" pending={pendiente} disabled={!numero.trim()}>
            Crear jornada
          </Button>
        </div>
      </form>

      <hr className={styles.separador} />

      <form onSubmit={crearLote}>
        <h4 className={styles.titulo}>Varias de golpe</h4>
        <div className={styles.fila}>
          <Field
            label="Crear hasta la jornada"
            hint="Solo se crean las que falten; las que ya existen no se tocan."
            type="number"
            min={1}
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            disabled={pendiente}
          />
          <Button type="submit" variant="secondary" pending={pendiente}>
            Crear las que falten
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
