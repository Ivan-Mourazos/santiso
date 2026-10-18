/**
 * Piezas compartidas por los formularios del generador de carteles.
 *
 * Desde la 6E usan los componentes de la Fase 3A: así cada etiqueta queda asociada a su campo
 * —antes eran `<label>` sueltos, que el lector de pantalla no ligaba a nada— y los interruptores
 * dicen si están activados.
 */

import React, { useId } from "react";
import { Button } from "@/components/ui/foundation/Button";
import { Select } from "@/components/ui/foundation/Fields";
import { formatLiteralMatchDate } from "@/lib/match-date-time";
import styles from "./Formularios.module.css";
import { Flecha } from "./PlegableMovil";

export const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h4 className={styles.seccion}>{children}</h4>
);

export const CategorySelector: React.FC<{
  value: string;
  onChange: (v: string) => void;
}> = ({ value, onChange }) => (
  <div className={styles.campo}>
    <Select label="Categoría" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="Senior">Senior</option>
      <option value="Veteranos">Veteranos</option>
    </Select>
  </div>
);

export const Toggle: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({
  label,
  active,
  onClick,
}) => (
  <Button variant={active ? "primary" : "secondary"} aria-pressed={active} onClick={onClick}>
    {label}
  </Button>
);

/** Deslizador con su etiqueta asociada y los extremos dichos en texto. */
export const Deslizador: React.FC<{
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (v: number) => void;
  /** Texto de los extremos, para saber hacia dónde mueve. */
  extremos?: [string, string];
  /** Valor visible a la derecha, cuando el número dice algo por sí solo. */
  mostrarValor?: boolean;
}> = ({ label, min, max, step = 1, value, onChange, extremos, mostrarValor }) => {
  const id = useId();
  return (
    <div className={styles.deslizador}>
      <label htmlFor={id}>{label}</label>
      <div className={styles.deslizadorFila}>
        {extremos && <span>{extremos[0]}</span>}
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        {extremos && <span>{extremos[1]}</span>}
        {mostrarValor && <span className={styles.deslizadorValor}>{value}</span>}
      </div>
    </div>
  );
};

export interface SelectorMatch {
  id: string;
  categoria?: string | null;
  competicion_id?: string | null;
  competicion?: string | null;
  competiciones?: { id?: string; nombre?: string } | null;
  estado?: string | null;
  fecha?: string | null;
  lugar?: string | null;
  goles_local?: number | null;
  goles_visitante?: number | null;
  equipo_local?: { nombre?: string | null; escudo_url?: string | null } | null;
  equipo_visitante?: { nombre?: string | null; escudo_url?: string | null } | null;
  jornada?: {
    numero?: number | string | null;
    competicion?: string | null;
    competicion_id?: string | null;
    temporada_id?: string | null;
  } | null;
  campo?: { nombre?: string | null } | null;
}

export const MatchSelector: React.FC<{
  dbMatches: SelectorMatch[];
  onSelect: (m: SelectorMatch) => void;
  categoria: string;
  competicionId?: string;
  tipo: string;
  santisoOnly?: boolean;
}> = ({ dbMatches, onSelect, categoria, competicionId, tipo, santisoOnly }) => {
  const isSantisoMatch = (m: SelectorMatch) => {
    const local = m.equipo_local?.nombre?.toLowerCase() || "";
    const visitante = m.equipo_visitante?.nombre?.toLowerCase() || "";
    return local.includes("santiso") || visitante.includes("santiso");
  };
  const filtered =
    dbMatches?.filter((m) => {
      const isCat = m.categoria === categoria;
      if (!isCat) return false;
      if (competicionId) {
        const mid = m.competicion_id || m.jornada?.competicion_id;
        if (mid && mid !== competicionId) return false;
      }
      if (santisoOnly && !isSantisoMatch(m)) return false;

      // Filtrar por estado según el tipo de cartel
      if (tipo === "partido" || tipo === "proximos") {
        return m.estado === "programado";
      }
      if (tipo === "resumo" || tipo === "cronoloxia" || tipo === "noso11") {
        return m.estado === "finalizado";
      }
      return true;
    }) || [];

  if (filtered.length === 0) return null;

  return (
    <div className={styles.desdeLiga}>
      <Select
        label="Autocompletar desde la liga"
        defaultValue=""
        onChange={(e) => {
          const m = filtered.find((x) => x.id === e.target.value);
          if (m) onSelect(m);
        }}
      >
        <option value="">Seleccionar partido reciente o próximo…</option>
        {filtered.map((m) => (
          <option key={m.id} value={m.id}>
            J{m.jornada?.numero || "?"} - {m.equipo_local?.nombre} vs {m.equipo_visitante?.nombre} (
            {m.fecha ? formatLiteralMatchDate(m.fecha) : "Sin fecha"})
          </option>
        ))}
      </Select>
    </div>
  );
};

/** El cruce de un partido como se verá en el cartel: contexto, equipos con marcador y fecha. */
const CrucePartido: React.FC<{ m: SelectorMatch; categoria: string }> = ({ m, categoria }) => {
  const competicion = m.competiciones?.nombre || m.competicion || m.jornada?.competicion || "";
  const marcador =
    m.goles_local != null && m.goles_visitante != null
      ? `${m.goles_local}–${m.goles_visitante}`
      : "vs";
  const contexto = [categoria, competicion, m.jornada?.numero ? `Xornada ${m.jornada.numero}` : ""]
    .filter(Boolean)
    .join(" · ");
  return (
    <>
      <span className={styles.partidoElegidoContexto}>{contexto}</span>
      <strong className={styles.partidoElegidoCruce}>
        <span>{m.equipo_local?.nombre || "Local"}</span>
        <b>{marcador}</b>
        <span>{m.equipo_visitante?.nombre || "Visitante"}</span>
      </strong>
      {m.fecha && (
        <span className={styles.partidoElegidoContexto}>{formatLiteralMatchDate(m.fecha)}</span>
      )}
    </>
  );
};

/**
 * Cartel de después del partido: lo primero es el partido.
 * - Ya elegido (desde Inicio, Partidos o la lista): su tarjeta arriba y los campos plegados
 *   para cambiar de partido o retocar.
 * - Sin elegir (desde Carteles): la categoría y, debajo, sus jornadas jugadas para tocar una;
 *   los campos a mano quedan plegados para un amistoso.
 */
export const ConPartidoElegido: React.FC<{
  partidoId: string;
  dbMatches: SelectorMatch[];
  categoria: string;
  onSelect: (m: SelectorMatch) => void;
  children: React.ReactNode;
}> = ({ partidoId, dbMatches, categoria, onSelect, children }) => {
  const m = partidoId ? dbMatches.find((x) => x.id === partidoId) : undefined;
  if (m)
    return (
      <>
        <section className={styles.partidoElegido} aria-label="Partido del cartel">
          <CrucePartido m={m} categoria={categoria} />
        </section>
        <details className={styles.manual}>
          <summary>
            <span>Cambiar partido o editar datos</span>
            <Flecha />
          </summary>
          <div className={styles.manualContenido}>{children}</div>
        </details>
      </>
    );
  return (
    <ElegirPartido dbMatches={dbMatches} onSelect={onSelect}>
      {children}
    </ElegirPartido>
  );
};

const CATEGORIAS_CARTEL = ["Senior", "Veteranos"] as const;

/** Las dos categorías arriba y las jornadas que ya jugó la elegida, de la última a la primera. */
const ElegirPartido: React.FC<{
  dbMatches: SelectorMatch[];
  onSelect: (m: SelectorMatch) => void;
  children: React.ReactNode;
}> = ({ dbMatches, onSelect, children }) => {
  const jugados = dbMatches
    .filter(
      (x) =>
        x.estado === "finalizado" &&
        `${x.equipo_local?.nombre ?? ""} ${x.equipo_visitante?.nombre ?? ""}`
          .toLowerCase()
          .includes("santiso"),
    )
    .sort((a, b) => (b.fecha ?? "").localeCompare(a.fecha ?? ""));
  // Abre en la categoría del último partido jugado: la de los carteles que tocan ahora.
  const [elegida, setElegida] = React.useState<string | null>(null);
  const categoria = elegida ?? jugados[0]?.categoria ?? "Senior";
  const deLaCategoria = jugados.filter((x) => x.categoria === categoria);
  if (jugados.length === 0) return <>{children}</>;
  return (
    <>
      <section className={styles.elegirPartido} aria-label="Elige el partido">
        <h4 className={styles.seccion}>¿De qué partido?</h4>
        <div className={styles.categorias} role="group" aria-label="Categoría">
          {CATEGORIAS_CARTEL.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={c === categoria}
              onClick={() => setElegida(c)}
            >
              {c}
            </button>
          ))}
        </div>
        {deLaCategoria.length === 0 ? (
          <p className={styles.partidoElegidoContexto}>Sin partidos jugados en {categoria}.</p>
        ) : (
          <ul>
            {deLaCategoria.map((x) => (
              <li key={x.id}>
                <button
                  type="button"
                  className={styles.partidoElegido}
                  data-partido={x.id}
                  onClick={() => onSelect(x)}
                >
                  <CrucePartido m={x} categoria={x.categoria ?? ""} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <details className={styles.manual}>
        <summary>
          <span>Otro partido o un amistoso, a mano</span>
          <Flecha />
        </summary>
        <div className={styles.manualContenido}>{children}</div>
      </details>
    </>
  );
};
