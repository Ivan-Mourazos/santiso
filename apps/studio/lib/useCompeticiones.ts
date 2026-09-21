"use client";
import { useState, useEffect, useCallback, useMemo, useRef, type SetStateAction } from "react";
import { borrarCompeticion, crearCompeticion } from "@/lib/server/acciones/competiciones";
import { cargarContextoStudio } from "@/lib/server/contexto-studio";
import { useOptionalStudio } from "@/components/studio/StudioContext";
import { type Season } from "@/lib/lecturas-cliente";
import {
  competitionsForCategory,
  pickDefaultCompetitionId,
  type CompetenciaRow,
} from "@/lib/competition";

export function resolveContextId(
  requested: string | null,
  options: readonly { id: string }[],
  fallback = "",
): string {
  if (options.some((option) => option.id === requested)) return requested ?? "";
  return options.find((option) => option.id === fallback)?.id ?? options[0]?.id ?? "";
}

export function useCompeticiones(categoria?: string, sincronizarUrl = false) {
  const provider = useOptionalStudio();
  const studio = sincronizarUrl ? provider : null;
  const setParams = studio?.setParams;
  const requestedJornada = studio?.params.get("jornada");
  const requestedSeason = studio?.params.get("temporada") ?? null;
  const [catalog, setCatalog] = useState<(CompetenciaRow & { temporadaId: string })[]>([]);
  const [temporadas, setTemporadas] = useState<Season[]>([]);
  const [localSelection, setLocalSelection] = useState("");
  const [loadingCompeticiones, setLoadingCompeticiones] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [errorCompeticiones, setErrorCompeticiones] = useState<string | null>(null);
  const request = useRef(0);
  const activeSeason = temporadas.find((season) => season.activa)?.id ?? "";
  const selectedSeasonId = resolveContextId(requestedSeason, temporadas, activeSeason);
  const historicalSeason = Boolean(selectedSeasonId && selectedSeasonId !== activeSeason);
  const competicionesCatalog = useMemo(
    () => catalog.filter((competition) => competition.temporadaId === selectedSeasonId),
    [selectedSeasonId, catalog],
  );
  const competicionesEnCategoria = useMemo(
    () => (categoria ? competitionsForCategory(competicionesCatalog, categoria) : []),
    [competicionesCatalog, categoria],
  );
  const requestedCompetition = studio ? studio.params.get("competicion") : localSelection;
  const selectedCompetitionId = resolveContextId(
    requestedCompetition,
    competicionesEnCategoria,
    categoria ? pickDefaultCompetitionId(competicionesCatalog, categoria) : "",
  );
  const setSelectedCompetitionId = useCallback(
    (value: SetStateAction<string>) => {
      const next = typeof value === "function" ? value(selectedCompetitionId) : value;
      if (setParams) setParams({ competicion: next || null, jornada: null });
      else setLocalSelection(next);
    },
    [selectedCompetitionId, setParams],
  );

  const loadCompeticiones = useCallback(async () => {
    const token = ++request.current;
    setLoadingCompeticiones(true);
    try {
      const result = await cargarContextoStudio();
      if (!result.ok) throw new Error(result.error);
      const list = result.datos.competiciones;
      if (token !== request.current) return list;
      setCatalog(list);
      setTemporadas(result.datos.temporadas);
      setLoaded(true);
      setErrorCompeticiones(null);
      return list;
    } catch (error) {
      if (token === request.current) {
        console.error("cargarCompeticiones", error);
        setCatalog([]);
        setErrorCompeticiones("No se pudieron cargar las competiciones.");
      }
      return [];
    } finally {
      if (token === request.current) setLoadingCompeticiones(false);
    }
  }, []);

  useEffect(() => {
    void loadCompeticiones();
    const pendingRequest = request;
    return () => {
      pendingRequest.current++;
    };
  }, [loadCompeticiones]);

  useEffect(() => {
    if (!loaded || loadingCompeticiones || errorCompeticiones || !categoria) return;
    if (setParams) {
      const patch: Record<string, string | null> = {};
      if ((requestedSeason ?? "") !== selectedSeasonId) patch.temporada = selectedSeasonId || null;
      if ((requestedCompetition ?? "") !== selectedCompetitionId) {
        patch.competicion = selectedCompetitionId || null;
        patch.jornada = null;
      }
      if (!selectedCompetitionId && requestedJornada) patch.jornada = null;
      if (Object.keys(patch).length) setParams(patch, true);
    } else setLocalSelection(selectedCompetitionId);
  }, [
    requestedJornada,
    loaded,
    loadingCompeticiones,
    errorCompeticiones,
    categoria,
    setParams,
    requestedSeason,
    selectedSeasonId,
    requestedCompetition,
    selectedCompetitionId,
  ]);

  const addCompeticion = useCallback(
    async (nombre: string, cat: string, formato: string = "liga") => {
      if (historicalSeason)
        return {
          data: null,
          error: new Error("La creación de competiciones requiere consultar la temporada activa."),
        };
      // El orden lo calcula el servidor a partir de las competiciones ya inscritas.
      const resultado = await crearCompeticion({ nombre, categoria: cat, formato });
      if (!resultado.ok) return { data: null, error: new Error(resultado.error) };
      await loadCompeticiones();
      setSelectedCompetitionId(resultado.datos.id);
      return { data: resultado.datos, error: null };
    },
    [historicalSeason, loadCompeticiones, setSelectedCompetitionId],
  );

  const removeCompeticion = useCallback(
    async (id: string) => {
      if (!id) return { error: new Error("ID inválido") };
      const resultado = await borrarCompeticion(id);
      if (!resultado.ok) return { error: new Error(resultado.error) };
      await loadCompeticiones();
      return { error: null };
    },
    [loadCompeticiones],
  );

  return {
    contextoListo:
      loaded &&
      !loadingCompeticiones &&
      (!studio ||
        ((requestedSeason ?? "") === selectedSeasonId &&
          (requestedCompetition ?? "") === selectedCompetitionId)),
    temporadas,
    selectedSeasonId,
    historicalSeason,
    competicionesCatalog,
    selectedCompetitionId,
    setSelectedCompetitionId,
    competicionesEnCategoria,
    loadingCompeticiones,
    errorCompeticiones,
    loadCompeticiones,
    addCompeticion,
    removeCompeticion,
  };
}
