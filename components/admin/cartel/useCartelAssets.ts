/**
 * components/admin/cartel/useCartelAssets.ts
 * Hook to fetch and manage static assets (fondo, logos, sponsors) from Supabase.
 */

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { AssetUrls, TemplateId } from "./types";

const DEFAULT_URLS: AssetUrls = {
  fondo: "/fondo-cartel.png",
  xunta: "",
  rfgf: "",
  santiso: "",
  sponsors: [],
};

export function useCartelAssets(tipo: TemplateId) {
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

      const fondoRow = rows.find(r => r.tipo === "fondo" && r.subtipo === tipo);
      const xunta    = rows.find(r => r.tipo === "logo_institucional" && r.subtipo === "xunta")?.url || "";
      const rfgf     = rows.find(r => r.tipo === "logo_institucional" && r.subtipo === "rfgf")?.url  || "";
      const sponsors = rows.filter(r => r.tipo === "logo_patrocinador")
                           .sort((a, b) => (a.orden || 0) - (b.orden || 0))
                           .map(r => r.url);

      setAssetUrls({
        fondo:    fondoRow?.url || "/fondo-cartel.png",
        xunta,
        rfgf,
        santiso:  santisoUrl,
        sponsors,
      });
    }

    loadAssets();
  }, [tipo]);

  return assetUrls;
}
