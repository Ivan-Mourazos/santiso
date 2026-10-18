"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LIMITE_INSTAGRAM, textoInstagram } from "@/lib/cartel/instagram";

// UI Components & Hooks
import {
  TEMAS_MULTIUSOS,
  TEMPLATES,
  type MultiusosTema,
  type TemplateId,
} from "./cartel/types";
import { useCartelForm } from "./cartel/useCartelForm";
import { useOptionalStudio } from "@/components/studio/StudioContext";
import { Button } from "@/components/ui/foundation/Button";
import AvisoError from "./AvisoError";
import styles from "./cartel/Cartel.module.css";
import { useCartelAssets } from "./cartel/useCartelAssets";
import { FormPartido } from "./cartel/FormPartido";
import { FormResumo } from "./cartel/FormResumo";
import { FormCronoloxia } from "./cartel/FormCronoloxia";
import { FormProximos } from "./cartel/FormProximos";
import PilotoCartel from "./cartel/PilotoCartel";
import { FormNoso11 } from "./cartel/FormNoso11";
import { FormMultiusos } from "./cartel/FormMultiusos";
import { FormClasificacion } from "./cartel/FormClasificacion";
import { FormComunicado } from "./cartel/FormComunicado";
import { FormFichaxe } from "./cartel/FormFichaxe";
import { PaqueteAxenda } from "./cartel/PaqueteAxenda";
import { PlegableMovil } from "./cartel/PlegableMovil";
import { Select } from "@/components/ui/foundation/Fields";
import type { FormatoCartel } from "@/lib/cartel2/modelo";
import type { CartelGuardado, PasoCartel } from "@/lib/cartel2/pasos";
import { cargarCartelesPartido } from "@/lib/server/acciones/carteles-guardados";

/** Plantillas del generador que son un paso del partido: con partido elegido, se guardan. */
const PASO_DE_PLANTILLA: Partial<Record<TemplateId, PasoCartel>> = {
  partido: "partido",
  resumo: "resultado",
  cronoloxia: "cronoloxia",
  noso11: "noso11",
};

interface Props {
  /** Plantilla elegida en la cabecera del panel (`?plantilla=`). */
  templateId?: string;
  /** Partido que cargar al abrir, desde la pantalla «Jornada». */
  partidoInicial?: string | null;
  /** «Próximos encuentros» abierto desde «Jornada»: se rellena solo. */
  rellenarProximos?: boolean;
  /** Tema del anuncio con el que abrir (`?tema=`), desde el catálogo de carteles. */
  temaInicial?: string | null;
  showToast: (msg: string, type?: "success" | "error") => void;
}

export default function GeneradorCartel({
  templateId,
  partidoInicial,
  rellenarProximos = false,
  temaInicial = null,
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
  } = useCartelForm(partidoInicial, {
    // Desde el catálogo o Inicio el enlace trae la categoría: el formulario empieza por ella.
    categoria: useOptionalStudio()?.params.get("categoria"),
    proximo: (templateId || "partido") === "partido",
  });

  const tipo = templateId || "partido";
  // Fichajes, comunicados y celebraciones son el anuncio con su tema ya puesto.
  useEffect(() => {
    if (tipo === "multiusos" && temaInicial && TEMAS_MULTIUSOS.includes(temaInicial))
      set("multiusosTema", temaInicial as MultiusosTema);
    // Solo al abrir: después el tema lo cambia quien hace el cartel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [copied, setCopied] = useState(false);
  const [formato, setFormato] = useState<FormatoCartel>("publicacion");

  const tipoForAssets: TemplateId = TEMPLATES.some((t) => t.id === tipo)
    ? (tipo as TemplateId)
    : "partido";
  const assetUrls = useCartelAssets(tipoForAssets);

  // Con un partido del calendario elegido, el cartel es un paso de ese partido: se guarda.
  const paso = PASO_DE_PLANTILLA[tipoForAssets] ?? null;
  const partidoId = paso ? form.partido_id || null : null;
  const [guardados, setGuardados] = useState<{
    clave: string;
    lista: CartelGuardado[];
  } | null>(null);
  const claveGuardados = partidoId && paso ? `${partidoId}:${paso}` : null;
  useEffect(() => {
    if (!claveGuardados || !partidoId || !paso) return;
    let vigente = true;
    void cargarCartelesPartido([partidoId]).then((r) => {
      if (vigente) {
        setGuardados({ clave: claveGuardados, lista: r.ok ? (r.datos[partidoId]?.[paso] ?? []) : [] });
      }
    });
    return () => {
      vigente = false;
    };
  }, [claveGuardados, partidoId, paso]);
  const guardado =
    partidoId && paso && guardados?.clave === claveGuardados
      ? { partidoId, paso, guardados: guardados.lista }
      : null;

  // ── Texto de Instagram: se genera del formulario y se puede retocar antes de copiarlo. Lo
  // retocado vale mientras el texto generado no cambie; si cambian los datos, manda el nuevo.
  const textoGenerado = useMemo(() => textoInstagram(tipoForAssets, form), [tipoForAssets, form]);
  const [edicion, setEdicion] = useState<{ base: string; texto: string } | null>(null);
  const instagramText = edicion && edicion.base === textoGenerado ? edicion.texto : textoGenerado;
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
        <section className={styles.formulario} aria-label="Datos del cartel">
          {/* Template-specific fields */}
          {tipo === "proximos" && (
            <PaqueteAxenda
              form={form}
              formato={formato}
              recursos={assetUrls}
              equipos={equipos}
              dbMatches={dbMatches}
              setMatches={(m) => set("matches", m)}
              texto={instagramText}
              showToast={showToast}
            />
          )}
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
            />
          )}
          {tipo === "clasificacion" && <FormClasificacion form={form} set={set} />}
          {tipo === "fichaxe" && (
            <FormFichaxe
              form={form}
              set={set}
              jugFileName={jugFileName}
              handleJugadorFile={handleJugadorFile}
            />
          )}
          {tipo === "comunicado" && <FormComunicado form={form} set={set} />}

          <PlegableMovil titulo="Más opciones">
            {/* Casi todo se publica en 4:5: la historia queda aquí, para la rara vez que haga falta. */}
            {(tipo === "partido" || tipo === "proximos") && (
              <Select
                label="Formato de cartel"
                value={formato}
                onChange={(e) => setFormato(e.target.value as FormatoCartel)}
              >
                <option value="publicacion">Publicación · 4:5</option>
                <option value="historia">Historia · 9:16</option>
              </Select>
            )}
            <div className={styles.acciones}>
              <Button variant="secondary" onClick={resetForm}>
                Limpiar datos
              </Button>
            </div>
          </PlegableMovil>

          {textoGenerado && (
            <PlegableMovil titulo="Texto para Instagram">
              <section className={styles.instagram} aria-label="Texto para Instagram">
                <div className={styles.instagramCabecera}>
                  <div>
                    <h4>Texto para Instagram</h4>
                    <p>Sale de los datos del cartel. Puedes retocarlo aquí antes de copiarlo.</p>
                  </div>
                  <div className={styles.instagramAcciones}>
                    {retocado && (
                      <Button variant="secondary" size="sm" onClick={() => setEdicion(null)}>
                        Restablecer
                      </Button>
                    )}
                    <Button variant="secondary" size="sm" onClick={handleCopyInstagram}>
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
            </PlegableMovil>
          )}
        </section>

        <div className={styles.previsualizacion}>
          <PilotoCartel
            tipo={tipoForAssets}
            formato={formato}
            form={form}
            recursos={assetUrls}
            equipos={equipos}
            showToast={showToast}
            guardado={guardado}
          />
          {/* Fichajes y comunicados van sin logos: no hay nada que explicar. */}
          {tipo !== "fichaxe" && tipo !== "comunicado" && (
          <PlegableMovil titulo="Logos y patrocinadores">
            <div className={styles.pie}>
              <p>
                Los logos de cabecera se cambian en{" "}
                <Link href="/admin/ajustes-graficos">Ajustes gráficos</Link>; los de la barra
                inferior, en <Link href="/admin/patrocinadores">Patrocinadores y logos</Link>.
              </p>
            </div>
          </PlegableMovil>
          )}
        </div>
      </div>
    </div>
  );
}
