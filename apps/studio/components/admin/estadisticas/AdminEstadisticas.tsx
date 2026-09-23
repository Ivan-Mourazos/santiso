"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/foundation/Button";
import { Field, Select } from "@/components/ui/foundation/Fields";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/foundation/States";
import {
  filtrarPorTexto,
  nombreVisible,
  ordenarEstadisticas,
  totales,
  type Columna,
  type FilaEstadistica,
} from "@/lib/estadisticas/modelo";
import {
  cargarPantallaEstadisticas,
  type PantallaEstadisticas,
} from "@/lib/server/acciones/estadisticas";
import styles from "./Estadisticas.module.css";

interface Props {
  showToast: (msg: string, type?: "success" | "error") => void;
  categoria: string;
}

/** Columnas numéricas de la tabla: se leen de la fila por su clave, así que deben ser suyas. */
type ColumnaNumerica = Extract<
  Columna,
  | "convocados"
  | "titularidades"
  | "partidosJugados"
  | "goles"
  | "golesPropia"
  | "amarillas"
  | "rojas"
>;

const COLUMNAS_TABLA: { clave: ColumnaNumerica; etiqueta: string; corta: string }[] = [
  { clave: "convocados", etiqueta: "Convocatorias", corta: "Conv." },
  { clave: "titularidades", etiqueta: "Titularidades", corta: "Tit." },
  { clave: "partidosJugados", etiqueta: "Partidos jugados", corta: "Jug." },
  { clave: "goles", etiqueta: "Goles", corta: "Goles" },
  { clave: "golesPropia", etiqueta: "En propia", corta: "Propia" },
  { clave: "amarillas", etiqueta: "Amarillas", corta: "Amar." },
  { clave: "rojas", etiqueta: "Rojas", corta: "Rojas" },
];

const VACIA: PantallaEstadisticas = {
  temporadas: [],
  temporadaId: "",
  competiciones: [],
  competicionId: null,
  filas: [],
  disponibilidadPenaltis: false,
};

/**
 * Estadísticas por jugador de una temporada, categoría y competición. No calcula nada: lo que
 * enseña sale de la 7A, que cuenta participaciones y eventos del acta.
 */
export default function AdminEstadisticas({ showToast, categoria }: Props) {
  const [pantalla, setPantalla] = useState<PantallaEstadisticas>(VACIA);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [orden, setOrden] = useState<{ columna: Columna; descendente: boolean } | null>(null);
  // Lo elegido manda sobre lo que devolvió la carga anterior, que puede ser de otra categoría.
  const [temporadaPedida, setTemporadaPedida] = useState<string | null>(null);
  const [competicionPedida, setCompeticionPedida] = useState<string | null>(null);
  const generacion = useRef(0);

  // Un fallo con la tabla ya en pantalla se avisa sin borrarla: lo que se veía sigue siendo
  // cierto, y perderlo por un error de recarga es peor que el error.
  const hayDatos = useRef(false);
  const avisar = useCallback(
    (mensaje: string) => {
      if (hayDatos.current) showToast(mensaje, "error");
      else setError(mensaje);
    },
    [showToast],
  );

  const cargar = useCallback(
    async (temporadaId: string | null, competicionId: string | null) => {
      const esta = ++generacion.current;
      setCargando(true);
      try {
        const resultado = await cargarPantallaEstadisticas(categoria, temporadaId, competicionId);
        if (esta !== generacion.current) return;
        if (!resultado.ok) {
          avisar(resultado.error);
          return;
        }
        hayDatos.current = true;
        setPantalla(resultado.datos);
        setTemporadaPedida(resultado.datos.temporadaId || null);
        setCompeticionPedida(resultado.datos.competicionId);
        setError(null);
      } catch (e) {
        console.error(e);
        if (esta === generacion.current) {
          avisar("No se pudieron cargar las estadísticas. Inténtalo de nuevo.");
        }
      } finally {
        if (esta === generacion.current) setCargando(false);
      }
    },
    [categoria, avisar],
  );

  // La categoría la manda la cabecera del panel: al cambiarla se vuelve a empezar, conservando
  // la temporada elegida (existe en todas) pero no la competición (es de una categoría).
  useEffect(() => {
    const temporada = temporadaPedida;
    const id = window.setTimeout(() => void cargar(temporada, null), 0);
    const solicitudes = generacion;
    return () => {
      window.clearTimeout(id);
      solicitudes.current++;
    };
    // `temporadaPedida` a propósito fuera: aquí solo se reacciona al cambio de categoría.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargar]);

  const visibles = useMemo(() => {
    const filtradas = filtrarPorTexto(pantalla.filas as FilaEstadistica[], texto);
    return orden ? ordenarEstadisticas(filtradas, orden.columna, orden.descendente) : filtradas;
  }, [pantalla.filas, texto, orden]);
  const suma = useMemo(() => totales(visibles), [visibles]);

  function ordenarPor(columna: Columna) {
    setOrden((actual) =>
      actual?.columna === columna
        ? { columna, descendente: !actual.descendente }
        : // Las columnas numéricas interesan de mayor a menor; los nombres, de la A a la Z.
          { columna, descendente: columna !== "jugador" },
    );
  }

  const sentido = (columna: Columna) =>
    orden?.columna === columna ? (orden.descendente ? "descending" : "ascending") : undefined;

  function cambiarTemporada(id: string) {
    if (id === pantalla.temporadaId) return;
    setTemporadaPedida(id);
    setCompeticionPedida(null);
    void cargar(id, null);
  }

  function cambiarCompeticion(id: string) {
    const elegida = id || null;
    if (elegida === pantalla.competicionId) return;
    setCompeticionPedida(elegida);
    void cargar(temporadaPedida, elegida);
  }

  if (error) {
    return (
      <div className={styles.panel}>
        <ErrorState
          title="No se pudieron cargar las estadísticas"
          detail={error}
          action={
            <Button onClick={() => void cargar(temporadaPedida, competicionPedida)}>
              Reintentar
            </Button>
          }
        />
      </div>
    );
  }

  if (cargando && pantalla.filas.length === 0 && pantalla.temporadas.length === 0) {
    return (
      <div className={styles.panel}>
        <LoadingState title="Cargando estadísticas…" />
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.cabecera}>
        <h3>Estadísticas de {categoria}</h3>
        <p>
          Se cuentan las convocatorias y los eventos de las actas guardadas. Nada de esto se
          escribe: es la lectura de lo que ya hay.
        </p>
      </div>

      <div className={styles.herramientas}>
        <Select
          label="Temporada"
          value={pantalla.temporadaId}
          onChange={(e) => cambiarTemporada(e.target.value)}
          disabled={cargando || pantalla.temporadas.length === 0}
        >
          {pantalla.temporadas.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre}
              {t.activa ? " (activa)" : ""}
            </option>
          ))}
        </Select>
        <Select
          label="Competición"
          value={pantalla.competicionId ?? ""}
          onChange={(e) => cambiarCompeticion(e.target.value)}
          disabled={cargando || pantalla.competiciones.length === 0}
        >
          <option value="">Todas</option>
          {pantalla.competiciones.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </Select>
        <Field
          label="Buscar"
          type="search"
          placeholder="Nombre o apodo"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
      </div>

      {pantalla.filas.length === 0 ? (
        <EmptyState
          title={`Todavía no hay datos de ${categoria} en esta temporada.`}
          detail="Aparecerán en cuanto se importe un acta o se inscriba a alguien en la plantilla."
        />
      ) : (
        <>
          <div className={styles.resumen}>
            <p className={styles.dato}>
              <strong>{suma.jugadores}</strong>
              <span>jugadores</span>
            </p>
            <p className={styles.dato}>
              <strong>{suma.goles}</strong>
              <span>goles</span>
            </p>
            <p className={styles.dato}>
              <strong>{suma.amarillas}</strong>
              <span>amarillas</span>
            </p>
            <p className={styles.dato}>
              <strong>{suma.rojas}</strong>
              <span>rojas</span>
            </p>
          </div>

          <p className={styles.contador} role="status">
            {visibles.length === pantalla.filas.length
              ? `${pantalla.filas.length} jugadores`
              : `${visibles.length} de ${pantalla.filas.length} jugadores`}
          </p>

          {visibles.length === 0 ? (
            <EmptyState
              title="Ningún jugador coincide con la búsqueda."
              action={
                <Button variant="secondary" onClick={() => setTexto("")}>
                  Quitar la búsqueda
                </Button>
              }
            />
          ) : (
            <div className={styles.tablaEnvoltorio}>
              <table className={styles.tabla} aria-label={`Estadísticas de ${categoria}`}>
                <thead>
                  <tr>
                    <th scope="col" aria-sort={sentido("dorsal")}>
                      <button className={styles.ordenar} onClick={() => ordenarPor("dorsal")}>
                        Dorsal
                      </button>
                    </th>
                    <th scope="col" aria-sort={sentido("jugador")}>
                      <button className={styles.ordenar} onClick={() => ordenarPor("jugador")}>
                        Jugador
                      </button>
                    </th>
                    {COLUMNAS_TABLA.map((c) => (
                      <th key={c.clave} scope="col" aria-sort={sentido(c.clave)}>
                        <button
                          className={styles.ordenar}
                          onClick={() => ordenarPor(c.clave)}
                          aria-label={`Ordenar por ${c.etiqueta.toLowerCase()}`}
                        >
                          {c.corta}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((fila) => (
                    <tr key={fila.jugadorId}>
                      <td className={styles.dorsal} data-etiqueta="Dorsal">
                        {fila.dorsal ?? "—"}
                      </td>
                      <td className={styles.jugador}>
                        <strong>{nombreVisible(fila)}</strong>
                        {fila.inscripcionAusente && <small>Sin inscripción esta temporada</small>}
                      </td>
                      {COLUMNAS_TABLA.map((c) => (
                        <td key={c.clave} data-etiqueta={c.etiqueta}>
                          {fila[c.clave]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {suma.sinInscripcion > 0 && (
            <p role="status" className={styles.aviso}>
              {suma.sinInscripcion === 1
                ? "Hay 1 jugador con datos en actas que no está inscrito en esta temporada y categoría."
                : `Hay ${suma.sinInscripcion} jugadores con datos en actas que no están inscritos en esta temporada y categoría.`}{" "}
              Se muestran igual: sus goles y tarjetas existen.
            </p>
          )}
          {suma.sinConvocatoria > 0 && (
            <p className={styles.nota}>
              {suma.sinConvocatoria === 1
                ? "1 jugador inscrito todavía no ha sido convocado."
                : `${suma.sinConvocatoria} jugadores inscritos todavía no han sido convocados.`}
            </p>
          )}
          <p className={styles.nota}>
            El acta no distingue los goles de penalti, así que no hay desglose: los penaltis van
            contados dentro de los goles.
          </p>
        </>
      )}
    </div>
  );
}
