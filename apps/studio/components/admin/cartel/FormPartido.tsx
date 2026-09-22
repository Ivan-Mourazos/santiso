/**
 * components/admin/cartel/FormPartido.tsx
 * Form panel for the "Cartel de Partido" template.
 */

import React, { useState } from "react";
import { Button } from "@/components/ui/foundation/Button";
import { Field, Select } from "@/components/ui/foundation/Fields";
import { competitionsForCategory, type CompetenciaRow } from "@/lib/competition";
import { CategorySelector, type SelectorMatch } from "./Common";
import styles from "./Formularios.module.css";
import type { FormState } from "./types";

interface Props {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  equipos: { id: string; nombre: string; escudo_url: string }[];
  handleRivalSelect: (nombre: string) => void;
  handleRivalFile: (file: File) => void;
  dbMatches: SelectorMatch[];
  loadMatchFromDb: (m: SelectorMatch) => void;
  campos: { id: string; nombre: string; poblacion: string }[];
  /** Desde catálogo BD */
  competiciones: CompetenciaRow[];
}

export const RivalSelector = ({
  rivalNombre,
  rivalEscudoUrl,
  equipos,
  categoria,
  handleRivalSelect,
  handleRivalFile,
  onNameChange,
}: {
  rivalNombre: string;
  rivalEscudoUrl?: string;
  equipos: { id: string; nombre: string; escudo_url: string; categoria?: string }[];
  categoria: string;
  handleRivalSelect: (nombre: string) => void;
  handleRivalFile: (file: File) => void;
  onNameChange?: (name: string) => void;
}) => {
  const filtered =
    equipos?.filter((eq) => {
      const isSantiso = eq.nombre?.toLowerCase().includes("santiso");
      const matchesCat = !eq.categoria || eq.categoria === categoria;
      return !isSantiso && matchesCat;
    }) || [];

  return (
    <>
      <div className={styles.campo}>
        <Field
          label="Rival"
          list="equipos-rival-list"
          placeholder="Escribe el nombre del rival…"
          value={rivalNombre}
          onChange={(e) => {
            const val = e.target.value;
            if (onNameChange) {
              onNameChange(val);
            } else {
              handleRivalSelect(val);
            }
            const matchEq = filtered.find((eq) => eq.nombre.toLowerCase() === val.toLowerCase());
            if (matchEq) handleRivalSelect(matchEq.nombre);
          }}
        />
        <datalist id="equipos-rival-list">
          {filtered.map((eq) => (
            <option key={eq.id} value={eq.nombre} />
          ))}
        </datalist>
        {filtered.length > 0 && (
          <Select
            label="O elegir de la lista de equipos"
            value={filtered.some((e) => e.nombre === rivalNombre) ? rivalNombre : ""}
            onChange={(e) => handleRivalSelect(e.target.value)}
          >
            <option value="">Sin elegir</option>
            {filtered.map((eq) => (
              <option key={eq.id} value={eq.nombre}>
                {eq.nombre}
              </option>
            ))}
          </Select>
        )}
      </div>
      <div className={styles.campo}>
        <span className={styles.etiqueta}>Escudo del rival</span>
        <div className={styles.escudo}>
          <label className="file-input-label">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
            </svg>
            Subir escudo
            <input
              type="file"
              className="hidden-input"
              accept="image/*"
              onChange={(e) => {
                if (e.target.files?.[0]) handleRivalFile(e.target.files[0]);
              }}
            />
          </label>
          {rivalEscudoUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- media local servida por el route handler
            <img className={styles.escudoImagen} src={rivalEscudoUrl} alt="Escudo del rival" />
          )}
        </div>
      </div>
    </>
  );
};

/** Fecha del partido en milisegundos; `NaN` si no la tiene o no se entiende. */
const tiempoDe = (m: SelectorMatch) => (m.fecha ? new Date(m.fecha).getTime() : Number.NaN);

export const FormPartido: React.FC<Props & { tipo: string }> = ({
  form,
  set,
  equipos,
  handleRivalSelect,
  handleRivalFile,
  dbMatches,
  loadMatchFromDb,
  campos,
  competiciones,
  tipo,
}) => {
  const [autoFillMessage, setAutoFillMessage] = useState("");

  function handleLoadNextMatch() {
    setAutoFillMessage("");
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const nextMatch = dbMatches
      .filter((match) => {
        if (!match.fecha) return false;
        if (match.categoria !== form.categoria) return false;
        const mid = match.competicion_id || match.jornada?.competicion_id;
        if (!form.competicion_id || mid !== form.competicion_id) return false;
        if (
          ["finalizado", "cancelado", "aplazado"].includes(
            (match.estado || "").toLowerCase().trim(),
          )
        )
          return false;

        const localName = match.equipo_local?.nombre?.toLowerCase() || "";
        const visitorName = match.equipo_visitante?.nombre?.toLowerCase() || "";
        if (!localName.includes("santiso") && !visitorName.includes("santiso")) return false;

        const cuando = tiempoDe(match);
        if (Number.isNaN(cuando)) return false;
        return cuando >= today.getTime();
      })
      .sort((a, b) => tiempoDe(a) - tiempoDe(b))[0];

    if (nextMatch) {
      loadMatchFromDb(nextMatch);
      setAutoFillMessage("Partido cargado.");
      return;
    }

    setAutoFillMessage("No encontré próximo partido pendiente para esa categoría y liga.");
  }

  return (
    <>
      {tipo === "partido" && (
        <div className={styles.desdeLiga}>
          <h4 className={styles.seccion}>Autocompletar desde la liga</h4>
          <Button onClick={handleLoadNextMatch}>Cargar próximo partido</Button>
          {autoFillMessage && (
            <p role="status" className={styles.aviso}>
              {autoFillMessage}
            </p>
          )}
        </div>
      )}

      <CategorySelector value={form.categoria} onChange={(v: string) => set("categoria", v)} />

      <div className={styles.campo}>
        <Field
          label="Competición"
          placeholder="Escribe la competición (Liga da Costa, Amigable…)"
          value={form.competicion}
          onChange={(e) => set("competicion", e.target.value)}
        />
        {competitionsForCategory(competiciones, form.categoria).length > 0 && (
          <Select
            label="O elegir del catálogo"
            value={form.competicion_id}
            onChange={(e) => {
              const selId = e.target.value;
              set("competicion_id", selId);
              const found = competiciones.find((c) => c.id === selId);
              if (found) set("competicion", found.nombre);
            }}
          >
            <option value="">Sin elegir</option>
            {competitionsForCategory(competiciones, form.categoria).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </Select>
        )}
      </div>

      <div className={styles.pareja}>
        <Field
          label="Fecha"
          type="date"
          value={form.fecha}
          onChange={(e) => set("fecha", e.target.value)}
        />
        <Field
          label="Hora"
          type="time"
          value={form.hora}
          onChange={(e) => set("hora", e.target.value)}
        />
      </div>

      <div className={styles.pareja}>
        <Field
          label="Nº de xornada"
          inputMode="numeric"
          pattern="[0-9]*"
          value={form.jornada}
          onChange={(e) => set("jornada", e.target.value)}
        />
        <div>
          <Select
            label="Estadio o campo"
            value={campos?.find((c) => c.nombre === form.lugar)?.id || ""}
            onChange={(e) => {
              const selected = campos?.find((c) => c.id === e.target.value);
              if (selected) set("lugar", selected.nombre);
            }}
          >
            <option value="">Sin elegir</option>
            {campos?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre} ({c.poblacion || "S/P"})
              </option>
            ))}
          </Select>
          <Field
            label="O escribirlo a mano"
            placeholder="Nombre del campo"
            value={form.lugar}
            onChange={(e) => set("lugar", e.target.value)}
          />
        </div>
      </div>

      <RivalSelector
        rivalNombre={form.rivalNombre}
        rivalEscudoUrl={form.rivalEscudoUrl}
        equipos={equipos}
        categoria={form.categoria}
        handleRivalSelect={handleRivalSelect}
        handleRivalFile={handleRivalFile}
        onNameChange={(name) => set("rivalNombre", name)}
      />
    </>
  );
};
