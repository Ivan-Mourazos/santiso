"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { borrarCompeticion, crearCompeticion } from "@/lib/server/acciones/competiciones";
import { fetchCompeticiones } from "@/lib/supabase-queries";
import {
  competitionsForCategory,
  pickDefaultCompetitionId,
  type CompetenciaRow,
} from "@/lib/competition";

import { COMPETICIONES_2026_2027 } from "@/lib/data/season-2026-2027";

export function useCompeticiones(categoria?: string) {
  const [competicionesCatalog, setCompeticionesCatalog] = useState<
    CompetenciaRow[]
  >(COMPETICIONES_2026_2027);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState("");
  const [loadingCompeticiones, setLoadingCompeticiones] = useState(false);

  const loadCompeticiones = useCallback(async () => {
    setLoadingCompeticiones(true);
    try {
      const list = await fetchCompeticiones();
      const activeList = list && list.length > 0 ? list : COMPETICIONES_2026_2027;
      setCompeticionesCatalog(activeList);
      return activeList;
    } catch {
      setCompeticionesCatalog(COMPETICIONES_2026_2027);
      return COMPETICIONES_2026_2027;
    } finally {
      setLoadingCompeticiones(false);
    }
  }, []);

  useEffect(() => {
    loadCompeticiones();
  }, [loadCompeticiones]);

  useEffect(() => {
    if (!categoria || competicionesCatalog.length === 0) return;
    const def = pickDefaultCompetitionId(competicionesCatalog, categoria);
    setSelectedCompetitionId((prev) => {
      const opts = competitionsForCategory(competicionesCatalog, categoria);
      if (prev && opts.some((o) => o.id === prev)) return prev;
      return def;
    });
  }, [categoria, competicionesCatalog]);

  const competicionesEnCategoria = useMemo(() => {
    if (!categoria) return [];
    return competitionsForCategory(competicionesCatalog, categoria);
  }, [competicionesCatalog, categoria]);

  const addCompeticion = useCallback(
    async (nombre: string, cat: string, formato: string = "liga") => {
      // El orden lo calcula el servidor a partir de las competiciones ya inscritas.
      const resultado = await crearCompeticion({ nombre, categoria: cat, formato });
      if (!resultado.ok) return { data: null, error: new Error(resultado.error) };
      await loadCompeticiones();
      setSelectedCompetitionId(resultado.datos.id);
      return { data: resultado.datos, error: null };
    },
    [loadCompeticiones],
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
    competicionesCatalog,
    selectedCompetitionId,
    setSelectedCompetitionId,
    competicionesEnCategoria,
    loadingCompeticiones,
    loadCompeticiones,
    addCompeticion,
    removeCompeticion,
  };
}
