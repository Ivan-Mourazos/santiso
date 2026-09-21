/**
 * components/admin/cartel/useCartelAssets.ts
 * Carga los recursos fijos del cartel (fondo, logos, patrocinadores) desde la media local.
 */

import { useState, useEffect } from "react";
import { cargarAjustesCartel } from "@/lib/server/acciones/ajustes-cartel";
import type { AssetUrls, TemplateId } from "./types";

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
      const resultado = await cargarAjustesCartel();
      if (!resultado.ok) {
        setAssetUrls(DEFAULT_URLS);
        return;
      }
      const { escudoClub, logoXunta, logoRfgf, ordenLogos, patrocinadores } = resultado.datos;

      setAssetUrls({
        xunta: logoXunta ?? "",
        rfgf: logoRfgf ?? "",
        // El valor antiguo era "xunta_left"; el nuevo, "xunta_izquierda".
        xuntaIsLeft: ordenLogos !== "rfgf_izquierda",
        santiso: escudoClub ?? "",
        // `listarPatrocinadores(true)` ya los devuelve ordenados por `orden`.
        sponsors: patrocinadores
          .map((p) => p.logo_url)
          .filter((u): u is string => typeof u === "string" && u.length > 0),
      });
    }

    loadAssets();
  }, [tipo, refreshKey]);

  return assetUrls;
}
