/**
 * Piezas compartidas por los formularios del generador de carteles.
 *
 * Desde la 6E usan los componentes de la Fase 3A: así cada etiqueta queda asociada a su campo
 * —antes eran `<label>` sueltos, que el lector de pantalla no ligaba a nada— y los interruptores
 * dicen si están activados.
 */

import React, { useId } from "react";
import { useOptionalStudio } from "@/components/studio/StudioContext";
import { Button } from "@/components/ui/foundation/Button";
import { Select } from "@/components/ui/foundation/Fields";
import { porJugarDeCategoria } from "@/lib/jornada/proximos";
import { formatLiteralMatchDate } from "@/lib/match-date-time";
import cartel from "./Cartel.module.css";
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

/**
 * Dónde juega el Santiso, para el cartel hecho a mano. Con un partido del calendario la localía
 * ya se sabe: no se pregunta.
 */
export const LadoSantiso: React.FC<{
  partidoId: string;
  value: "left" | "right";
  onChange: (v: "left" | "right") => void;
}> = ({ partidoId, value, onChange }) =>
  partidoId ? null : (
    <div className={cartel.lado} role="group" aria-label="Dónde juega el Santiso">
      <span>El Santiso juega</span>
      <div className={cartel.ladoBotones}>
        <Toggle label="En casa" active={value === "left"} onClick={() => onChange("left")} />
        <Toggle label="Fuera" active={value === "right"} onClick={() => onChange("right")} />
      </div>
    </div>
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

/** El cruce de un partido como se verá en el cartel: contexto, equipos con marcador y fecha. */
const CrucePartido: React.FC<{ m: SelectorMatch; categoria: string }> = ({ m, categoria }) => {
  const competicion = m.competiciones?.nombre || m.competicion || m.jornada?.competicion || "";
  const marcador =
    m.goles_local != null && m.goles_visitante != null
      ? `${m.goles_local}–${m.goles_visitante}`
      : "vs";
  const contexto = [categoria, competicion, m.jornada?.numero ? `Jornada ${m.jornada.numero}` : ""]
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
 * Lo primero del cartel es el partido.
 * - Ya elegido (desde Inicio, Partidos o la lista): su tarjeta arriba y los campos plegados
 *   para cambiar de partido o retocar.
 * - Sin elegir (desde Carteles): la categoría y, debajo, sus partidos para tocar uno —los jugados,
 *   de los carteles de después; con `porJugar`, los que quedan—; los campos a mano quedan
 *   plegados para un amistoso.
 */
export const ConPartidoElegido: React.FC<{
  partidoId: string;
  dbMatches: SelectorMatch[];
  categoria: string;
  onSelect: (m: SelectorMatch) => void;
  /** Al tocar una categoría: la del cartel hecho a mano (un amistoso). */
  onCategoria?: (categoria: string) => void;
  /** Cartel de antes del partido: se eligen los que quedan por jugar. */
  porJugar?: boolean;
  children: React.ReactNode;
}> = ({ partidoId, dbMatches, categoria, onSelect, onCategoria, porJugar, children }) => {
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
          <div className={styles.manualContenido}>
            {/* El mismo selector de arriba: un solo sitio para cambiar de partido. */}
            <ElegirPartido
              dbMatches={dbMatches}
              onSelect={onSelect}
              onCategoria={onCategoria}
              porJugar={porJugar}
              categoriaInicial={m.categoria ?? undefined}
              soloSelector
            >
              {null}
            </ElegirPartido>
            {children}
          </div>
        </details>
      </>
    );
  return (
    <ElegirPartido
      dbMatches={dbMatches}
      onSelect={onSelect}
      onCategoria={onCategoria}
      porJugar={porJugar}
    >
      {children}
    </ElegirPartido>
  );
};

const CATEGORIAS_CARTEL = ["Senior", "Veteranos"] as const;

const esDelSantiso = (x: SelectorMatch) =>
  `${x.equipo_local?.nombre ?? ""} ${x.equipo_visitante?.nombre ?? ""}`
    .toLowerCase()
    .includes("santiso");

/** «J3 · U.D. Santiso F.C. 6–1 Atlético Éter · 18 oct»: cómo sale cada partido en la lista. */
function etiquetaJornada(m: SelectorMatch) {
  const marcador =
    m.goles_local != null && m.goles_visitante != null
      ? `${m.goles_local}–${m.goles_visitante}`
      : "–";
  const cuando = m.fecha ? ` · ${formatLiteralMatchDate(m.fecha)}` : "";
  return `J${m.jornada?.numero ?? "?"} · ${m.equipo_local?.nombre ?? "Local"} ${marcador} ${m.equipo_visitante?.nombre ?? "Visitante"}${cuando}`;
}

/**
 * Las dos categorías arriba y los partidos de la elegida: los jugados, del último al primero, o
 * con `porJugar` los que quedan, del más cercano al más lejano.
 */
const ElegirPartido: React.FC<{
  dbMatches: SelectorMatch[];
  onSelect: (m: SelectorMatch) => void;
  onCategoria?: (categoria: string) => void;
  porJugar?: boolean;
  /** Con un partido ya elegido, empieza por su categoría. */
  categoriaInicial?: string;
  /** Solo la categoría y la jornada, sin el bloque a mano (va dentro de «Cambiar partido»). */
  soloSelector?: boolean;
  children: React.ReactNode;
}> = ({ dbMatches, onSelect, onCategoria, porJugar, categoriaInicial, soloSelector, children }) => {
  // Abierto con `?categoria=` (desde el catálogo o Inicio), empieza por esa.
  const pedida = useOptionalStudio()?.params.get("categoria");
  const categoriaUrl = CATEGORIAS_CARTEL.find((c) => c === pedida);
  // Un solo «hoy» por montaje: la lista no cambia mientras se mira.
  const [hoy] = React.useState(() => new Date());
  const lista = porJugar
    ? CATEGORIAS_CARTEL.flatMap((c) => porJugarDeCategoria(dbMatches, c, hoy))
    : dbMatches
        .filter((x) => x.estado === "finalizado" && esDelSantiso(x))
        .sort((a, b) => (b.fecha ?? "").localeCompare(a.fecha ?? ""));
  // Sin categoría pedida, abre en la del partido que toca: el último jugado o el próximo.
  const queToca = porJugar
    ? [...lista].sort((a, b) => (a.fecha ?? "￿").localeCompare(b.fecha ?? "￿"))[0]
    : lista[0];
  const [elegida, setElegida] = React.useState<string | null>(null);
  const categoria =
    elegida ??
    CATEGORIAS_CARTEL.find((c) => c === categoriaInicial) ??
    categoriaUrl ??
    queToca?.categoria ??
    "Senior";
  const deLaCategoria = lista.filter((x) => x.categoria === categoria);
  if (lista.length === 0) return <>{children}</>;
  return (
    <>
      <section className={styles.elegirPartido} aria-label="Elige el partido">
        <h4 className={styles.seccion}>¿De qué partido?</h4>
        {/* Una sola fila: la categoría y, al lado, su jornada. Cabe con una temporada entera. */}
        <div className={styles.elegirFila}>
          <div className={styles.categorias} role="group" aria-label="Categoría">
            {CATEGORIAS_CARTEL.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={c === categoria}
                onClick={() => {
                  setElegida(c);
                  onCategoria?.(c);
                }}
              >
                {c}
              </button>
            ))}
          </div>
          {deLaCategoria.length === 0 ? (
            <p className={styles.partidoElegidoContexto}>
              Sin partidos {porJugar ? "por jugar" : "jugados"} en {categoria}.
            </p>
          ) : (
            <select
              aria-label="Jornada"
              value=""
              onChange={(e) => {
                const m = deLaCategoria.find((x) => x.id === e.target.value);
                if (m) onSelect(m);
              }}
            >
              <option value="">Jornada…</option>
              {deLaCategoria.map((x) => (
                <option key={x.id} value={x.id}>
                  {etiquetaJornada(x)}
                </option>
              ))}
            </select>
          )}
        </div>
      </section>
      {!soloSelector && (
      <details className={styles.manual}>
        <summary>
          <span>Otro partido o un amistoso, a mano</span>
          <Flecha />
        </summary>
        <div className={styles.manualContenido}>{children}</div>
      </details>
      )}
    </>
  );
};
