/**
 * components/admin/cartel/FormCronoloxia.tsx
 * Form panel for the "Cronoloxía" template.
 */

import React from "react";
import { Field } from "@/components/ui/foundation/Fields";
import type { CronEvent } from "@/lib/cartel/types";
import { ConPartidoElegido, LadoSantiso } from "./Common";
import type { SelectorMatch } from "./Common";
import { RivalSelector } from "./FormPartido";
import { EventosPartido } from "./EventosPartido";
import styles from "./Formularios.module.css";
import type { FormState } from "./types";

interface CartelPlayerOption {
  id: string;
  nombre?: string | null;
  apodo?: string | null;
  dorsal?: number | string | null;
  categoria?: string | null;
}

interface Props {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  equipos: { id: string; nombre: string; escudo_url: string }[];
  jugadores: CartelPlayerOption[];
  handleRivalSelect: (nombre: string) => void;
  handleRivalFile: (file: File) => void;
  addEvent: () => void;
  updateEvent: (i: number, patch: Partial<CronEvent>) => void;
  removeEvent: (id: string) => void;
  dbMatches: SelectorMatch[];
  loadMatchFromDb: (m: SelectorMatch) => void;
  /** «Después del partido» pone los eventos en su propio desplegable. */
  conEventos?: boolean;
}

export const FormCronoloxia: React.FC<Props & { tipo: string }> = ({
  form,
  set,
  equipos,
  jugadores,
  handleRivalSelect,
  handleRivalFile,
  addEvent,
  updateEvent,
  removeEvent,
  dbMatches,
  loadMatchFromDb,
  conEventos = true,
}) => {
  const jugadoresCategoria = jugadores.filter((j) => j.categoria === form.categoria);

  return (
    <>
      <ConPartidoElegido
        partidoId={form.partido_id}
        dbMatches={dbMatches}
        categoria={form.categoria}
        onSelect={loadMatchFromDb}
        onCategoria={(c) => set("categoria", c)}
      >
        <div className={styles.pareja}>
          <Field
            label="Fecha"
            type="date"
            value={form.fecha}
            onChange={(e) => set("fecha", e.target.value)}
          />
          <Field
            label="Estadio"
            placeholder="Estadio Municipal de Santiso"
            value={form.estadio}
            onChange={(e) => set("estadio", e.target.value)}
          />
        </div>

        <RivalSelector
          rivalNombre={form.rivalNombre}
          equipos={equipos}
          categoria={form.categoria}
          handleRivalSelect={handleRivalSelect}
          handleRivalFile={handleRivalFile}
        />

        <div className={styles.pareja}>
          <Field
            label="Goles del Santiso"
            inputMode="numeric"
            pattern="[0-9]*"
            value={form.golesLocal}
            onChange={(e) => set("golesLocal", e.target.value)}
          />
          <Field
            label="Goles del rival"
            inputMode="numeric"
            pattern="[0-9]*"
            value={form.golesRival}
            onChange={(e) => set("golesRival", e.target.value)}
          />
        </div>
        <LadoSantiso
          partidoId={form.partido_id}
          value={form.santisoSide}
          onChange={(v) => set("santisoSide", v)}
        />
      </ConPartidoElegido>

      {conEventos && (
        <EventosPartido
          eventos={form.events}
          jugadores={jugadoresCategoria}
          addEvent={addEvent}
          updateEvent={updateEvent}
          removeEvent={removeEvent}
        />
      )}
    </>
  );
};
