/**
 * components/admin/cartel/FormPartido.tsx
 * Form panel for the "Cartel de Partido" template.
 */

import React, { useState } from "react";
import { Button } from "@/components/ui/foundation/Button";
import { Field, Select } from "@/components/ui/foundation/Fields";
import { formatLiteralMatchDate } from "@/lib/match-date-time";
import { competitionsForCategory, type CompetenciaRow } from "@/lib/competition";
import { CategorySelector, type SelectorMatch } from "./Common";
import styles from "./Formularios.module.css";
import { PlegableMovil } from "./PlegableMovil";
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
      </div>
      <PlegableMovil titulo="Escudo del rival">
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
      </PlegableMovil>
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
  /** El partido elegido en el desplegable; vacío si se cargó «el próximo» o nada. */
  const [elegido, setElegido] = useState("");

  function handleLoadNextMatch() {
    setAutoFillMessage("");
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const nextMatch = dbMatches
      .filter((match) => {
        if (!match.fecha) return false;
        if (match.categoria !== form.categoria) return false;
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

    setAutoFillMessage("No hay ningún partido pendiente para esa categoría.");
  }

  /** Los partidos del Santiso de la categoría que aún no se han jugado, del más cercano al más lejano. */
  const pendientes = dbMatches
    .filter((match) => {
      if (match.categoria !== form.categoria) return false;
      if (["finalizado", "cancelado"].includes((match.estado || "").toLowerCase().trim())) {
        return false;
      }
      const local = match.equipo_local?.nombre?.toLowerCase() || "";
      const visitante = match.equipo_visitante?.nombre?.toLowerCase() || "";
      return local.includes("santiso") || visitante.includes("santiso");
    })
    .sort((a, b) => (tiempoDe(a) || Infinity) - (tiempoDe(b) || Infinity));

  function etiquetaDe(match: SelectorMatch) {
    const enCasa = (match.equipo_local?.nombre?.toLowerCase() || "").includes("santiso");
    const rival = (enCasa ? match.equipo_visitante?.nombre : match.equipo_local?.nombre) || "Rival";
    const cuando = match.fecha ? formatLiteralMatchDate(match.fecha) : "sin fecha";
    return `J${match.jornada?.numero ?? "?"} · ${rival} (${enCasa ? "casa" : "fuera"}) · ${cuando}`;
  }

  const partido = tipo === "partido";

  const campos_ = (
    <>
      {/* Un solo campo: sugiere las del catálogo y admite cualquier otra (Amigable…). */}
      <div className={styles.campo}>
        <Field
          label="Competición"
          list="competiciones-cartel"
          placeholder="Elige o escribe (Liga da Costa, Amigable…)"
          value={form.competicion}
          onChange={(e) => {
            const nombre = e.target.value;
            set("competicion", nombre);
            const delCatalogo = competitionsForCategory(competiciones, form.categoria).find(
              (c) => c.nombre === nombre,
            );
            set("competicion_id", delCatalogo?.id ?? "");
          }}
        />
        <datalist id="competiciones-cartel">
          {competitionsForCategory(competiciones, form.categoria).map((c) => (
            <option key={c.id} value={c.nombre} />
          ))}
        </datalist>
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
          <Field
            label="Estadio o campo"
            list="campos-cartel"
            placeholder="Elige o escribe"
            value={form.lugar}
            onChange={(e) => {
              set("lugar", e.target.value);
              set("localidad", campos.find((c) => c.nombre === e.target.value)?.poblacion ?? "");
            }}
          />
          <datalist id="campos-cartel">
            {campos?.map((c) => (
              <option key={c.id} value={c.nombre}>
                {c.poblacion || ""}
              </option>
            ))}
          </datalist>
        </div>
      </div>

      {tipo === "partido" && (
        <Field
          label="Localidad"
          value={form.localidad ?? ""}
          onChange={(e) => set("localidad", e.target.value)}
        />
      )}
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

  // Las demás plantillas que reutilizan este formulario siguen con todos los campos a la vista.
  if (!partido) {
    return (
      <>
        <CategorySelector value={form.categoria} onChange={(v: string) => set("categoria", v)} />
        {campos_}
      </>
    );
  }

  // Cartel de partido: categoría y partido, y el cartel sale relleno. Los campos sueltos quedan
  // plegados para retocar o para un amistoso que no está en el calendario.
  return (
    <>
      <CategorySelector
        value={form.categoria}
        onChange={(v: string) => {
          set("categoria", v);
          setElegido("");
          setAutoFillMessage("");
        }}
      />
      <div className={styles.desdeLiga}>
        <Button
          onClick={() => {
            setElegido("");
            handleLoadNextMatch();
          }}
        >
          Cargar próximo partido
        </Button>
        {pendientes.length > 0 && (
          <Select
            label="O elige otro partido"
            value={elegido}
            onChange={(e) => {
              const match = pendientes.find((m) => m.id === e.target.value);
              setElegido(e.target.value);
              if (match) {
                loadMatchFromDb(match);
                setAutoFillMessage("Partido cargado.");
              }
            }}
          >
            <option value="">Elegir…</option>
            {pendientes.map((m) => (
              <option key={m.id} value={m.id}>
                {etiquetaDe(m)}
              </option>
            ))}
          </Select>
        )}
        {autoFillMessage && (
          <p role="status" className={styles.aviso}>
            {autoFillMessage}
          </p>
        )}
      </div>
      <details className={styles.manual}>
        <summary>
          <span>Editar datos a mano</span>
          <span aria-hidden="true">⌄</span>
        </summary>
        <div className={styles.manualContenido}>{campos_}</div>
      </details>
    </>
  );
};
