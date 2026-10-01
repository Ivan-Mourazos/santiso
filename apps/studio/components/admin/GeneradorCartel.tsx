"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { LIMITE_INSTAGRAM, textoInstagram } from "@/lib/cartel/instagram";

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
import PilotoCartel from "./cartel/PilotoCartel";
import { FormNoso11 } from "./cartel/FormNoso11";
import { FormMultiusos } from "./cartel/FormMultiusos";
import { FormClasificacion } from "./cartel/FormClasificacion";

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

  // ── Texto de Instagram: se genera del formulario y se puede retocar antes de copiarlo. Lo
  // retocado vale mientras el texto generado no cambie; si cambian los datos, manda el nuevo.
  const textoGenerado = useMemo(() => textoInstagram(tipoForAssets, form), [tipoForAssets, form]);
  const [edicion, setEdicion] = useState<{ base: string; texto: string } | null>(null);
  const instagramText =
    edicion && edicion.base === textoGenerado ? edicion.texto : textoGenerado;
  const retocado = instagramText !== textoGenerado;

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
          {(tipo === "partido" || tipo === "resumo" || tipo === "cronoloxia") && (
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
            <Button variant="secondary" onClick={resetForm}>
              Limpiar datos
            </Button>
          </div>

          {textoGenerado && (
            <section className={styles.instagram} aria-label="Texto para Instagram">
              <div className={styles.instagramCabecera}>
                <div>
                  <h4>Texto para Instagram</h4>
                  <p>
                    Sale de los datos del cartel. Puedes retocarlo aquí antes de copiarlo.
                  </p>
                </div>
                <div className={styles.instagramAcciones}>
                  {retocado && (
                    <Button variant="secondary" size="sm" onClick={() => setEdicion(null)}>
                      Restablecer
                    </Button>
                  )}
                  <Button size="sm" onClick={handleCopyInstagram}>
                    {copied ? "Copiado" : "Copiar"}
                  </Button>
                </div>
              </div>
              <textarea
                value={instagramText}
                onChange={(e) => setEdicion({ base: textoGenerado, texto: e.target.value })}
                aria-label="Texto para Instagram"
                rows={Math.min(18, instagramText.split("\n").length + 1)}
              />
              <p
                className={styles.instagramContador}
                data-excede={instagramText.length > LIMITE_INSTAGRAM}
              >
                {instagramText.length} / {LIMITE_INSTAGRAM} caracteres
              </p>
            </section>
          )}
        </div>

        <div className={styles.previsualizacion}>
          <PilotoCartel
            tipo={tipoForAssets}
            form={form}
            recursos={assetUrls}
            equipos={equipos}
            showToast={showToast}
          />
          <div className={styles.pie}>
            <p>
              Los logos de cabecera se cambian en{" "}
              <Link href="/admin/ajustes-graficos">Ajustes gráficos</Link>; los de la barra
              inferior, en <Link href="/admin/patrocinadores">Patrocinadores y logos</Link>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
