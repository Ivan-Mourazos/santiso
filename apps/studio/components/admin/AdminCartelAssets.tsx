"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import type { AjustesCartelDto } from "@/lib/dto";
import { prepararImagen } from "@/lib/imagen-cliente";
import { LOGOS_EN_CARTEL } from "@/lib/patrocinadores/modelo";
import {
  cargarAjustesCartel,
  guardarLogoAjuste,
  guardarOrdenLogos,
} from "@/lib/server/acciones/ajustes-cartel";
import BusyBanner from "./BusyBanner";

interface Props {
  showToast: (msg: string, type?: "success" | "error") => void;
  onAssetsChanged?: () => void;
}

/** Logos institucionales: cada uno vive en su propia clave de `ajustes`. */
const INST_LOGOS = [
  { clave: "cartel.logo_xunta", campo: "logoXunta", label: "Xunta de Galicia", hint: "Esquina superior" },
  { clave: "cartel.logo_rfgf", campo: "logoRfgf", label: "RFGF", hint: "Esquina superior" },
] as const;

const AJUSTES_VACIOS: AjustesCartelDto = {
  escudoClub: null,
  logoXunta: null,
  logoRfgf: null,
  ordenLogos: "xunta_izquierda",
  patrocinadores: [],
};

export default function AdminCartelAssets({ showToast, onAssetsChanged }: Props) {
  const [ajustes, setAjustes] = useState<AjustesCartelDto>(AJUSTES_VACIOS);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [isFetching, setIsFetching] = useState(true);
  const [uploadProgress, setUploadProgress] = useState<number | undefined>(undefined);

  useEffect(() => { fetchAssets(); }, []);

  async function fetchAssets() {
    setIsFetching(true);
    const resultado = await cargarAjustesCartel();
    if (resultado.ok) setAjustes(resultado.datos);
    else showToast(resultado.error, "error");
    setIsFetching(false);
  }

  /** Logo institucional o escudo: una imagen apuntada desde una clave de `ajustes`. */
  async function subirLogoAjuste(file: File, clave: string, label: string) {
    setLoading(p => ({ ...p, [clave]: true }));
    setUploadProgress(30);
    try {
      const cuerpo = new FormData();
      cuerpo.set("imagen", await prepararImagen(file));
      setUploadProgress(80);
      const resultado = await guardarLogoAjuste(clave, cuerpo);
      if (resultado.ok) {
        showToast(`${label} actualizado correctamente`);
        fetchAssets();
        onAssetsChanged?.();
      } else {
        showToast(resultado.error, "error");
      }
    } finally {
      setLoading(p => ({ ...p, [clave]: false }));
      setUploadProgress(undefined);
    }
  }

  async function cambiarOrdenLogos(orden: string) {
    const resultado = await guardarOrdenLogos(orden);
    if (!resultado.ok) {
      showToast(resultado.error, "error");
      return;
    }
    fetchAssets();
    onAssetsChanged?.();
  }

  const sponsors = ajustes.patrocinadores;
  const isUploading = Object.values(loading).some(Boolean);

  // Upload input helper
  function UploadZone({
    label, hint, url, isLoading, onFile,
  }: {
    label: string; hint?: string; url?: string;
    isLoading: boolean;
    onFile: (f: File) => void;
  }) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        {url ? (
          <Image src={url} alt={label} width={56} height={56}
            style={{ width: 56, height: 56, objectFit: "contain",
                     background: "rgba(255,255,255,0.04)", borderRadius: 8 }} />
        ) : (
          <div style={{ width: 56, height: 56, background: "rgba(255,255,255,0.04)",
                        borderRadius: 8, display: "flex", alignItems: "center",
                        justifyContent: "center", color: "#555", fontSize: 10 }}>
            Sin logo
          </div>
        )}
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 800, fontSize: "0.9rem", color: "white", margin: 0 }}>{label}</p>
          {hint && <p style={{ fontSize: "0.72rem", color: "#666", margin: "2px 0 6px" }}>{hint}</p>}
          <label className="file-input-label" style={{ width: "auto", padding: "0 1rem", height: 36 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
            </svg>
            {isLoading ? "Subiendo..." : "Subir / Actualizar"}
            <input type="file" className="hidden-input" accept="image/*"
              disabled={isLoading}
              onChange={e => { if (e.target.files?.[0]) onFile(e.target.files[0]); }} />
          </label>
        </div>
      </div>
    );
  }

  const sectionTitle = (txt: string) => (
    <p style={{ fontSize: "0.7rem", fontWeight: 800, textTransform: "uppercase",
                letterSpacing: "1.5px", color: "var(--primary)", margin: "1.8rem 0 1rem" }}>
      {txt}
    </p>
  );

  return (
    <div className="card glass">
      <BusyBanner show={isFetching || isUploading} text={isFetching ? "Cargando activos de carteles..." : "Procesando y subiendo imagen..."} progress={isUploading ? uploadProgress : undefined} />
      <h3>Activos del Generador de Carteles</h3>
      <p style={{ color: "#a3a3a3", fontSize: "0.85rem", marginTop: "0.25rem" }}>
        Sube aquí los logos institucionales y los patrocinadores. El generador los carga automáticamente.
      </p>

      {/* ── Configuración global ─────────────────────────────────────────── */}
      {sectionTitle("Configuración de Cabecera")}
      <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", background: "rgba(255,255,255,0.03)", padding: "1rem", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 800, fontSize: "0.9rem", color: "white", margin: 0 }}>Posición de logotipos</p>
          <p style={{ fontSize: "0.72rem", color: "#666", margin: "2px 0 0" }}>Determina qué logo va a la izquierda (Xunta o RFGF).</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={() => cambiarOrdenLogos("xunta_izquierda")}
            style={ ajustes.ordenLogos !== "rfgf_izquierda" ? activeBtnStyle : inactiveBtnStyle }>
            Xunta Izquierda
          </button>
          <button
            onClick={() => cambiarOrdenLogos("rfgf_izquierda")}
            style={ ajustes.ordenLogos === "rfgf_izquierda" ? activeBtnStyle : inactiveBtnStyle }>
            RFGF Izquierda
          </button>
        </div>
      </div>

      {/* ── Logos institucionales ──────────────────────────────────────────── */}
      {sectionTitle("Logos Institucionales")}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        {INST_LOGOS.map(({ clave, campo, label, hint }) => (
          <UploadZone
            key={clave}
            label={label}
            hint={hint}
            url={ajustes[campo] ?? undefined}
            isLoading={!!loading[clave]}
            onFile={f => subirLogoAjuste(f, clave, label)}
          />
        ))}
      </div>

      {/* ── Patrocinadores ─────────────────────────────────────────────────── */}
      {/* Solo lectura desde la 6D: altas, bajas y orden se gestionan en el catálogo único. */}
      {sectionTitle("Patrocinadores (barra inferior)")}
      <p style={{ color: "#666", fontSize: "0.8rem", marginTop: "-0.5rem", marginBottom: "1rem" }}>
        El generador pinta estos {LOGOS_EN_CARTEL} logos, en este orden. Se eligen y se ordenan en{" "}
        <Link href="/admin/patrocinadores" style={{ color: "var(--primary)", fontWeight: 700 }}>
          Patrocinadores y logos
        </Link>
        .
      </p>

      {sponsors.length === 0 ? (
        <p style={{ color: "#666", fontSize: "0.85rem", margin: 0 }}>
          Ningún logo activado todavía.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
          {sponsors.slice(0, LOGOS_EN_CARTEL).map((sp, i) => (
            <div key={sp.id} style={{
              display: "flex", alignItems: "center", gap: "1rem",
              background: "rgba(255,255,255,0.03)", borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.06)", padding: "0.75rem 1rem",
            }}>
              <span style={{ color: "var(--primary)", fontWeight: 900, fontSize: "0.85rem", width: 20 }}>
                {i + 1}
              </span>
              <Image src={sp.logo_url ?? ""} alt={sp.nombre} width={52} height={36}
                style={{ width: 52, height: 36, objectFit: "contain",
                         background: "rgba(255,255,255,0.04)", borderRadius: 6 }} />
              <span style={{ flex: 1, fontWeight: 700, fontSize: "0.9rem" }}>{sp.nombre}</span>
            </div>
          ))}
        </div>
      )}

      {sponsors.length > LOGOS_EN_CARTEL && (
        <p style={{ color: "var(--warning, #f59e0b)", fontSize: "0.8rem", marginTop: "0.9rem" }}>
          Hay {sponsors.length - LOGOS_EN_CARTEL} logo(s) activados de más que no caben en el
          cartel. Cámbialos en Patrocinadores y logos.
        </p>
      )}
    </div>
  );
}

const activeBtnStyle: React.CSSProperties = {
  padding: "0.5rem 1rem", borderRadius: "0.5rem", border: "none",
  background: "var(--primary)", color: "#000", fontWeight: 800, cursor: "pointer", fontSize: "0.75rem"
};

const inactiveBtnStyle: React.CSSProperties = {
  padding: "0.5rem 1rem", borderRadius: "0.5rem", border: "1px solid var(--border)",
  background: "rgba(255,255,255,0.04)", color: "#aaa", fontWeight: 800, cursor: "pointer", fontSize: "0.75rem"
};
