"use client";

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import Link from "next/link";
import { generateProximosText, generateResultadoText, generateMultiusosText, generateClasificacionText } from "@/lib/cartel/instagram";
import {
  W, H,
  loadImg,
  drawBackground, drawTopLogos, drawSponsorBar,
  drawPartido, drawResumo, drawCronoloxia, drawProximos, drawNoso11, drawMultiusos, drawClasificacion,
} from "@/lib/cartel-draw";
import AdminCartelAssets from "./AdminCartelAssets";

// UI Components & Hooks
import { TEMPLATES, type TemplateId } from "./cartel/types";
import { useCartelForm } from "./cartel/useCartelForm";
import { useCartelAssets } from "./cartel/useCartelAssets";
import { Toggle } from "./cartel/Common";
import { FormPartido } from "./cartel/FormPartido";
import { FormResumo } from "./cartel/FormResumo";
import { FormCronoloxia } from "./cartel/FormCronoloxia";
import { FormProximos } from "./cartel/FormProximos";
import { FormNoso11 } from "./cartel/FormNoso11";
import { FormMultiusos } from "./cartel/FormMultiusos";
import { FormClasificacion } from "./cartel/FormClasificacion";

// Output optimizado para Instagram: canvas base 1080x1350, renderizado a 2x (2160x2700) para evitar que IG comprima en exceso
const RENDER_SCALE = 2;

interface Props {
  templateId?: string;
  onTemplateChange?: (id: string) => void;
  hideLayout?: boolean;
}

export default function GeneradorCartel({ templateId, onTemplateChange, hideLayout }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawVersionRef = useRef(0);

  const {
    form, set,
    equipos,
    jugadores,
    campos,
    jugFileName,
    handleRivalSelect,
    handleRivalFile,
    handleJugadorFile,
    handleMultiusosFile,
    updatePlayer,
    swapPlayers,
    addEvent,
    updateEvent,
    removeEvent,
    updateMatch,
    dbMatches,
    loadMatchFromDb,
    resetForm,
    competicionesCatalog,
  } = useCartelForm();

  const [tipoInternal, setTipoInternal] = useState<string>("partido");
  const tipo = templateId || tipoInternal;
  const setTipo = (val: string | ((current: string) => string)) => {
    if (onTemplateChange) onTemplateChange(typeof val === 'function' ? val(tipo) : val);
    else setTipoInternal(val);
  };
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string, onConfirm: () => void } | null>(null);
  const [showAssets, setShowAssets] = useState(false);
  const [assetRefreshKey, setAssetRefreshKey] = useState(0);

  const showToastUI = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const showConfirmUI = (message: string, onConfirm: () => void) => {
    setConfirmDialog({ message, onConfirm });
  };

  const tipoForAssets: TemplateId = TEMPLATES.some(t => t.id === tipo) ? (tipo as TemplateId) : "partido";
  const assetUrls = useCartelAssets(tipoForAssets, assetRefreshKey);

  // ── Canvas draw ─────────────────────────────────────────────────────────────
  const drawCanvas = useCallback(async () => {
    const drawVersion = drawVersionRef.current + 1;
    drawVersionRef.current = drawVersion;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    await document.fonts.ready;
    if (drawVersion !== drawVersionRef.current) return;

    // Load base assets
    const [fondo, xunta, rfgf, santiso, ...sponsorImgs] = await Promise.all([
      loadImg(assetUrls.fondo),
      loadImg(assetUrls.xunta),
      loadImg(assetUrls.rfgf),
      loadImg(assetUrls.santiso),
      ...assetUrls.sponsors.map(u => loadImg(u)),
    ]);
    if (drawVersion !== drawVersionRef.current) return;

    const assets = {
      fondo, xunta, rfgf, santiso,
      sponsors: sponsorImgs.filter(Boolean) as HTMLImageElement[],
    };

    const rivalImg   = await loadImg(form.rivalEscudoUrl);
    const jugadorImg = (tipo === "noso11" || tipo === "multiusos") ? await loadImg(form.jugadorFotoUrl) : null;
    const multiImg1  = tipo === "multiusos" ? await loadImg(form.multiusosImg1Url) : null;
    const multiImg2  = tipo === "multiusos" ? await loadImg(form.multiusosImg2Url) : null;
    if (drawVersion !== drawVersionRef.current) return;

    // Load multiple rival shields for Próximos
    const matchRivalImgs: (HTMLImageElement | null)[] = [];
    if (tipo === "proximos") {
      const results = await Promise.all(form.matches.map(m => loadImg(m.rivalEscudoUrl)));
      matchRivalImgs.push(...results);
    }
    if (drawVersion !== drawVersionRef.current) return;

    ctx.clearRect(0, 0, W * RENDER_SCALE, H * RENDER_SCALE);
    ctx.save();
    ctx.scale(RENDER_SCALE, RENDER_SCALE);
    
    // 1. Foundation
    drawBackground(ctx, assets.fondo, form.categoria);

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
      case "multiusos":
        drawMultiusos(ctx, {
          categoria: form.categoria,
          multiusosTema: form.multiusosTema,
          multiusosTitulo: form.multiusosTitulo,
          multiusosTexto: form.multiusosTexto,
          jugadorXOffset: form.jugadorXOffset,
          jugadorYOffset: form.jugadorYOffset,
          jugadorZoom: form.jugadorZoom,
          showAssets: form.showAssets,
        }, assets, multiImg1, multiImg2, jugadorImg, assetUrls.xuntaIsLeft);
        break;
      case "clasificacion":
        await drawClasificacion(ctx, {
          categoria: form.categoria,
          clasificacionTipo: form.clasificacionTipo,
          clasificacionNombre: form.clasificacionNombre,
          clasificacionData: form.clasificacionData,
          showAssets: form.showAssets,
        }, assets, assetUrls.xuntaIsLeft, loadImg);
        break;
    }

    // 3. Global Assets (Logos and Sponsors) - Drawn last to avoid being obscured by template overlays
    if (form.showAssets) {
      drawTopLogos(ctx, assets.xunta, assets.rfgf, assetUrls.xuntaIsLeft);
      drawSponsorBar(ctx, assets.sponsors);
    }

    ctx.restore();
  }, [tipo, form, assetUrls]);

  useEffect(() => { drawCanvas(); }, [drawCanvas]);

  // ── Instagram Text ──────────────────────────────────────────────────────────
  const instagramText = useMemo(() => {
    if (tipo === "proximos")  return generateProximosText(form);
    if (tipo === "resumo")    return generateResultadoText(form);
    if (tipo === "multiusos") return generateMultiusosText(form);
    if (tipo === "clasificacion") return generateClasificacionText(form);
    return null;
  }, [tipo, form]);
  const instagramMeta = useMemo(() => {
    if (tipo === "proximos") {
      return {
        title: "Agenda fin de semana",
        detail: "Usa rival, categoría, fecha, hora, localía e campo de cada partido.",
      };
    }
    if (tipo === "resumo") {
      return {
        title: "Resultado da xornada",
        detail:
          form.events.length > 0
            ? "Usa marcador, competición, data, rival, goles e tarxetas cargadas."
            : "Usa marcador e datos básicos. Engade eventos para listar goleadores e tarxetas.",
      };
    }
    if (tipo === "multiusos") {
      return {
        title: "Comunicado o Aviso",
        detail: "Genera el texto de aviso y hashtags según categoría e información proporcionada.",
      };
    }
    if (tipo === "clasificacion") {
      return {
        title: "Clasificación",
        detail: "Genera el texto para mostrar que se publica la clasificación actualizada.",
      };
    }
    return null;
  }, [tipo, form.events.length]);

  function handleCopyInstagram() {
    if (!instagramText) return;
    navigator.clipboard
      .writeText(instagramText)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => showToastUI("No se pudo copiar el texto", "error"));
  }

  const handleDownload = useCallback(() => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `cartel-${tipo}-${new Date().getTime()}.jpg`;
    link.href = canvasRef.current.toDataURL("image/jpeg", 1.0);
    link.click();
  }, [tipo]);

  return (
    <main style={hideLayout ? {} : { minHeight: "100vh", background: "#000", padding: "3rem 0 5rem" }}>
      <div className={hideLayout ? "" : "container"}>
        {!hideLayout && (
          <>
            <header style={{ marginBottom: "3.5rem", borderLeft: "4px solid var(--primary)", paddingLeft: "2rem", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              <div>
                <Link href="/admin" style={{ 
                  display: "inline-flex", alignItems: "center", gap: "0.5rem",
                  color: "#666", fontWeight: 800, fontSize: "0.75rem", textDecoration: "none",
                  textTransform: "uppercase", letterSpacing: "1px", marginBottom: "1rem",
                  transition: "all 0.2s"
                }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--primary)")}
                onMouseLeave={e => (e.currentTarget.style.color = "#666")}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                  Volver al Panel
                </Link>
                <h1 style={{ fontSize: "3.8rem", fontWeight: 900, marginTop: "0", letterSpacing: "-2.5px", lineHeight: 1 }}>
                  Generador de <span className="text-primary">Carteles</span>
                </h1>
              </div>
              <button 
                onClick={() => setShowAssets(true)}
                style={{
                  padding: "0.75rem 1.5rem", borderRadius: "0.8rem", 
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", 
                  color: "#fff", fontWeight: 800, fontSize: "0.8rem", textTransform: "uppercase",
                  letterSpacing: "1px", cursor: "pointer", display: "flex",
                  alignItems: "center", gap: "0.6rem", transition: "all 0.2s"
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--primary)"; e.currentTarget.style.color = "#000"; e.currentTarget.style.borderColor = "var(--primary)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle>
                </svg>
                Configurar Activos
              </button>
            </header>

            <div style={{ display: "flex", gap: "0.8rem", marginBottom: "3rem", flexWrap: "wrap" }}>
              {TEMPLATES.map(t => (
                <button key={t.id} onClick={() => setTipo(t.id)}
                  style={{
                    padding: "0.75rem 1.5rem", borderRadius: "0.8rem", fontFamily: "inherit",
                    fontWeight: 800, fontSize: "0.85rem", cursor: "pointer",
                    border: "1px solid",
                    borderColor: tipo === t.id ? "rgba(250, 204, 21, 0.4)" : "rgba(255,255,255,0.05)",
                    background: tipo === t.id ? "var(--primary)" : "rgba(255,255,255,0.02)",
                    color: tipo === t.id ? "#000" : "#888",
                    boxShadow: tipo === t.id ? "0 4px 15px rgba(250, 204, 21, 0.2)" : "none",
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    display: "flex", alignItems: "center", gap: "0.6rem"
                  }}>
                  <span style={{ fontSize: "1.1rem" }}>{t.emoji}</span> {t.label}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="gen-layout">
          <div className="gen-form card glass">
            {/* Template-specific fields */}
            {tipo === "partido"    && <FormPartido form={form} set={set} equipos={equipos} handleRivalSelect={handleRivalSelect} handleRivalFile={handleRivalFile} dbMatches={dbMatches} loadMatchFromDb={loadMatchFromDb} campos={campos} competiciones={competicionesCatalog} tipo={tipo} />}
            {tipo === "resumo"     && <FormResumo form={form} set={set} equipos={equipos} handleRivalSelect={handleRivalSelect} handleRivalFile={handleRivalFile} dbMatches={dbMatches} loadMatchFromDb={loadMatchFromDb} campos={campos} competiciones={competicionesCatalog} tipo={tipo} />}
            {tipo === "cronoloxia" && <FormCronoloxia form={form} set={set} equipos={equipos} jugadores={jugadores} handleRivalSelect={handleRivalSelect} handleRivalFile={handleRivalFile} addEvent={addEvent} updateEvent={updateEvent} removeEvent={removeEvent} dbMatches={dbMatches} loadMatchFromDb={loadMatchFromDb} tipo={tipo} />}
            {tipo === "proximos"   && <FormProximos form={form} set={set} updateMatch={updateMatch} equipos={equipos} dbMatches={dbMatches} />}
            {tipo === "noso11"     && <FormNoso11 form={form} set={set} jugadores={jugadores} jugFileName={jugFileName} handleJugadorFile={handleJugadorFile} updatePlayer={updatePlayer} swapPlayers={swapPlayers} dbMatches={dbMatches} loadMatchFromDb={loadMatchFromDb} tipo={tipo} />}
            {tipo === "multiusos"  && <FormMultiusos form={form} set={set} handleMultiusosFile={handleMultiusosFile} jugadores={jugadores} jugFileName={jugFileName} handleJugadorFile={handleJugadorFile} />}
            {tipo === "clasificacion" && <FormClasificacion form={form} set={set} />}

            {/* Santiso side (shared) */}
            {(tipo === "partido" || tipo === "resumo" || tipo === "cronoloxia" || tipo === "clasificacion") && (
              <div className="input-group" style={{ marginBottom: "1rem", marginTop: "2.5rem" }}>
                <label>Santiso en el cartel</label>
                <div style={{ display: "flex", gap: "0.6rem" }}>
                  <Toggle label="← Izquierda" active={form.santisoSide === "left"} onClick={() => set("santisoSide", "left")} />
                  <Toggle label="Derecha →"   active={form.santisoSide === "right"} onClick={() => set("santisoSide", "right")} />
                </div>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "2.5rem" }}>
              <button className="btn-primary" onClick={handleDownload}
                style={{ height: 54, fontSize: "1rem", width: "100%",
                         display: "flex", alignItems: "center", justifyContent: "center", gap: "0.6rem" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
                Descargar JPG (Alta Calidad IG)
              </button>
              <button onClick={resetForm}
                style={{ background: "none", border: "none", color: "#666", fontSize: "0.8rem",
                         textDecoration: "underline", cursor: "pointer", alignSelf: "center" }}>
                Limpiar datos
              </button>
            </div>

            {/* Instagram Text Panel */}
            {instagramText && (
              <div style={{ marginTop: "2rem", padding: "1.2rem", background: "rgba(255,255,255,0.03)",
                            border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem" }}>
                  <div>
                    <p style={{ fontSize: "0.7rem", fontWeight: 800, textTransform: "uppercase",
                                letterSpacing: "1.5px", color: "var(--primary)", margin: 0 }}>
                      Texto para Instagram
                    </p>
                    {instagramMeta && (
                      <p style={{ margin: "0.25rem 0 0", color: "#777", fontSize: "0.75rem", lineHeight: 1.4 }}>
                        {instagramMeta.title}: {instagramMeta.detail}
                      </p>
                    )}
                  </div>
                  <button onClick={handleCopyInstagram}
                    style={{ background: copied ? "var(--primary)" : "rgba(255,255,255,0.05)",
                             color: copied ? "#000" : "#fff", padding: "0.3rem 0.7rem",
                             borderRadius: "0.4rem", fontSize: "0.65rem", fontWeight: 800, cursor: "pointer",
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
            <div style={{ position: "sticky", top: "88px", background: "rgba(255,255,255,0.01)", borderRadius: "1.5rem", border: "1px solid rgba(255,255,255,0.05)", boxShadow: "0 20px 40px rgba(0,0,0,0.4)", overflow: "hidden" }}>
              <div style={{ padding: "1.2rem 1.5rem", borderBottom: "1px solid rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <p style={{ fontSize: "0.7rem", fontWeight: 900, textTransform: "uppercase",
                            letterSpacing: "1.5px", color: "var(--primary)", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ width: "8px", height: "8px", background: "var(--primary)", borderRadius: "50%", display: "inline-block" }}></span>
                  Previsualización Óptima
                </p>
                <span style={{ fontSize: "0.6rem", color: "#444", fontWeight: 800 }}>{W * RENDER_SCALE}x{H * RENDER_SCALE}px</span>
              </div>
              
              <div style={{ padding: "1rem", background: "#000", display: "flex", justifyContent: "center" }}>
                <canvas ref={canvasRef} width={W * RENDER_SCALE} height={H * RENDER_SCALE}
                  style={{ maxWidth: "100%", maxHeight: "calc(100vh - 250px)",
                           width: "auto", height: "auto", display: "block", margin: "0 auto",
                           borderRadius: "0.8rem", boxShadow: "0 10px 40px rgba(0,0,0,0.8)" }} />
              </div>

              <div style={{ padding: "1rem", borderTop: "1px solid rgba(255,255,255,0.03)", background: "rgba(255,255,255,0.01)" }}>
                <p style={{ color: "#555", fontSize: "0.7rem", textAlign: "center", margin: 0, fontWeight: 600 }}>
                   💡 El archivo final preservará la máxima fidelidad y transparencia.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* NOTIFICACIONES Y MODALES */}
      {confirmDialog && (
        <div className="confirm-overlay">
          <div className="confirm-modal glass scale-in">
            <h3>¿Estás seguro?</h3>
            <p>{confirmDialog.message}</p>
            <div className="confirm-actions">
              <button className="btn-cancel" onClick={() => setConfirmDialog(null)}>Cancelar</button>
              <button className="btn-confirm" onClick={() => {
                confirmDialog.onConfirm();
                setConfirmDialog(null);
              }}>Aceptar</button>
            </div>
          </div>
        </div>
      )}

      {showAssets && (
        <div className="modal-overlay">
          <div className="modal-content glass scale-in" style={{ width: "90%", maxWidth: "900px", padding: "2.5rem", borderRadius: "1.5rem", border: "1px solid rgba(255,255,255,0.1)", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
              <h2 style={{ margin: 0, fontSize: "1.8rem", fontWeight: 900, display: "flex", alignItems: "center", gap: "0.8rem" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle>
                </svg>
                Configuración de Activos Base
              </h2>
              <button onClick={() => setShowAssets(false)} style={{ background: "rgba(255,255,255,0.05)", border: "none", color: "#fff", width: "40px", height: "40px", borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <p style={{ color: "#aaa", fontSize: "0.85rem", marginBottom: "2rem" }}>Estos son los recursos globales que se aplican automáticamente a todos los carteles. Aquí puedes modificar fondos, logotipos y patrocinadores.</p>
            <AdminCartelAssets
              showToast={showToastUI}
              showConfirm={showConfirmUI}
              onAssetsChanged={() => setAssetRefreshKey((key) => key + 1)}
            />
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast-container glass ${toast.type}`}>
          <div className="toast-content">
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      <style jsx>{`
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 9000; }
        .gen-layout {
          display: grid;
          grid-template-columns: 420px 1fr;
          gap: 2rem;
          align-items: start;
        }
        .gen-form { padding: 2rem; }
        
        /* Toast & Confirm (Minimal Copy) */
        .toast-container { position: fixed; bottom: 2rem; right: 2rem; z-index: 9999; padding: 1rem 1.5rem; border-radius: 1rem; border: 1px solid var(--primary); background: rgba(250, 204, 21, 0.1); }
        .toast-content { font-weight: 700; color: white; }
        .confirm-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 10000; }
        .confirm-modal { max-width: 400px; padding: 2.5rem; border-radius: 1.5rem; text-align: center; border: 1px solid rgba(250, 204, 21, 0.2); }
        .confirm-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 2rem; }
        .btn-cancel { background: rgba(255,255,255,0.05); border: 1px solid var(--border); color: white; padding: 0.8rem; border-radius: 0.8rem; cursor: pointer; }
        .btn-confirm { background: var(--primary); border: none; color: black; padding: 0.8rem; border-radius: 0.8rem; font-weight: 800; cursor: pointer; }

        .scale-in { animation: scaleIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        @keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }

        @media (max-width: 960px) {
          .gen-layout { grid-template-columns: 1fr; }
          .gen-preview { order: -1; }
        }
      `}</style>
    </main>
  );
}
