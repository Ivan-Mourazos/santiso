/**
 * components/admin/cartel/FormPartido.tsx
 * Form panel for the "Cartel de Partido" template.
 */

import React, { useState } from "react";
import { Field, Select } from "@/components/ui/foundation/Fields";
import { formatLiteralMatchDate } from "@/lib/match-date-time";
import { competitionsForCategory, type CompetenciaRow } from "@/lib/competition";
import { porJugarDeCategoria } from "@/lib/jornada/proximos";
import { CategorySelector, ConPartidoElegido, LadoSantiso, type SelectorMatch } from "./Common";
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

export const FormPartido: React.FC<Props & { tipo: string; categoriaInicial?: string | null }> = ({
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
  categoriaInicial,
}) => {
  // Un solo «hoy» por montaje: la lista no cambia mientras se mira.
  const [hoy] = useState(() => new Date());
  /** Los partidos del Santiso de la categoría que aún no se han jugado, del más cercano al más lejano. */
  const pendientes = porJugarDeCategoria(dbMatches, form.categoria, hoy);

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

  // Cartel de partido: el próximo ya viene cargado (o el del enlace) con su tarjeta arriba. Lo
  // demás queda plegado: otro partido, la categoría y los campos sueltos para retocar o para un
  // amistoso que no está en el calendario.
  return (
    <ConPartidoElegido
      partidoId={form.partido_id}
      dbMatches={dbMatches}
      categoria={form.categoria}
      onSelect={loadMatchFromDb}
      porJugar
      categoriaInicial={categoriaInicial}
    >
      <CategorySelector value={form.categoria} onChange={(v: string) => set("categoria", v)} />
      {pendientes.length > 0 && (
        <div className={styles.desdeLiga}>
          <Select
            label="Otro partido por jugar"
            value={pendientes.some((m) => m.id === form.partido_id) ? form.partido_id : ""}
            onChange={(e) => {
              const match = pendientes.find((m) => m.id === e.target.value);
              if (match) loadMatchFromDb(match);
            }}
          >
            <option value="">Elegir…</option>
            {pendientes.map((m) => (
              <option key={m.id} value={m.id}>
                {etiquetaDe(m)}
              </option>
            ))}
          </Select>
        </div>
      )}
      {campos_}
      <LadoSantiso
        partidoId={form.partido_id}
        value={form.santisoSide}
        onChange={(v) => set("santisoSide", v)}
      />
    </ConPartidoElegido>
  );
};
