"use client";

import { sinConexion } from "@/lib/resultado";
import { useEffect, useMemo, useState } from "react";
import { LIMITE_INSTAGRAM, textoInstagram } from "@/lib/cartel/instagram";

// UI Components & Hooks
import { TEMAS_MULTIUSOS, TEMPLATES, type MultiusosTema, type TemplateId } from "./cartel/types";
import { useCartelForm } from "./cartel/useCartelForm";
import { useOptionalStudio } from "@/components/studio/StudioContext";
import { Button } from "@/components/ui/foundation/Button";
import { ErrorState, LoadingState } from "@/components/ui/foundation/States";
import AvisoError from "./AvisoError";
import styles from "./cartel/Cartel.module.css";
import { useCartelAssets } from "./cartel/useCartelAssets";
import { FormPartido } from "./cartel/FormPartido";
import { FormCronoloxia } from "./cartel/FormCronoloxia";
import { FormProximos } from "./cartel/FormProximos";
import PilotoCartel from "./cartel/PilotoCartel";
import { FormMultiusos, TEMAS } from "./cartel/FormMultiusos";
import { Toggle } from "./cartel/Common";
import { FormClasificacion } from "./cartel/FormClasificacion";
import { FormComunicado } from "./cartel/FormComunicado";
import { FormFichaxe } from "./cartel/FormFichaxe";
import { FormLoteria } from "./cartel/FormLoteria";
import { PaqueteAxenda } from "./cartel/PaqueteAxenda";
import { PaqueteDespues } from "./cartel/PaqueteDespues";
import { EditorTactico } from "./cartel/EditorTactico";
import { useDespues } from "./cartel/useDespues";
import { Flecha, PlegableMovil } from "./cartel/PlegableMovil";
import { EventosPartido } from "./cartel/EventosPartido";
import { Select } from "@/components/ui/foundation/Fields";
import type { FormatoCartel } from "@/lib/cartel2/modelo";
import type { CartelGuardado, PasoCartel } from "@/lib/cartel2/pasos";
import { cargarCartelesPartido } from "@/lib/server/acciones/carteles-guardados";

/** Plantillas del generador que son un paso del partido: con partido elegido, se guardan. */
const PASO_DE_PLANTILLA: Partial<Record<TemplateId, PasoCartel>> = {
  partido: "partido",
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
  const studio = useOptionalStudio();
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
    handleLoteriaFile,
    addEvent,
    updateEvent,
    removeEvent,
    updateMatch,
    handleMatchRivalFile,
    dbMatches,
    jugadoresPartidoId,
    loadMatchFromDb,
    resetForm,
    competicionesCatalog,
    errorDatos,
    cargandoDatos,
    reintentarDatos,
  } = useCartelForm(partidoInicial, {
    // Desde el catálogo o Inicio el enlace trae la categoría: el formulario empieza por ella.
    categoria: studio?.params.get("categoria"),
    proximo: (templateId || "partido") === "partido",
  });

  const tipo = templateId || "partido";
  // El partido elegido queda en la dirección: al ir a la ficha de un equipo y volver atrás,
  // la pantalla abre con el mismo partido.
  const elegirPartido: typeof loadMatchFromDb = (m) => {
    loadMatchFromDb(m);
    studio?.setParams({ partido: m.id }, true);
  };
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
    void cargarCartelesPartido([partidoId])
      .catch(sinConexion)
      .then((r) => {
        if (vigente) {
          setGuardados({
            clave: claveGuardados,
            lista: r.ok ? (r.datos[partidoId]?.[paso] ?? []) : [],
          });
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
  // «Después del partido»: el Resultado y O Noso 11, juntos en un carrusel.
  const despues = useDespues({
    activo: tipo === "despues",
    form,
    jugadoresPartidoId,
    plantilla: jugadores
      .filter((j) => j.categoria === form.categoria)
      .map((j) => ({
        id: j.id,
        jugadorId: j.id,
        nome: j.apodo?.trim() || j.nombre,
        dorsal: j.dorsal == null ? "" : String(j.dorsal),
        eCapitan: Boolean(j.capitan),
        posicion: j.posicion ?? null,
      })),
    equipos,
    recursos: assetUrls,
  });

  const textoGenerado = useMemo(
    () => textoInstagram(tipoForAssets, tipo === "despues" ? despues.formulario : form),
    [tipoForAssets, form, tipo, despues.formulario],
  );
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

  const instagram = (
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
      <p className={styles.instagramContador} data-excede={instagramText.length > LIMITE_INSTAGRAM}>
        {instagramText.length} / {LIMITE_INSTAGRAM} caracteres
      </p>
    </section>
  );

  if ((tipo === "despues" || tipo === "partido") && cargandoDatos)
    return <LoadingState title="Buscando los partidos de la temporada…" />;

  const errorPartidos = errorDatos && (
    <ErrorState
      title="No se pudieron cargar los partidos"
      detail="Vuelve a leer la temporada para poder elegir una jornada."
      action={<Button onClick={reintentarDatos}>Reintentar</Button>}
    />
  );

  if (tipo === "despues") {
    if (errorDatos) return errorPartidos;
    const conPartido = Boolean(despues.partidoId);
    return (
      <div className={styles.pantalla}>
        <div className={styles.despues}>
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
            loadMatchFromDb={elegirPartido}
            tipo="cronoloxia"
            conEventos={false}
          />
          {conPartido && (
            <>
              <details className={styles.seccion} name="despues">
                <summary>
                  <span>Carteles</span>
                  <Flecha />
                </summary>
                <div className={styles.seccionContenido}>
                  {despues.guardados ? (
                    <PaqueteDespues
                      key={despues.partidoId}
                      partidoId={despues.partidoId!}
                      guardados={despues.guardados}
                      preparar={despues.preparar}
                      firma={despues.firma}
                      antesDeGuardar={despues.guardarFinal}
                      texto={instagramText}
                      motivo={despues.motivo}
                      showToast={showToast}
                      previa={(paso) => (
                        <PilotoCartel
                          tipo={paso === "resultado" ? "despues" : "noso11"}
                          form={despues.formulario}
                          recursos={assetUrls}
                          equipos={equipos}
                          showToast={showToast}
                          soloVista
                          colocacion={paso === "noso11" ? despues.colocacion : null}
                        />
                      )}
                    />
                  ) : (
                    <LoadingState title="Cargando carteles del partido…" />
                  )}
                  {despues.jugadores.length > 0 && (
                    <details className={styles.seccionInterior}>
                      <summary>
                        <span>Cambiar el once</span>
                        <Flecha />
                      </summary>
                      {despues.sinActa && (
                        <p>
                          Sin acta ni alineación: elige el once desde la plantilla tocando los
                          huecos del campo.
                        </p>
                      )}
                      <EditorTactico
                        jugadores={despues.jugadores}
                        colocacion={despues.colocacion}
                        onCambio={despues.cambiarColocacion}
                      />
                    </details>
                  )}
                  {textoGenerado && (
                    <details className={styles.seccionInterior}>
                      <summary>
                        <span>Texto para Instagram</span>
                        <Flecha />
                      </summary>
                      {instagram}
                    </details>
                  )}
                </div>
              </details>
              <details className={styles.seccion} name="despues">
                <summary>
                  <span>
                    Eventos <small>{form.events.length}</small>
                  </span>
                  <Flecha />
                </summary>
                <div className={styles.seccionContenido}>
                  <EventosPartido
                    eventos={form.events}
                    jugadores={jugadores.filter((j) => j.categoria === form.categoria)}
                    addEvent={addEvent}
                    updateEvent={updateEvent}
                    removeEvent={removeEvent}
                    titulo={false}
                  />
                </div>
              </details>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.pantalla}>
      {tipo === "partido" ? errorPartidos : <AvisoError mensaje={errorDatos} />}
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
              loadMatchFromDb={elegirPartido}
              campos={campos}
              competiciones={competicionesCatalog}
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
          {tipo === "multiusos" && (
            <FormMultiusos form={form} set={set} handleMultiusosFile={handleMultiusosFile} />
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
          {tipo === "loteria" && (
            <FormLoteria form={form} set={set} handleLoteriaFile={handleLoteriaFile} />
          )}

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
            {tipo === "fichaxe" && (
              <div className={styles.acciones}>
                <Toggle
                  label="Escudo pequeño arriba"
                  active={form.fichaxeConEscudo}
                  onClick={() => set("fichaxeConEscudo", !form.fichaxeConEscudo)}
                />
              </div>
            )}
            {/* Celebración llega con su tema desde el catálogo; los demás, aquí. */}
            {tipo === "multiusos" && (
              <Select
                label="Tema visual"
                value={form.multiusosTema}
                onChange={(e) => set("multiusosTema", e.target.value as MultiusosTema)}
              >
                {TEMAS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </Select>
            )}
            <div className={styles.acciones}>
              <Button variant="secondary" onClick={resetForm}>
                Limpiar datos
              </Button>
            </div>
          </PlegableMovil>

          {textoGenerado && (
            <PlegableMovil titulo="Texto para Instagram">{instagram}</PlegableMovil>
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
            // Próximos se publica solo en carrusel (Axenda): aquí, solo la vista previa.
            soloVista={tipo === "proximos"}
          />
        </div>
      </div>
    </div>
  );
}
