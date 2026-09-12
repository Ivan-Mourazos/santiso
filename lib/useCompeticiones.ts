"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase-browser";
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
      if (!nombre.trim() || !cat)
        return { error: new Error("Nombre o categoría inválidos") };

      const existentes = competitionsForCategory(competicionesCatalog, cat);
      const maxOrden = existentes.reduce((max, c) => Math.max(max, c.orden), 0);

      const { data, error } = await supabase
        .from("competiciones")
        .insert([
          {
            categoria: cat,
            nombre: nombre.trim(),
            orden: maxOrden + 10,
            activa: true,
            formato,
          },
        ])
        .select()
        .single();

      if (!error) {
        await loadCompeticiones();
        if (data?.id) setSelectedCompetitionId(data.id);
      }
      return { data, error };
    },
    [competicionesCatalog, loadCompeticiones],
  );

  const removeCompeticion = useCallback(
    async (id: string) => {
      if (!id) return { error: new Error("ID inválido") };
      const { error } = await supabase
        .from("competiciones")
        .delete()
        .eq("id", id);

      if (!error) {
        await loadCompeticiones();
      }
      return { error };
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
