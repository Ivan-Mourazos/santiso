"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { ReglaClasificacion } from "@santiso/domain";
import { Button } from "@/components/ui/foundation/Button";
import { Select } from "@/components/ui/foundation/Fields";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/foundation/States";
import type { FilaClasificacion } from "@/lib/dto";
import { cargarPantallaClasificacion } from "@/lib/server/acciones/clasificacion";
import { useStudio } from "@/components/studio/StudioContext";
import { useCompeticiones } from "@/lib/useCompeticiones";
import styles from "./Clasificacion.module.css";

interface Props {
  categoria: string;
}

/** Las columnas numéricas, con su nombre entero para quien no sepa qué es «PJ». */
const COLUMNAS: { clave: keyof FilaClasificacion; corta: string; nombre: string }[] = [
  { clave: "puntos", corta: "PTS", nombre: "Puntos" },
  { clave: "jugados", corta: "PJ", nombre: "Partidos jugados" },
  { clave: "ganados", corta: "PG", nombre: "Ganados" },
  { clave: "empatados", corta: "PE", nombre: "Empatados" },
  { clave: "perdidos", corta: "PP", nombre: "Perdidos" },
  { clave: "golesFavor", corta: "GF", nombre: "Goles a favor" },
  { clave: "golesContra", corta: "GC", nombre: "Goles en contra" },
];

/** El color de la zona es un dato de la competición: viaja como variable, no como estilo. */
const conColor = (color: string) => ({ "--color-regla": color }) as CSSProperties;

/**
 * Clasificación de una competición, calculada en el servidor desde los partidos finalizados.
 * La pantalla no calcula nada: pinta la tabla y marca las zonas que define la competición.
 */
export default function AdminClasificacion({ categoria }: Props) {
  const { setParams } = useStudio();
  const {
    temporadas,
    selectedSeasonId,
    selectedCompetitionId,
    setSelectedCompetitionId,
    competicionesEnCategoria,
    loadingCompeticiones,
    errorCompeticiones,
    loadCompeticiones,
  } = useCompeticiones(categoria, true);
  const [filas, setFilas] = useState<FilaClasificacion[]>([]);
  const [reglas, setReglas] = useState<ReglaClasificacion[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generacion = useRef(0);

  // Tabla y reglas llegan en una sola acción: Next despacha las del cliente de una en una.
  const cargar = useCallback(async (competicionId: string) => {
    const esta = ++generacion.current;
    setCargando(true);
    try {
      const pantalla = await cargarPantallaClasificacion(competicionId);
      if (esta !== generacion.current) return;
      if (!pantalla.ok) {
        setError(pantalla.error);
        return;
      }
      setFilas(pantalla.datos.filas);
      setReglas(pantalla.datos.reglas);
      setError(null);
    } catch (e) {
      console.error(e);
      if (esta === generacion.current) {
        setError("No se pudo cargar la clasificación. Inténtalo de nuevo.");
      }
    } finally {
      if (esta === generacion.current) setCargando(false);
    }
  }, []);

  useEffect(() => {
    const solicitudes = generacion;
    if (!selectedCompetitionId) {
      solicitudes.current++;
      return;
    }
    const id = window.setTimeout(() => void cargar(selectedCompetitionId), 0);
    return () => {
      window.clearTimeout(id);
      solicitudes.current++;
    };
  }, [selectedCompetitionId, cargar]);

  // Qué regla toca a cada puesto. Se ordena una copia: el estado no se toca en el render.
  const reglaDe = useMemo(() => {
    const porPuesto = new Map<number, ReglaClasificacion>();
    for (const regla of reglas) for (const puesto of regla.puestos) porPuesto.set(puesto, regla);
    return (puesto: number) => porPuesto.get(puesto) ?? null;
  }, [reglas]);

  const competicion = competicionesEnCategoria.find((c) => c.id === selectedCompetitionId);

  let contenido: React.ReactNode;
  if (errorCompeticiones) {
    contenido = (
      <ErrorState
        title="No se pudieron cargar las competiciones"
        detail={errorCompeticiones}
        action={<Button onClick={() => void loadCompeticiones()}>Reintentar</Button>}
      />
    );
  } else if (!loadingCompeticiones && competicionesEnCategoria.length === 0) {
    contenido = (
      <EmptyState
        title={`${categoria} no tiene competiciones en esta temporada.`}
        detail="Se crean desde Equipos o al cargar el calendario."
      />
    );
  } else if (error) {
    contenido = (
      <ErrorState
        title="No se pudo cargar la clasificación"
        detail={error}
        action={<Button onClick={() => void cargar(selectedCompetitionId)}>Reintentar</Button>}
      />
    );
  } else if ((cargando || loadingCompeticiones) && filas.length === 0) {
    contenido = <LoadingState title="Cargando clasificación…" />;
  } else if (filas.length === 0) {
    contenido = (
      <EmptyState
        title="Esta competición todavía no tiene equipos."
        detail="La tabla aparece en cuanto haya equipos inscritos."
      />
    );
  } else {
    contenido = (
      <>
        {reglas.length > 0 && (
          <ul className={styles.leyenda} aria-label="Zonas de la clasificación">
            {reglas.map((regla) => (
              <li key={regla.id} style={conColor(regla.color)}>
                <span className={styles.muestra} aria-hidden="true" />
                {regla.nombre} ({[...regla.puestos].sort((a, b) => a - b).join(", ")})
              </li>
            ))}
          </ul>
        )}

        <div className={styles.envoltorio}>
          <table
            className={styles.tabla}
            aria-label={`Clasificación de ${competicion?.nombre ?? categoria}`}
            aria-busy={cargando || undefined}
          >
            <thead>
              <tr>
                <th scope="col">
                  <abbr title="Posición">#</abbr>
                </th>
                <th scope="col">
                  <span className={styles.oculto}>Escudo</span>
                </th>
                <th scope="col">Equipo</th>
                {COLUMNAS.map((c) => (
                  <th key={c.clave} scope="col" aria-label={c.nombre}>
                    <abbr title={c.nombre}>{c.corta}</abbr>
                  </th>
                ))}
                <th scope="col" aria-label="Diferencia de goles">
                  <abbr title="Diferencia de goles">DG</abbr>
                </th>
              </tr>
            </thead>
            <tbody>
              {filas.map((fila, indice) => {
                const puesto = indice + 1;
                const regla = reglaDe(puesto);
                return (
                  <tr
                    key={fila.equipoId}
                    className={regla ? styles.enZona : undefined}
                    style={regla ? conColor(regla.color) : undefined}
                  >
                    <td className={styles.posicion}>{puesto}</td>
                    <td className={styles.escudo}>
                      {fila.escudoUrl && (
                        // eslint-disable-next-line @next/next/no-img-element -- media local servida por el route handler
                        <img src={fila.escudoUrl} alt="" />
                      )}
                    </td>
                    <td className={styles.equipo}>
                      {fila.nombre}
                      {regla && <span className={styles.oculto}> · {regla.nombre}</span>}
                    </td>
                    {COLUMNAS.map((c) => (
                      <td
                        key={c.clave}
                        className={c.clave === "puntos" ? styles.puntos : undefined}
                      >
                        {fila[c.clave]}
                      </td>
                    ))}
                    <td
                      className={
                        fila.diferencia > 0
                          ? styles.positiva
                          : fila.diferencia < 0
                            ? styles.negativa
                            : undefined
                      }
                    >
                      {fila.diferencia > 0 ? `+${fila.diferencia}` : fila.diferencia}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.cabecera}>
        <h3>Clasificación</h3>
        <p>
          Se calcula con los partidos finalizados. Las sanciones y los puntos concedidos a mano
          todavía no se pueden editar.
        </p>
      </div>

      <div className={styles.selectores}>
        {/* La temporada vive en la URL, como en el resto del panel: la de una temporada pasada
            es la clasificación final, y es la que tiene datos hasta que empiece la nueva. */}
        {temporadas.length > 1 && (
          <Select
            label="Temporada"
            value={selectedSeasonId}
            onChange={(e) => {
              if (e.target.value !== selectedSeasonId)
                setParams({ temporada: e.target.value, competicion: null });
            }}
            disabled={cargando || loadingCompeticiones}
          >
            {temporadas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
                {t.activa ? " (activa)" : ""}
              </option>
            ))}
          </Select>
        )}
        {competicionesEnCategoria.length > 0 && (
          <Select
            label="Competición"
            value={selectedCompetitionId}
            onChange={(e) => setSelectedCompetitionId(e.target.value)}
            disabled={cargando}
          >
            {competicionesEnCategoria.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </Select>
        )}
      </div>

      {contenido}
    </div>
  );
}
