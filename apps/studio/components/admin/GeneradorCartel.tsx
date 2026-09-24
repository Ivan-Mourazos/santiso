"use client";

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import Link from "next/link";
import {
  generateProximosText,
  generateResultadoText,
  generateMultiusosText,
  generateClasificacionText,
} from "@/lib/cartel/instagram";
import {
  W,
  H,
  loadImg,
  drawBackground,
  drawTopLogos,
  drawSponsorBar,
  drawPartido,
  drawResumo,
  drawCronoloxia,
  drawProximos,
  drawNoso11,
  drawMultiusos,
  drawClasificacion,
} from "@/lib/cartel-draw";

// UI Components & Hooks
import { TEMPLATES, type TemplateId } from "./cartel/types";
import { useCartelForm } from "./cartel/useCartelForm";
import { Button } from "@/components/ui/foundation/Button";
import AvisoError from "./AvisoError";
import styles from "./cartel/Cartel.module.css";
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
  /** Plantilla elegida en la cabecera del panel (`?plantilla=`). */
  templateId?: string;
  /** Partido que cargar al abrir, desde la pantalla «Jornada». */
  partidoInicial?: string | null;
  /** «Próximos encuentros» abierto desde «Jornada»: se rellena solo. */
  rellenarProximos?: boolean;
  showToast: (msg: string, type?: "success" | "error") => void;
}

export default function GeneradorCartel({
  templateId,
  partidoInicial,
  rellenarProximos = false,
  showToast,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawVersionRef = useRef(0);

  const {
    form,
    set,
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
    handleMatchRivalFile,
    dbMatches,
    loadMatchFromDb,
    resetForm,
    competicionesCatalog,
    errorDatos,
  } = useCartelForm(partidoInicial);

  const tipo = templateId || "partido";
  const [copied, setCopied] = useState(false);

  const tipoForAssets: TemplateId = TEMPLATES.some((t) => t.id === tipo)
    ? (tipo as TemplateId)
    : "partido";
  const assetUrls = useCartelAssets(tipoForAssets);

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
    const [xunta, rfgf, santiso, ...sponsorImgs] = await Promise.all([
      loadImg(assetUrls.xunta),
      loadImg(assetUrls.rfgf),
      loadImg(assetUrls.santiso),
      ...assetUrls.sponsors.map((u) => loadImg(u)),
    ]);
    if (drawVersion !== drawVersionRef.current) return;

    const assets = {
      xunta,
      rfgf,
      santiso,
      sponsors: sponsorImgs.filter(Boolean) as HTMLImageElement[],
    };

    const rivalImg = await loadImg(form.rivalEscudoUrl);
    const jugadorImg =
      tipo === "noso11" || tipo === "multiusos" ? await loadImg(form.jugadorFotoUrl) : null;
    const multiImg1 = tipo === "multiusos" ? await loadImg(form.multiusosImg1Url) : null;
    const multiImg2 = tipo === "multiusos" ? await loadImg(form.multiusosImg2Url) : null;
    if (drawVersion !== drawVersionRef.current) return;

    // Load multiple rival shields for Próximos
    const matchRivalImgs: (HTMLImageElement | null)[] = [];
    if (tipo === "proximos") {
      const results = await Promise.all(form.matches.map((m) => loadImg(m.rivalEscudoUrl)));
      matchRivalImgs.push(...results);
    }
    if (drawVersion !== drawVersionRef.current) return;

    ctx.clearRect(0, 0, W * RENDER_SCALE, H * RENDER_SCALE);
    ctx.save();
    ctx.scale(RENDER_SCALE, RENDER_SCALE);

    // 1. Foundation
    drawBackground(ctx, form.categoria);

    // 2. Templates
    const baseP = {
      categoria: form.categoria,
      competicion: form.competicion,
      jornada: form.jornada,
      rivalNombre: form.rivalNombre,
      fecha: form.fecha,
      hora: form.hora,
      lugar: form.lugar,
      santisoSide: form.santisoSide,
      rivalEscudoUrl: form.rivalEscudoUrl,
    };

    switch (tipo) {
      case "partido":
        drawPartido(ctx, baseP, rivalImg, assets.santiso);
        break;
      case "resumo":
        drawResumo(
          ctx,
          {
            ...baseP,
            golesLocal: form.golesLocal,
            golesRival: form.golesRival,
            showCarouselIndicator: form.showCarouselIndicator,
          },
          rivalImg,
          assets.santiso,
        );
        break;
      case "cronoloxia":
        drawCronoloxia(
          ctx,
          {
            categoria: form.categoria,
            rivalNombre: form.rivalNombre,
            santisoSide: form.santisoSide,
            fecha: form.fecha,
            estadio: form.estadio,
            golesLocal: form.golesLocal,
            golesRival: form.golesRival,
            localSponsor: form.localSponsor,
            rivalSponsor: form.rivalSponsor,
            events: form.events,
          },
          rivalImg,
          assets.santiso,
        );
        break;
      case "proximos":
        drawProximos(
          ctx,
          {
            categoriasText: form.categoriasText,
            matches: form.matches,
            categoria: form.categoria,
          },
          assets,
          assetUrls.xuntaIsLeft,
          matchRivalImgs,
        );
        break;
      case "noso11":
        drawNoso11(
          ctx,
          {
            categoria: form.categoria,
            fecha: form.fecha,
            estadio: form.estadio,
            titulares: form.titulares,
            suplentes: form.suplentes,
            jugadorFotoUrl: form.jugadorFotoUrl,
            jugadorXOffset: form.jugadorXOffset,
            jugadorYOffset: form.jugadorYOffset,
            jugadorZoom: form.jugadorZoom,
            noso11Flip: form.noso11Flip,
          },
          jugadorImg,
          assets,
          assetUrls.xuntaIsLeft,
        );
        break;
      case "multiusos":
        drawMultiusos(
          ctx,
          {
            categoria: form.categoria,
            multiusosTema: form.multiusosTema,
            multiusosTitulo: form.multiusosTitulo,
            multiusosTexto: form.multiusosTexto,
            jugadorXOffset: form.jugadorXOffset,
            jugadorYOffset: form.jugadorYOffset,
            jugadorZoom: form.jugadorZoom,
            showAssets: form.showAssets,
          },
          assets,
          multiImg1,
          multiImg2,
          jugadorImg,
          assetUrls.xuntaIsLeft,
        );
        break;
      case "clasificacion":
        await drawClasificacion(
          ctx,
          {
            categoria: form.categoria,
            clasificacionTipo: form.clasificacionTipo,
            clasificacionNombre: form.clasificacionNombre,
            clasificacionData: form.clasificacionData,
            showAssets: form.showAssets,
          },
          assets,
          assetUrls.xuntaIsLeft,
          loadImg,
        );
        break;
    }

    // 3. Global Assets (Logos and Sponsors) - Drawn last to avoid being obscured by template overlays
    if (form.showAssets) {
      drawTopLogos(ctx, assets.xunta, assets.rfgf, assetUrls.xuntaIsLeft);
      drawSponsorBar(ctx, assets.sponsors);
    }

    ctx.restore();
  }, [tipo, form, assetUrls]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  // ── Instagram Text ──────────────────────────────────────────────────────────
  const instagramText = useMemo(() => {
    if (tipo === "proximos") return generateProximosText(form);
    if (tipo === "resumo") return generateResultadoText(form);
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
      .catch(() => showToast("No se pudo copiar el texto", "error"));
  }

  const handleDownload = useCallback(() => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `cartel-${tipo}-${new Date().getTime()}.jpg`;
    link.href = canvasRef.current.toDataURL("image/jpeg", 1.0);
    link.click();
  }, [tipo]);

  return (
    <div className={styles.pantalla}>
      <AvisoError mensaje={errorDatos} />
      <div className={styles.columnas}>
        <div className={styles.formulario}>
          {/* Template-specific fields */}
          {tipo === "partido" && (
            <FormPartido
              form={form}
              set={set}
              equipos={equipos}
              handleRivalSelect={handleRivalSelect}
              handleRivalFile={handleRivalFile}
              dbMatches={dbMatches}
              loadMatchFromDb={loadMatchFromDb}
              campos={campos}
              competiciones={competicionesCatalog}
              tipo={tipo}
            />
          )}
          {tipo === "resumo" && (
            <FormResumo
              form={form}
              set={set}
              equipos={equipos}
              handleRivalSelect={handleRivalSelect}
              handleRivalFile={handleRivalFile}
              dbMatches={dbMatches}
              loadMatchFromDb={loadMatchFromDb}
              campos={campos}
              competiciones={competicionesCatalog}
              tipo={tipo}
            />
          )}
          {tipo === "cronoloxia" && (
            <FormCronoloxia
              form={form}
              set={set}
              equipos={equipos}
              jugadores={jugadores}
              handleRivalSelect={handleRivalSelect}
              handleRivalFile={handleRivalFile}
              addEvent={addEvent}
              updateEvent={updateEvent}
              removeEvent={removeEvent}
              dbMatches={dbMatches}
              loadMatchFromDb={loadMatchFromDb}
              tipo={tipo}
            />
          )}
          {tipo === "proximos" && (
            <FormProximos
              form={form}
              set={set}
              updateMatch={updateMatch}
              handleMatchRivalFile={handleMatchRivalFile}
              equipos={equipos}
              dbMatches={dbMatches}
              rellenarAlAbrir={rellenarProximos}
            />
          )}
          {tipo === "noso11" && (
            <FormNoso11
              form={form}
              set={set}
              jugadores={jugadores}
              jugFileName={jugFileName}
              handleJugadorFile={handleJugadorFile}
              updatePlayer={updatePlayer}
              swapPlayers={swapPlayers}
              dbMatches={dbMatches}
              loadMatchFromDb={loadMatchFromDb}
              tipo={tipo}
            />
          )}
          {tipo === "multiusos" && (
            <FormMultiusos
              form={form}
              set={set}
              handleMultiusosFile={handleMultiusosFile}
              jugadores={jugadores}
              jugFileName={jugFileName}
              handleJugadorFile={handleJugadorFile}
            />
          )}
          {tipo === "clasificacion" && <FormClasificacion form={form} set={set} />}

          {/* Santiso side (shared) */}
          {(tipo === "partido" ||
            tipo === "resumo" ||
            tipo === "cronoloxia" ||
            tipo === "clasificacion") && (
            <div className={styles.lado} role="group" aria-label="Santiso en el cartel">
              <span>Santiso en el cartel</span>
              <div className={styles.ladoBotones}>
                <Toggle
                  label="← Izquierda"
                  active={form.santisoSide === "left"}
                  onClick={() => set("santisoSide", "left")}
                />
                <Toggle
                  label="Derecha →"
                  active={form.santisoSide === "right"}
                  onClick={() => set("santisoSide", "right")}
                />
              </div>
            </div>
          )}

          <div className={styles.acciones}>
            <Button onClick={handleDownload}>Descargar JPG (alta calidad para Instagram)</Button>
            <Button variant="secondary" onClick={resetForm}>
              Limpiar datos
            </Button>
          </div>

          {instagramText && (
            <section className={styles.instagram} aria-label="Texto para Instagram">
              <div className={styles.instagramCabecera}>
                <div>
                  <h4>Texto para Instagram</h4>
                  {instagramMeta && (
                    <p>
                      {instagramMeta.title}: {instagramMeta.detail}
                    </p>
                  )}
                </div>
                <Button variant="secondary" onClick={handleCopyInstagram}>
                  {copied ? "Copiado" : "Copiar"}
                </Button>
              </div>
              <textarea readOnly value={instagramText} aria-label="Texto generado" />
            </section>
          )}
        </div>

        <div className={styles.previsualizacion}>
          <div className={styles.marco}>
            <div className={styles.marcoCabecera}>
              <h3>Previsualización</h3>
              <span className={styles.medidas}>
                {W * RENDER_SCALE}x{H * RENDER_SCALE}px
              </span>
            </div>

            <div className={styles.lienzo}>
              <canvas ref={canvasRef} width={W * RENDER_SCALE} height={H * RENDER_SCALE} />
            </div>

            <div className={styles.pie}>
              <p>El archivo final conserva la calidad completa para Instagram.</p>
              <p>
                Los logos de cabecera se cambian en{" "}
                <Link href="/admin/ajustes-graficos">Ajustes gráficos</Link>; los de la barra
                inferior, en <Link href="/admin/patrocinadores">Patrocinadores y logos</Link>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
