"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStudio } from "@/components/studio/StudioContext";
import type { CampoDto, DescansoDto } from "@/lib/dto";
import {
  fetchMatchdaysForCompetition,
  fetchMatchesForMatchday,
  fetchTeamsForCompetition,
  mergeMissingTeams,
  type LeagueMatch,
  type Matchday,
  type Team,
} from "@/lib/lecturas-cliente";
import { cargarPantallaCalendario } from "@/lib/server/acciones/calendario";
import { cargarPartidosPropiosDeCompeticion } from "@/lib/server/acciones/clasificacion";
import { resolveContextId, useCompeticiones } from "@/lib/useCompeticiones";

/** Lo que se edita de un partido en su fila. */
export type EdicionPartido = Pick<
  LeagueMatch,
  "id" | "goles_local" | "goles_visitante" | "campo_id" | "fecha"
>;

/** Huella de lo editable: si cambia respecto a la cargada, la fila tiene cambios sin guardar. */
export function firmaEdicion(partido: EdicionPartido) {
  return JSON.stringify([
    partido.goles_local,
    partido.goles_visitante,
    partido.campo_id ?? "",
    partido.fecha ?? "",
  ]);
}

/**
 * Datos y selección del calendario. La lógica viene tal cual de `AdminJornadas` (hasta la 6G):
 * la selección vive en la URL, las respuestas de un contexto que ya no es el actual se tiran,
 * y al recargar los partidos se conservan las filas que el usuario estaba editando.
 */
export function useCalendario(categoria: string) {
  const { params, setParams } = useStudio();
  const competiciones = useCompeticiones(categoria, true);
  const { selectedSeasonId, selectedCompetitionId } = competiciones;

  const [jornadas, setJornadas] = useState<Matchday[]>([]);
  const [equipos, setEquipos] = useState<Team[]>([]);
  const [campos, setCampos] = useState<CampoDto[]>([]);
  const [partidos, setPartidos] = useState<LeagueMatch[]>([]);
  const [descansos, setDescansos] = useState<DescansoDto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [jornadasCompetition, setJornadasCompetition] = useState("");

  // Huella de cada partido tal como llegó: la ref la usa la carga asíncrona y el estado, el
  // render (una ref no se puede leer mientras se pinta).
  const originales = useRef(new Map<string, string>());
  const [firmas, setFirmas] = useState<ReadonlyMap<string, string>>(new Map());
  const contextoPartidos = useRef("");
  const partidosActuales = useRef(partidos);
  useEffect(() => {
    partidosActuales.current = partidos;
  }, [partidos]);

  /** «jornada»: los partidos de una jornada. «santiso»: los del club en toda la competición. */
  const vista: "jornada" | "santiso" = params.get("vista") === "santiso" ? "santiso" : "jornada";
  const requestedJornada = params.get("jornada");
  const selectedJornada =
    jornadasCompetition === selectedCompetitionId
      ? resolveContextId(requestedJornada, jornadas) || null
      : null;
  const contextKey = `${vista}/${selectedSeasonId}/${selectedCompetitionId}/${vista === "santiso" ? "" : (selectedJornada ?? "")}`;
  const currentContext = useRef(contextKey);
  const currentCompetition = useRef(selectedCompetitionId);
  useEffect(() => {
    currentContext.current = contextKey;
    currentCompetition.current = selectedCompetitionId;
  }, [contextKey, selectedCompetitionId]);

  const setSelectedJornada = useCallback(
    (id: string | null) => setParams({ jornada: id }),
    [setParams],
  );
  // Si la URL pide una jornada que no existe, se corrige a la que se está enseñando.
  useEffect(() => {
    if (!selectedCompetitionId || jornadasCompetition !== selectedCompetitionId) return;
    if (requestedJornada !== selectedJornada) setParams({ jornada: selectedJornada }, true);
  }, [requestedJornada, selectedJornada, selectedCompetitionId, jornadasCompetition, setParams]);

  const cargarBase = useCallback(async () => {
    try {
      const eData = selectedCompetitionId
        ? await fetchTeamsForCompetition(categoria, selectedCompetitionId)
        : [];
      if (currentCompetition.current !== selectedCompetitionId) return;
      setEquipos(eData || []);
      // Campos: llegan con el resto de la pantalla de calendario.
      const { campos: cData } = await cargarPantallaCalendario(selectedCompetitionId, "");
      setCampos(cData);
    } catch {
      // Sin equipos ni campos la pantalla sigue siendo útil: se ven los partidos igual.
    }
  }, [categoria, selectedCompetitionId]);

  const cargarJornadas = useCallback(async () => {
    if (!selectedSeasonId || !selectedCompetitionId) {
      setJornadas([]);
      setJornadasCompetition("");
      setCargando(false);
      return;
    }
    setCargando(true);
    const { data } = await fetchMatchdaysForCompetition(
      selectedSeasonId,
      categoria,
      selectedCompetitionId,
    );
    if (currentCompetition.current !== selectedCompetitionId) return;
    setJornadas(data);
    setJornadasCompetition(selectedCompetitionId);
    setCargando(false);
  }, [selectedSeasonId, categoria, selectedCompetitionId]);

  const cargarDescansos = useCallback(async () => {
    if (!selectedJornada) return;
    const clave = contextKey;
    const { descansos: filas } = await cargarPantallaCalendario(
      selectedCompetitionId,
      selectedJornada,
    );
    if (currentContext.current === clave) setDescansos(filas);
  }, [selectedJornada, selectedCompetitionId, contextKey]);

  /** `guardadoId`: la fila que se acaba de guardar deja de ser borrador aunque siga cambiada. */
  const cargarPartidos = useCallback(
    async (guardadoId?: string) => {
      if (!selectedCompetitionId || (vista === "jornada" && !selectedJornada)) {
        setPartidos([]);
        return;
      }
      const clave = contextKey;
      const data =
        vista === "santiso"
          ? ((await cargarPartidosPropiosDeCompeticion(
              selectedCompetitionId,
            )) as unknown as LeagueMatch[])
          : (await fetchMatchesForMatchday(selectedJornada!)).data;
      if (currentContext.current !== clave) return;
      const mismoContexto = contextoPartidos.current === clave;
      const borradores = new Map(
        partidosActuales.current
          .filter(
            (p) =>
              mismoContexto &&
              p.id !== guardadoId &&
              originales.current.has(p.id) &&
              originales.current.get(p.id) !== firmaEdicion(p),
          )
          .map((p) => [p.id, p]),
      );
      const anteriores = originales.current;
      originales.current = new Map(
        data.map((p) => [
          p.id,
          borradores.has(p.id) ? (anteriores.get(p.id) ?? firmaEdicion(p)) : firmaEdicion(p),
        ]),
      );
      contextoPartidos.current = clave;
      setFirmas(originales.current);
      setPartidos(data.map((p) => borradores.get(p.id) ?? p));
    },
    [selectedJornada, selectedCompetitionId, contextKey, vista],
  );

  // Las cargas se lanzan fuera del cuerpo del efecto: así el estado no cambia a mitad de render.
  useEffect(() => {
    const id = window.setTimeout(() => void cargarBase(), 0);
    return () => window.clearTimeout(id);
  }, [cargarBase]);
  useEffect(() => {
    const id = window.setTimeout(() => void cargarJornadas(), 0);
    return () => window.clearTimeout(id);
  }, [cargarJornadas]);
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (vista === "santiso") {
        void cargarPartidos();
        setDescansos([]);
      } else if (selectedJornada) {
        void cargarPartidos();
        void cargarDescansos();
      } else {
        setPartidos([]);
        setDescansos([]);
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, [vista, selectedJornada, cargarPartidos, cargarDescansos]);

  // Un partido puede enfrentar a un equipo que no está inscrito en la competición (amistosos,
  // cruces de copa): se completan para poder enseñar su nombre y escudo.
  useEffect(() => {
    if (!partidos.length) return;
    const needed = new Set<string>();
    for (const p of partidos) {
      if (p.equipo_local_id) needed.add(p.equipo_local_id);
      if (p.equipo_visitante_id) needed.add(p.equipo_visitante_id);
    }
    const have = new Set(equipos.map((e) => e.id));
    const missing = [...needed].filter((id) => !have.has(id));
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      const merged = await mergeMissingTeams(equipos, missing);
      if (cancelled || merged.length === equipos.length) return;
      setEquipos(merged);
    })();
    return () => {
      cancelled = true;
    };
  }, [partidos, equipos]);

  /** Cambia un campo de la fila sin guardar; el botón «Guardar» de la fila lo manda. */
  const editarPartido = useCallback((id: string, cambio: Partial<LeagueMatch>) => {
    setPartidos((prev) => prev.map((p) => (p.id === id ? { ...p, ...cambio } : p)));
  }, []);

  const conCambios = useCallback(
    (p: LeagueMatch) => firmas.has(p.id) && firmas.get(p.id) !== firmaEdicion(p),
    [firmas],
  );

  const equiposPorId = useMemo(() => new Map(equipos.map((e) => [e.id, e])), [equipos]);
  const nombreEquipo = useCallback(
    (id?: string | null) => (id && equiposPorId.get(id)?.nombre) || "Desconocido",
    [equiposPorId],
  );
  const escudoEquipo = useCallback(
    (id?: string | null) => (id && equiposPorId.get(id)?.escudo_url) || "",
    [equiposPorId],
  );

  /** Equipos que ya juegan o descansan en la jornada: no se ofrecen para otro partido. */
  const ocupados = useMemo(() => {
    const ids = new Set(descansos.map((d) => d.equipo_id));
    for (const p of partidos) {
      if (p.equipo_local_id) ids.add(p.equipo_local_id);
      if (p.equipo_visitante_id) ids.add(p.equipo_visitante_id);
    }
    return ids;
  }, [descansos, partidos]);

  const setVista = useCallback(
    (nueva: "jornada" | "santiso") => setParams({ vista: nueva === "santiso" ? "santiso" : null }),
    [setParams],
  );

  return {
    ...competiciones,
    vista,
    setVista,
    jornadas,
    equipos,
    campos,
    partidos,
    descansos,
    cargando,
    selectedJornada,
    setSelectedJornada,
    cargarJornadas,
    cargarPartidos,
    cargarDescansos,
    editarPartido,
    conCambios,
    nombreEquipo,
    escudoEquipo,
    ocupados,
  };
}

export type Calendario = ReturnType<typeof useCalendario>;
