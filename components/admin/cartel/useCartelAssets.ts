/**
 * components/admin/cartel/useCartelAssets.ts
 * Hook to fetch and manage static assets (fondo, logos, sponsors) from Supabase.
 */

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase-browser";
import type { AssetUrls, TemplateId } from "./types";

/** Fila mínima devuelta por `cartel_assets`. */
interface CartelAssetRow {
  tipo: string;
  subtipo: string;
  url?: string | null;
  orden?: number | null;
  nombre?: string | null;
}

const DEFAULT_URLS: AssetUrls = {
  xunta: "",
  rfgf: "",
  xuntaIsLeft: true,
  santiso: "",
  sponsors: [],
};

export function useCartelAssets(tipo: TemplateId, refreshKey = 0) {
  const [assetUrls, setAssetUrls] = useState<AssetUrls>(DEFAULT_URLS);

  useEffect(() => {
    async function loadAssets() {
      // 1. Get Santiso shield from storage
      const { data: sd } = supabase.storage.from("fotos").getPublicUrl("escudo_club.webp");
      const santisoUrl = sd?.publicUrl || "";

      // 2. Get assets from cartel_assets table
      const { data: rows } = await supabase.from("cartel_assets").select("*").order("orden");

      if (!rows) {
        setAssetUrls({ ...DEFAULT_URLS, santiso: santisoUrl });
        return;
      }

      const list = rows as CartelAssetRow[];

      const xunta    = list.find((r) => r.tipo === "logo_institucional" && r.subtipo === "xunta")?.url || "";
      const rfgf     = list.find((r) => r.tipo === "logo_institucional" && r.subtipo === "rfgf")?.url  || "";
      const sponsors = list
        .filter((r) => r.tipo === "logo_patrocinador")
        .sort((a, b) => (a.orden || 0) - (b.orden || 0))
        .map((r) => r.url)
        .filter((u): u is string => typeof u === "string" && u.length > 0);

      const configRow = list.find((r) => r.tipo === "config" && r.subtipo === "logo_order");
      const xuntaIsLeft = configRow ? configRow.nombre === "xunta_left" : true;

      setAssetUrls({
        xunta,
        rfgf,
        xuntaIsLeft,
        santiso:  santisoUrl,
        sponsors,
      });
    }

    loadAssets();
  }, [tipo, refreshKey]);

  return assetUrls;
}
