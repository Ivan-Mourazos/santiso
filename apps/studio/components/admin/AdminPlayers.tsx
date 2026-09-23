"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStudio } from "@/components/studio/StudioContext";
import { Button } from "@/components/ui/foundation/Button";
import { Field, Select } from "@/components/ui/foundation/Fields";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/foundation/States";
import type { JugadorDto } from "@/lib/dto";
import {
  dorsalesRepetidos,
  ETIQUETAS_POSICION,
  FILTRO_VACIO,
  filtrarJugadores,
  POSICIONES,
  type FiltroJugadores,
} from "@/lib/plantilla/modelo";
import {
  cargarCandidatosJugadores,
  cargarJugadores,
  incorporarJugadores,
  quitarJugadorDeTemporada,
} from "@/lib/server/acciones/jugadores";
import { useCompeticiones } from "@/lib/useCompeticiones";
import BarraTemporada from "./plantilla/BarraTemporada";
import EditorJugador from "./plantilla/EditorJugador";
import IncorporarDeTemporada, { type Elegido } from "./plantilla/IncorporarDeTemporada";
import styles from "./plantilla/Plantilla.module.css";

interface AdminPlayersProps {
  showToast: (msg: string, type?: "success" | "error") => void;
  showConfirm: (msg: string, onConfirm: () => void) => void;
  categoria: string;
}

/** Qué tiene abierto el editor. `clave` cambia en cada apertura para montarlo de cero. */
type EstadoEditor = { clave: number; jugador: JugadorDto | null } | null;

const nombrePosicion = (posicion: string | null) =>
  posicion ? (ETIQUETAS_POSICION[posicion as keyof typeof ETIQUETAS_POSICION] ?? posicion) : "—";

export default function AdminPlayers({ showToast, showConfirm, categoria }: AdminPlayersProps) {
  const { setParams } = useStudio();
  // La temporada que se consulta sale de la URL (`?temporada=`); sin ella, la activa.
  const {
    temporadas,
    selectedSeasonId: temporadaId,
    loadingCompeticiones,
    errorCompeticiones,
    loadCompeticiones,
  } = useCompeticiones(undefined, true);
  const temporadaNombre = temporadas.find((t) => t.id === temporadaId)?.nombre ?? "";

  const [jugadores, setJugadores] = useState<JugadorDto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [candidatos, setCandidatos] = useState<{ origen: string; jugadores: JugadorDto[] } | null>(
    null,
  );
  const [cargandoCandidatos, setCargandoCandidatos] = useState(false);
  const [incorporando, setIncorporando] = useState(false);
  const [otrasCategorias, setOtrasCategorias] = useState(false);
  const [filtro, setFiltro] = useState<FiltroJugadores>(FILTRO_VACIO);
  const [editor, setEditor] = useState<EstadoEditor>(null);
  // Cada carga lleva un número: si llega tarde la respuesta de una carga anterior, se descarta.
  const generacion = useRef(0);

  const fetchJugadores = useCallback(async () => {
    if (!temporadaId) return;
    const esta = ++generacion.current;
    setCargando(true);
    try {
      const lista = await cargarJugadores(categoria, temporadaId);
      if (esta !== generacion.current) return;
      setJugadores(lista);
      setErrorCarga(null);
    } catch (err) {
      console.error(err);
      if (esta === generacion.current) {
        setErrorCarga(
          "No se pudo cargar la plantilla. Comprueba la conexión e inténtalo de nuevo.",
        );
      }
    } finally {
      if (esta === generacion.current) setCargando(false);
    }
  }, [categoria, temporadaId]);

  const fetchCandidatos = useCallback(
    async (todasLasCategorias: boolean) => {
      if (!temporadaId) return;
      setCargandoCandidatos(true);
      try {
        const r = await cargarCandidatosJugadores(categoria, temporadaId, !todasLasCategorias);
        setCandidatos(r.origen ? { origen: r.origen.nombre, jugadores: r.jugadores } : null);
      } catch (err) {
        // Un fallo aquí no bloquea la pantalla: solo desaparece el botón de incorporar.
        console.error(err);
        setCandidatos(null);
      } finally {
        setCargandoCandidatos(false);
      }
    },
    [categoria, temporadaId],
  );

  useEffect(() => {
    const id = window.setTimeout(() => {
      void fetchJugadores();
      void fetchCandidatos(false);
    }, 0);
    return () => window.clearTimeout(id);
  }, [fetchJugadores, fetchCandidatos]);

  const visibles = useMemo(() => filtrarJugadores(jugadores, filtro), [jugadores, filtro]);
  const repetidos = useMemo(() => dorsalesRepetidos(jugadores), [jugadores]);
  const dorsalesOcupados = useMemo(() => {
    const mapa = new Map<number, string>();
    for (const j of jugadores) if (j.dorsal !== null) mapa.set(j.dorsal, j.nombre);
    return mapa;
  }, [jugadores]);
  const candidatosDialogo = useMemo(
    () =>
      (candidatos?.jugadores ?? []).map((j) => ({
        clave: j.inscripcion_id,
        nombre: j.nombre,
        detalle: [j.categoria !== categoria ? j.categoria : null, j.posicion, j.apodo]
          .filter(Boolean)
          .join(" · "),
        foto_url: j.foto_url,
        dorsal: j.dorsal,
      })),
    [candidatos, categoria],
  );
  const hayCandidatos = (candidatos?.jugadores.length ?? 0) > 0;

  const abrirEditor = (jugador: JugadorDto | null) => setEditor({ clave: Date.now(), jugador });

  async function handleIncorporar(elegidos: Elegido[]) {
    const porClave = new Map((candidatos?.jugadores ?? []).map((j) => [j.inscripcion_id, j]));
    const resultado = await incorporarJugadores({
      temporadaId,
      categoria,
      jugadores: elegidos.flatMap((e) => {
        const jugador = porClave.get(e.clave);
        return jugador
          ? [{ jugadorId: jugador.id, desdeInscripcionId: e.clave, dorsal: e.dorsal }]
          : [];
      }),
    });
    if (!resultado.ok) {
      showToast(resultado.error, "error");
      return;
    }
    showToast(`${resultado.datos} jugador(es) añadidos a ${temporadaNombre}`);
    setIncorporando(false);
    setOtrasCategorias(false);
    void fetchJugadores();
    void fetchCandidatos(false);
  }

  function handleQuitar(jugador: JugadorDto) {
    showConfirm(
      `¿Quitar a ${jugador.nombre} de la plantilla de ${temporadaNombre}? Sus partidos y sus otras temporadas no se tocan.`,
      async () => {
        const resultado = await quitarJugadorDeTemporada(jugador.inscripcion_id);
        if (!resultado.ok) {
          showToast(resultado.error, "error");
          return;
        }
        showToast(`${jugador.nombre} ya no está en ${temporadaNombre}`);
        void fetchJugadores();
        void fetchCandidatos(false);
      },
    );
  }

  let contenido: React.ReactNode;
  if (errorCompeticiones) {
    contenido = (
      <ErrorState
        title="No se pudieron cargar las temporadas"
        detail={errorCompeticiones}
        action={<Button onClick={() => void loadCompeticiones()}>Reintentar</Button>}
      />
    );
  } else if (!loadingCompeticiones && temporadas.length === 0) {
    contenido = (
      <EmptyState
        title="Todavía no hay ninguna temporada."
        detail="Crea la temporada en Ajustes › Temporadas y vuelve aquí para montar la plantilla."
      />
    );
  } else if (errorCarga) {
    contenido = (
      <ErrorState
        title="No se pudo cargar la plantilla"
        detail={errorCarga}
        action={<Button onClick={() => void fetchJugadores()}>Reintentar</Button>}
      />
    );
  } else if (!temporadaId || (cargando && jugadores.length === 0)) {
    contenido = <LoadingState title="Cargando jugadores…" />;
  } else if (jugadores.length === 0) {
    contenido = (
      <EmptyState
        title={`Todavía no hay jugadores en ${categoria} ${temporadaNombre}.`}
        detail={
          hayCandidatos
            ? `Trae a quien sigue de ${candidatos?.origen} y da de alta a los nuevos.`
            : "Da de alta a los jugadores de esta temporada."
        }
        action={
          <div className={styles.acciones}>
            {hayCandidatos && (
              <Button onClick={() => setIncorporando(true)}>Añadir de {candidatos?.origen}</Button>
            )}
            <Button variant="secondary" onClick={() => abrirEditor(null)}>
              Añadir jugador
            </Button>
          </div>
        }
      />
    );
  } else {
    contenido = (
      <>
        <div className={styles.herramientas} role="search" aria-label="Filtrar la plantilla">
          <Field
            label="Buscar"
            type="search"
            placeholder="Nombre, apodo o dorsal"
            value={filtro.texto}
            onChange={(e) => setFiltro((f) => ({ ...f, texto: e.target.value }))}
          />
          <Select
            label="Posición"
            value={filtro.posicion}
            onChange={(e) => setFiltro((f) => ({ ...f, posicion: e.target.value }))}
          >
            <option value="">Todas</option>
            {POSICIONES.map((p) => (
              <option key={p} value={p}>
                {ETIQUETAS_POSICION[p]}
              </option>
            ))}
          </Select>
          <label className={styles.casilla}>
            <input
              type="checkbox"
              className={styles.check}
              checked={filtro.soloSinFoto}
              onChange={(e) => setFiltro((f) => ({ ...f, soloSinFoto: e.target.checked }))}
            />
            Solo sin foto
          </label>
        </div>
        <p className={styles.contador} role="status">
          {visibles.length === jugadores.length
            ? `${jugadores.length} jugadores`
            : `${visibles.length} de ${jugadores.length} jugadores`}
        </p>

        {visibles.length === 0 ? (
          <EmptyState
            title="Ningún jugador coincide con la búsqueda."
            action={
              <Button variant="secondary" onClick={() => setFiltro(FILTRO_VACIO)}>
                Quitar filtros
              </Button>
            }
          />
        ) : (
          <table className={styles.tabla} aria-label={`Plantilla ${categoria} ${temporadaNombre}`}>
            <thead>
              <tr>
                <th scope="col">Foto</th>
                <th scope="col">Dorsal</th>
                <th scope="col">Nombre</th>
                <th scope="col">Posición</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((j) => (
                <tr key={j.inscripcion_id}>
                  <td className={styles.celdaFoto}>
                    {j.foto_url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- media local servida por el route handler
                      <img className={styles.foto} src={j.foto_url} alt="" />
                    ) : (
                      <span className={styles.foto} aria-hidden="true" />
                    )}
                  </td>
                  <td className={styles.celdaDorsal}>
                    {j.dorsal !== null && (
                      <span
                        className={`${styles.dorsal} ${repetidos.has(j.dorsal) ? styles.repetido : ""}`}
                        title={repetidos.has(j.dorsal) ? "Dorsal repetido" : undefined}
                      >
                        {j.dorsal}
                      </span>
                    )}
                  </td>
                  <td className={`${styles.nombre} ${styles.celdaNombre}`}>
                    <strong>{j.nombre}</strong>
                    {j.apodo && <span>{j.apodo}</span>}
                  </td>
                  <td className={styles.celdaPosicion}>{nombrePosicion(j.posicion)}</td>
                  <td className={styles.celdaAcciones}>
                    <div className={styles.filaAcciones}>
                      <Button
                        variant="secondary"
                        onClick={() => abrirEditor(j)}
                        size="sm"
                        aria-label={`Editar a ${j.nombre}`}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => handleQuitar(j)}
                        size="sm"
                        aria-label={`Quitar a ${j.nombre} de ${temporadaNombre}`}
                      >
                        Quitar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </>
    );
  }

  const listo = Boolean(temporadaId) && !errorCompeticiones && !errorCarga;

  return (
    <div className={styles.panel}>
      <BarraTemporada
        temporadas={temporadas}
        seleccionada={temporadaId}
        onCambiar={(id) => setParams({ temporada: id })}
      />

      <div className={styles.cabecera}>
        <div>
          <h3>Plantilla {categoria}</h3>
          <p>Jugadores, dorsales, posiciones y fotos de la temporada elegida.</p>
        </div>
        {listo && jugadores.length > 0 && (
          <div className={styles.acciones}>
            {hayCandidatos && (
              <Button variant="secondary" onClick={() => setIncorporando(true)}>
                Añadir de {candidatos?.origen}
              </Button>
            )}
            <Button onClick={() => abrirEditor(null)}>Añadir jugador</Button>
          </div>
        )}
      </div>

      {contenido}

      {candidatos && (
        <IncorporarDeTemporada
          open={incorporando}
          onClose={() => {
            setIncorporando(false);
            if (otrasCategorias) {
              setOtrasCategorias(false);
              void fetchCandidatos(false);
            }
          }}
          origen={candidatos.origen}
          cargando={cargandoCandidatos}
          conDorsal
          otrasCategorias={{
            activo: otrasCategorias,
            onCambiar: (activo) => {
              setOtrasCategorias(activo);
              void fetchCandidatos(activo);
            },
          }}
          candidatos={candidatosDialogo}
          onConfirmar={handleIncorporar}
        />
      )}

      {editor && (
        <EditorJugador
          key={editor.clave}
          jugador={editor.jugador}
          destino={{ temporadaId, temporadaNombre, categoria }}
          dorsalesOcupados={dorsalesOcupados}
          onCerrar={() => setEditor(null)}
          onGuardado={(guardado, alta) => {
            setEditor(null);
            showToast(
              alta ? `${guardado.nombre} añadido a ${temporadaNombre}` : "Cambios guardados",
            );
            void fetchJugadores();
            void fetchCandidatos(false);
          }}
        />
      )}
    </div>
  );
}
