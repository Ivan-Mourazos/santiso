"use client";

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { generateProximosText, generateResultadoText } from "@/lib/cartel/instagram";
import {
  W, H,
  loadImg,
  drawBackground, drawTopLogos, drawSponsorBar,
  drawPartido, drawResumo, drawCronoloxia, drawProximos, drawNoso11,
} from "@/lib/cartel-draw";

// UI Components & Hooks
import { TEMPLATES } from "./cartel/types";
import { useCartelForm } from "./cartel/useCartelForm";
import { useCartelAssets } from "./cartel/useCartelAssets";
import { Toggle } from "./cartel/Common";
import { FormPartido } from "./cartel/FormPartido";
import { FormResumo } from "./cartel/FormResumo";
import { FormCronoloxia } from "./cartel/FormCronoloxia";
import { FormProximos } from "./cartel/FormProximos";
import { FormNoso11 } from "./cartel/FormNoso11";

// 2K output: logical canvas stays 1080\u00d71350, rendered at 2\u00d7 for high resolution
const RENDER_SCALE = 2;

export default function GeneradorCartel() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const {
    form, set,
    equipos, setEquipos,
    jugFileName,
    handleRivalSelect,
    handleRivalFile,
    handleJugadorFile,
    updatePlayer,
    addEvent,
    updateEvent,
    removeEvent,
    updateMatch,
    dbMatches,
    loadMatchFromDb,
    resetForm,
  } = useCartelForm();

  const [tipo, setTipo] = useState<string>("partido");
  const [copied, setCopied] = useState(false);
  const assetUrls = useCartelAssets(tipo);

  // Load ALL equipos once
  useEffect(() => {
    supabase
      .from("equipos")
      .select("id, nombre, escudo_url, categoria")
      .order("nombre", { ascending: true })
      .then(({ data }) => setEquipos(data || []));
  }, [setEquipos]);

  // ── Canvas draw ─────────────────────────────────────────────────────────────
  const drawCanvas = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    await document.fonts.ready;

    // Load base assets
    const [fondo, xunta, rfgf, santiso, ...sponsorImgs] = await Promise.all([
      loadImg(assetUrls.fondo),
      loadImg(assetUrls.xunta),
      loadImg(assetUrls.rfgf),
      loadImg(assetUrls.santiso),
      ...assetUrls.sponsors.map(u => loadImg(u)),
    ]);

    const assets = {
      fondo, xunta, rfgf, santiso,
      sponsors: sponsorImgs.filter(Boolean) as HTMLImageElement[],
    };

    const rivalImg   = await loadImg(form.rivalEscudoUrl);
    const jugadorImg = tipo === "noso11" ? await loadImg(form.jugadorFotoUrl) : null;

    // Load multiple rival shields for Próximos
    const matchRivalImgs: (HTMLImageElement | null)[] = [];
    if (tipo === "proximos") {
      const results = await Promise.all(form.matches.map(m => loadImg(m.rivalEscudoUrl)));
      matchRivalImgs.push(...results);
    }

    ctx.clearRect(0, 0, W * RENDER_SCALE, H * RENDER_SCALE);
    ctx.save();
    ctx.scale(RENDER_SCALE, RENDER_SCALE);
    
    // 1. Foundation
    drawBackground(ctx, assets.fondo);
    drawTopLogos(ctx, assets.xunta, assets.rfgf, assetUrls.xuntaIsLeft);
    drawSponsorBar(ctx, assets.sponsors);

    // 2. Templates
    const baseP = {
      categoria: form.categoria, competicion: form.competicion, jornada: form.jornada,
      rivalNombre: form.rivalNombre, fecha: form.fecha, hora: form.hora,
      lugar: form.lugar, santisoSide: form.santisoSide,
      rivalEscudoUrl: form.rivalEscudoUrl,
    };

    switch (tipo) {
      case "partido":
        drawPartido(ctx, baseP, rivalImg, assets.santiso);
        break;
      case "resumo":
        drawResumo(ctx, { 
          ...baseP, 
          golesLocal: form.golesLocal, 
          golesRival: form.golesRival,
          showCarouselIndicator: form.showCarouselIndicator 
        }, rivalImg, assets.santiso);
        break;
      case "cronoloxia":
        drawCronoloxia(ctx, {
          categoria: form.categoria, rivalNombre: form.rivalNombre,
          santisoSide: form.santisoSide, fecha: form.fecha, estadio: form.estadio,
          golesLocal: form.golesLocal, golesRival: form.golesRival,
          localSponsor: form.localSponsor, rivalSponsor: form.rivalSponsor,
          events: form.events,
        }, rivalImg, assets.santiso);
        break;
      case "proximos":
        drawProximos(ctx, {
          categoriasText: form.categoriasText,
          matches: form.matches,
          categoria: form.categoria,
        }, assets, assetUrls.xuntaIsLeft, matchRivalImgs);
        break;
      case "noso11":
        drawNoso11(ctx, {
          categoria: form.categoria, fecha: form.fecha, estadio: form.estadio,
          titulares: form.titulares, suplentes: form.suplentes,
          jugadorFotoUrl: form.jugadorFotoUrl,
          jugadorXOffset: form.jugadorXOffset,
          jugadorYOffset: form.jugadorYOffset,
          jugadorZoom:    form.jugadorZoom,
          noso11Flip:     form.noso11Flip,
        }, jugadorImg, assets, assetUrls.xuntaIsLeft);
        break;
    }
    ctx.restore();
  }, [tipo, form, assetUrls]);

  useEffect(() => { drawCanvas(); }, [drawCanvas]);

  // ── Download ────────────────────────────────────────────────────────────────
  function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    const slug = tipo === "partido" || tipo === "resumo"
      ? `jornada-${form.jornada}${form.rivalNombre ? `-vs-${form.rivalNombre.toLowerCase().replace(/\s+/g, "-")}` : ""}`
      : tipo;
    a.download = `cartel-${slug}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // ── Instagram Text ──────────────────────────────────────────────────────────
  const instagramText = useMemo(() => {
    if (tipo === "proximos") {
      return generateProximosText({ matches: form.matches.map(m => ({
        ...m,
        lugar: (m as any).lugar || form.lugar,
        estadio: form.estadio,
      })) });
    }
    if (tipo === "resumo" || tipo === "cronoloxia" || tipo === "noso11") {
      return generateResultadoText({
        categoria:   form.categoria,
        competicion: form.competicion,
        jornada:     form.jornada,
        fecha:       form.fecha,
        estadio:     form.estadio || form.lugar,
        rivalNombre: form.rivalNombre,
        golesLocal:  form.golesLocal,
        golesRival:  form.golesRival,
        santisoSide: form.santisoSide,
        events:      form.events,
      });
    }
    return null;
  }, [tipo, form]);

  function handleCopyInstagram() {
    if (!instagramText) return;
    navigator.clipboard.writeText(instagramText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }


  return (
    <main style={{ minHeight: "100vh", background: "#000", padding: "2rem 0 5rem" }}>
      <div className="container">

        <header style={{ marginBottom: "2.5rem" }}>
          <Link href="/admin" style={{ color: "var(--primary)", fontWeight: 700, fontSize: "0.85rem" }}>
            ← Volver al Panel
          </Link>
          <h1 style={{ fontSize: "2.8rem", fontWeight: 900, marginTop: "0.5rem", letterSpacing: "-1.5px" }}>
            Generador de <span className="text-primary">Carteles</span>
          </h1>
          <p style={{ color: "#666", fontSize: "0.88rem", marginTop: "0.2rem" }}>
            Selecciona la plantilla, rellena los datos y descarga el PNG en alta resolución.
          </p>
        </header>

        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "2rem", flexWrap: "wrap" }}>
          {TEMPLATES.map(t => (
            <button key={t.id} onClick={() => setTipo(t.id)}
              style={{
                padding: "0.55rem 1.1rem", borderRadius: "0.6rem", fontFamily: "inherit",
                fontWeight: 800, fontSize: "0.82rem", cursor: "pointer",
                border: tipo === t.id ? "none" : "1px solid var(--border)",
                background: tipo === t.id ? "var(--primary)" : "rgba(255,255,255,0.04)",
                color: tipo === t.id ? "#000" : "#aaa",
                transition: "all 0.2s",
              }}>
              {t.emoji} {t.label}
            </button>
          ))}
        </div>

        <div className="gen-layout">
          <div className="gen-form card glass">

            {/* Template-specific fields */}
            {tipo === "partido"    && <FormPartido form={form} set={set} equipos={equipos} handleRivalSelect={handleRivalSelect} handleRivalFile={handleRivalFile} dbMatches={dbMatches} loadMatchFromDb={loadMatchFromDb} />}
            {tipo === "resumo"     && <FormResumo form={form} set={set} equipos={equipos} handleRivalSelect={handleRivalSelect} handleRivalFile={handleRivalFile} dbMatches={dbMatches} loadMatchFromDb={loadMatchFromDb} />}
            {tipo === "cronoloxia" && <FormCronoloxia form={form} set={set} equipos={equipos} handleRivalSelect={handleRivalSelect} handleRivalFile={handleRivalFile} addEvent={addEvent} updateEvent={updateEvent} removeEvent={removeEvent} dbMatches={dbMatches} loadMatchFromDb={loadMatchFromDb} />}
            {tipo === "proximos"   && <FormProximos form={form} set={set} updateMatch={updateMatch} equipos={equipos} dbMatches={dbMatches} />}
            {tipo === "noso11"     && <FormNoso11 form={form} set={set} jugFileName={jugFileName} handleJugadorFile={handleJugadorFile} updatePlayer={updatePlayer} />}

            {/* Santiso side (shared) */}
            {(tipo === "partido" || tipo === "resumo" || tipo === "cronoloxia") && (
              <div className="input-group" style={{ marginBottom: "1rem", marginTop: "2.5rem" }}>
                <label>Santiso en el cartel</label>
                <div style={{ display: "flex", gap: "0.6rem" }}>
                  <Toggle label="← Izquierda" active={form.santisoSide === "left"} onClick={() => set("santisoSide", "left")} />
                  <Toggle label="Derecha →"   active={form.santisoSide === "right"} onClick={() => set("santisoSide", "right")} />
                </div>
              </div>
            )}


            <div style={{ display: "flex", gap: "0.6rem", marginTop: "2.5rem" }}>
              <button className="btn-primary" onClick={handleDownload}
                style={{ flex: 1, height: 54, fontSize: "1rem",
                         display: "flex", alignItems: "center", justifyContent: "center", gap: "0.6rem" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
                Descargar 2K PNG
              </button>
              <button onClick={resetForm}
                title="Limpiar todos los campos"
                style={{ height: 54, padding: "0 1.2rem", borderRadius: "var(--radius)",
                         background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)",
                         color: "#888", fontFamily: "inherit", fontWeight: 800, fontSize: "0.82rem",
                         cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem",
                         transition: "all 0.2s" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#e55")}
                onMouseLeave={e => (e.currentTarget.style.color = "#888")}>
                🗑️ Limpiar
              </button>
            </div>

            {/* Instagram Text Panel */}
            {instagramText && (
              <div style={{ marginTop: "2rem", padding: "1.2rem", background: "rgba(255,255,255,0.03)",
                            border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem" }}>
                  <p style={{ fontSize: "0.7rem", fontWeight: 800, textTransform: "uppercase",
                              letterSpacing: "1.5px", color: "var(--primary)", margin: 0 }}>
                    📱 Texto para Instagram
                  </p>
                  <button onClick={handleCopyInstagram}
                    style={{ padding: "0.35rem 0.9rem", borderRadius: "0.5rem", cursor: "pointer",
                             fontFamily: "inherit", fontWeight: 800, fontSize: "0.75rem",
                             background: copied ? "#22c55e" : "rgba(255,255,255,0.08)",
                             color: copied ? "#000" : "#fff",
                             border: "1px solid var(--border)", transition: "all 0.2s" }}>
                    {copied ? "✅ Copiado!" : "📋 Copiar"}
                  </button>
                </div>
                <textarea readOnly value={instagramText}
                  style={{ width: "100%", minHeight: "240px", background: "transparent",
                           border: "none", color: "#ccc", fontFamily: "monospace",
                           fontSize: "0.75rem", lineHeight: 1.7, resize: "vertical",
                           outline: "none", cursor: "text" }} />
              </div>
            )}
          </div>

          <div className="gen-preview">
            <div style={{ position: "sticky", top: "1.5rem" }}>
              <p style={{ fontSize: "0.68rem", fontWeight: 800, textTransform: "uppercase",
                          letterSpacing: "1.5px", color: "#555", marginBottom: "0.75rem" }}>
                Vista previa en tiempo real
              </p>
              <canvas ref={canvasRef} width={W * RENDER_SCALE} height={H * RENDER_SCALE}
                style={{ width: "100%", height: "auto", display: "block",
                         borderRadius: 10, border: "1px solid var(--border)" }} />
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .gen-layout {
          display: grid;
          grid-template-columns: 420px 1fr;
          gap: 2rem;
          align-items: start;
        }
        .gen-form { padding: 2rem; }
        @media (max-width: 960px) {
          .gen-layout { grid-template-columns: 1fr; }
          .gen-preview { order: -1; }
        }
      `}</style>
    </main>
  );
}
