"use client";

import { prepararFotoSubida } from "@/lib/cartel2/subida";
import { cargarFotoGuardada } from "@/lib/server/acciones/carteles-guardados";
import { useEffect, useMemo, useRef, useState } from "react";
import { useEsMovil } from "@/components/ui/foundation/FiltrosMovil";
import { Cartel } from "@/components/cartel2/Cartel";
import { Button } from "@/components/ui/foundation/Button";
import { aHex, COLOR_RIVAL_RESERVA, colorDominante } from "@/lib/cartel2/color";
import GaleriaPartido from "@/components/admin/fotos/GaleriaPartido";
import { peticionDeFormulario } from "@/lib/cartel2/formulario";
import {
  ESTILOS_FOTO,
  medidasDe,
  type FormatoCartel,
  type Composicion,
  type FotoCartel,
  type PeticionCartel,
} from "@/lib/cartel2/modelo";
import { Deslizador } from "./Common";
import styles from "./PilotoCartel.module.css";
import type { AssetUrls, FormState, TemplateId } from "./types";
import type { CartelTeam } from "./useCartelForm";
import { recursosDeCartel } from "@/lib/cartel2/recursos";
import { usePreviasCartel } from "./usePreviasCartel";
import { CartelesDelPaso } from "./CartelesDelPaso";
import { PASOS, type CartelGuardado, type PasoCartel } from "@/lib/cartel2/pasos";

/** Color dominante de un escudo, leído en un lienzo pequeño; `null` si no se puede. */
export async function colorDeEscudo(url: string): Promise<string | null> {
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch {
    return null;
  }
  const lado = 64;
  const lienzo = document.createElement("canvas");
  lienzo.width = lado;
  lienzo.height = lado;
  const ctx = lienzo.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, lado, lado);
  const color = colorDominante(ctx.getImageData(0, 0, lado, lado).data);
  return color ? aHex(color) : null;
}

/** Una imagen subida a mano (`blob:`) pasa a `data:`, que el Chromium de la exportación sí abre. */
async function aDataUrl(url: string): Promise<string> {
  const blob = await (await fetch(url)).blob();
  return await new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result));
    lector.onerror = () => reject(lector.error);
    lector.readAsDataURL(blob);
  });
}

export async function exportable<T>(valor: T): Promise<T> {
  if (typeof valor === "string")
    return (valor.startsWith("blob:") ? await aDataUrl(valor) : valor) as T;
  if (Array.isArray(valor)) return (await Promise.all(valor.map((v) => exportable(v)))) as T;
  if (valor && typeof valor === "object") {
    const salida: Record<string, unknown> = {};
    for (const [clave, v] of Object.entries(valor)) salida[clave] = await exportable(v);
    return salida as T;
  }
  return valor;
}

/** Escudos del formulario cuyo color hace falta: el rival y los de «Próximos». */
function escudosDelFormulario(form: FormState) {
  return [form.rivalEscudoUrl, ...form.matches.map((m) => m.rivalEscudoUrl)].filter(Boolean);
}

/** Lo que la vista previa tiene que estar quieta en el móvil antes de preparar el PNG sola. */
const ESPERA_PREPARAR_MS = 1200;

/**
 * Cartel del motor nuevo (HTML/CSS → PNG con Chromium local) para cualquier plantilla. Usa el
 * mismo formulario que el cartel actual; la vista previa es el propio cartel escalado y el PNG
 * lo genera `/api/carteles/png` con los mismos datos.
 */

export default function PilotoCartel({
  tipo,
  formato = "publicacion",
  form,
  recursos,
  equipos,
  showToast,
  guardado = null,
}: {
  tipo: TemplateId;
  formato?: FormatoCartel;
  form: FormState;
  recursos: AssetUrls;
  /** Equipos del Senior y de Veteranos: de aquí salen el escudo del Santiso y los marcados en 3D. */
  equipos: CartelTeam[];
  showToast: (msg: string, type?: "success" | "error") => void;
  /**
   * Cartel de un partido concreto: en vez de exportar suelto, se generan y guardan sus formatos
   * (ver `CartelesDelPaso`). Sin él, el cartel se descarga o comparte sin guardar.
   */
  guardado?: { partidoId: string; paso: PasoCartel; guardados: CartelGuardado[] } | null;
}) {
  // Un solo diseño de cartel de partido: ya no se elige.
  const composicion: Composicion = "diagonal";
  const [colores, setColores] = useState<Record<string, string>>({});
  const [foto, setFoto] = useState<FotoCartel | null>(null);
  const [galeria, setGaleria] = useState(false);
  const [hueco, setHueco] = useState({ ancho: 0, alto: 0 });
  const [enPantalla, setEnPantalla] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [png, setPng] = useState<{ clave: string; archivo: File } | null>(null);
  const [compartiendo, setCompartiendo] = useState(false);
  const compartiendoRef = useRef(false);
  const caja = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  const [altoPanel, setAltoPanel] = useState<number | null>(null);
  const previas = usePreviasCartel(
    tipo === "partido"
      ? [form.partido_id]
      : tipo === "proximos"
        ? form.matches.map((m) => m.partidoId ?? "")
        : [],
  );

  // Colores de los escudos del formulario, leídos una vez por URL.
  const pendientes = escudosDelFormulario(form).filter((u) => !(u in colores));
  const clavePendientes = pendientes.join("|");
  useEffect(() => {
    if (!clavePendientes) return;
    let vigente = true;
    void Promise.all(
      clavePendientes.split("|").map(async (u) => [u, await colorDeEscudo(u)] as const),
    ).then((leidos) => {
      if (!vigente) return;
      setColores((antes) => {
        const despues = { ...antes };
        for (const [u, c] of leidos) despues[u] = c ?? aHex(COLOR_RIVAL_RESERVA);
        return despues;
      });
    });
    return () => {
      vigente = false;
    };
  }, [clavePendientes]);

  // Al reabrir el cartel guardado de un partido vuelve la foto elegida a mano con la que se hizo
  // (subida en el momento o de la galería), si no se ha elegido ya otra.
  const partidoGuardado = guardado?.partidoId ?? null;
  const pasoGuardado = guardado?.paso ?? null;
  useEffect(() => {
    if (!partidoGuardado || !pasoGuardado) return;
    let vigente = true;
    void cargarFotoGuardada(partidoGuardado, pasoGuardado).then((r) => {
      const guardada = r.ok ? r.datos : null;
      if (vigente && guardada) setFoto((actual) => actual ?? guardada);
    });
    return () => {
      vigente = false;
    };
  }, [partidoGuardado, pasoGuardado]);

  // Una foto subida a mano (`blob:`) se libera al cambiarla o al salir.
  const urlSubida = foto?.url.startsWith("blob:") ? foto.url : null;
  useEffect(() => {
    return () => {
      if (urlSubida) URL.revokeObjectURL(urlSubida);
    };
  }, [urlSubida]);

  // El panel llega hasta el borde de abajo de la ventana desde donde empieza, para que el cartel
  // se vea entero nada más abrir la pantalla (y siga a la vista al desplazarse: es «sticky»).
  useEffect(() => {
    const nodo = panel.current;
    if (!nodo) return;
    const medir = () => {
      const arriba = nodo.getBoundingClientRect().top + window.scrollY;
      setAltoPanel(
        Math.max(420, window.innerHeight - Math.min(arriba, window.innerHeight / 2) - 16),
      );
    };
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);

  // La vista previa se ajusta al hueco (alto de la ventana y ancho de la columna): el cartel
  // se ve entero sin desplazarse.
  useEffect(() => {
    const nodo = caja.current;
    if (!nodo) return;
    const observador = new ResizeObserver(([entrada]) => {
      if (entrada) {
        setHueco({ ancho: entrada.contentRect.width, alto: entrada.contentRect.height });
      }
    });
    observador.observe(nodo);
    return () => observador.disconnect();
  }, []);
  useEffect(() => {
    const nodo = caja.current;
    if (!nodo) return;
    const observador = new IntersectionObserver(
      ([entrada]) => setEnPantalla(Boolean(entrada?.isIntersecting)),
      { threshold: 0.5 },
    );
    observador.observe(nodo);
    return () => observador.disconnect();
  }, []);

  const peticion: PeticionCartel = useMemo(
    () =>
      peticionDeFormulario(tipo, form, recursosDeCartel(equipos, recursos), {
        color: (url) => (url && colores[url]) || aHex(COLOR_RIVAL_RESERVA),
        composicion,
        foto,
        formato,
        previas: previas.datos,
      }),
    [tipo, form, recursos, equipos, colores, composicion, foto, formato, previas.datos],
  );
  const medidas = medidasDe(
    peticion.plantilla,
    "formato" in peticion ? peticion.formato : undefined,
  );
  const escala =
    hueco.ancho && hueco.alto
      ? Math.min(hueco.ancho / medidas.ancho, hueco.alto / medidas.alto)
      : 0;
  const margenIzquierdo = (hueco.ancho - medidas.ancho * escala) / 2;
  const nombrePng = `${peticion.plantilla}-${form.fecha || "cartel"}${medidas.alto === 1920 ? "-historia" : ""}.png`;
  const clavePng = JSON.stringify([peticion, nombrePng]);
  const pngActual = png?.clave === clavePng ? png.archivo : null;

  async function generar(): Promise<File | null> {
    if (previas.cargando || previas.error) return null;
    const clave = clavePng;
    setExportando(true);
    try {
      const respuesta = await fetch("/api/carteles/png", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(await exportable(peticion)),
      });
      if (respuesta.status === 422) {
        falloAlPreparar.current = clave;
        const aviso = (await respuesta.json()) as { error: string };
        showToast(aviso.error, "error");
        return null;
      }
      if (!respuesta.ok) throw new Error(String(respuesta.status));
      const archivo = new File([await respuesta.blob()], nombrePng, { type: "image/png" });
      setPng({ clave: clavePng, archivo });
      return archivo;
    } catch {
      // Con este fallo apuntado, el móvil no vuelve a intentarlo solo: queda el botón.
      falloAlPreparar.current = clave;
      showToast("No se pudo generar el PNG. Vuelve a intentarlo.", "error");
      return null;
    } finally {
      setExportando(false);
    }
  }

  /** Las peticiones de cada formato del paso, para generarlas y guardarlas juntas. */
  async function prepararGuardado(): Promise<PeticionCartel[] | null> {
    if (!guardado || previas.cargando || previas.error) return null;
    return Promise.all(
      PASOS[guardado.paso].formatos.map((f) =>
        exportable(
          peticionDeFormulario(tipo, form, recursosDeCartel(equipos, recursos), {
            color: (url) => (url && colores[url]) || aHex(COLOR_RIVAL_RESERVA),
            composicion,
            foto,
            formato: f,
            previas: previas.datos,
          }),
        ),
      ),
    );
  }

  // En el móvil el PNG se prepara solo en cuanto la vista previa se queda quieta: así «Guardar
  // o compartir» abre la hoja del sistema al primer toque (en iOS, «Guardar imagen»). No puede
  // prepararse dentro de ese toque: Safari solo deja compartir justo después de tocar, y pintar
  // el cartel tarda un par de segundos.
  const esMovil = useEsMovil();
  const falloAlPreparar = useRef<string | null>(null);
  const prepararSolo = useRef(generar);
  useEffect(() => {
    prepararSolo.current = generar;
  });
  // Tampoco mientras se leen los colores de los escudos: al llegar cambiarían el cartel y el PNG
  // ya preparado no valdría.
  const previaLista = !previas.cargando && !previas.error && !clavePendientes;
  // Datos y vista previa van en la misma pantalla: el PNG solo se prepara solo cuando el cartel
  // está de verdad a la vista, no mientras se rellenan los datos más arriba.
  const aLaVista = hueco.ancho > 0 && enPantalla;
  useEffect(() => {
    if (guardado || !esMovil || !aLaVista || !previaLista || pngActual || exportando) return;
    if (falloAlPreparar.current === clavePng) return;
    const espera = setTimeout(() => void prepararSolo.current(), ESPERA_PREPARAR_MS);
    return () => clearTimeout(espera);
  }, [guardado, esMovil, aLaVista, previaLista, pngActual, exportando, clavePng]);

  function guardar(archivo: File) {
    const url = URL.createObjectURL(archivo);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = archivo.name;
    enlace.click();
    // Safari necesita que la URL siga viva al empezar la descarga.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("Cartel descargado");
  }

  async function descargar() {
    const archivo = pngActual ?? (await generar());
    if (archivo) guardar(archivo);
  }

  async function compartir() {
    if (!pngActual || compartiendoRef.current) return;
    compartiendoRef.current = true;
    setCompartiendo(true);
    try {
      if (!navigator.share || !navigator.canShare?.({ files: [pngActual] })) {
        guardar(pngActual);
        return;
      }
      // Sin espera de red antes de share: conserva la activación del toque.
      await navigator.share({ files: [pngActual] });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) guardar(pngActual);
    } finally {
      compartiendoRef.current = false;
      setCompartiendo(false);
    }
  }

  return (
    <>
    <section
      ref={panel}
      className={styles.piloto}
      aria-label="Previsualización del cartel"
      style={altoPanel ? { height: altoPanel } : undefined}
    >
      {previas.error && (
        <div>
          <p role="alert">{previas.error}</p>
          <button type="button" style={{ minHeight: 44 }} onClick={previas.reintentar}>
            Reintentar previa
          </button>
        </div>
      )}
      {/* Una sola fila: título, opciones de la plantilla y descarga. Deja el alto al cartel. */}
      <div className={styles.cabecera}>
        <h3>Previsualización</h3>
        <div className={styles.controles}>
          {(tipo === "partido" || tipo === "resumo" || tipo === "cronoloxia") && (
            <>
              {/* De la galería del partido cargado, o cualquier foto subida en el momento. */}
              {form.partido_id && (
                <Button size="sm" variant="secondary" onClick={() => setGaleria(true)}>
                  Fotos del partido
                </Button>
              )}
              <label className={styles.botonFoto}>
                {foto ? "Subir otra foto" : "Subir foto de fondo"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const fichero = e.target.files?.[0];
                    e.target.value = "";
                    if (!fichero) return;
                    void prepararFotoSubida(fichero)
                      .then((url) =>
                        setFoto({ url, x: 0.5, y: 0.4, estilo: foto?.estilo ?? "color" }),
                      )
                      .catch(() => showToast("No se pudo leer la foto.", "error"));
                  }}
                />
              </label>
              {foto && (
                <>
                  <div className={styles.grupo} role="group" aria-label="Estilo de la foto">
                    {ESTILOS_FOTO.map((e) => (
                      <Button
                        key={e.id}
                        size="sm"
                        variant={foto.estilo === e.id ? "primary" : "secondary"}
                        aria-pressed={foto.estilo === e.id}
                        onClick={() => setFoto({ ...foto, estilo: e.id })}
                      >
                        {e.nombre}
                      </Button>
                    ))}
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => setFoto(null)}>
                    Quitar foto
                  </Button>
                </>
              )}
            </>
          )}
          {/* O noso 11: en vez de la foto del jugador, una de la galería del partido cargado. */}
          {tipo === "noso11" && form.partido_id && (
            <>
              <Button size="sm" variant="secondary" onClick={() => setGaleria(true)}>
                {foto ? "Cambiar foto del partido" : "Foto del partido"}
              </Button>
              {foto && (
                <Button variant="secondary" size="sm" onClick={() => setFoto(null)}>
                  Quitar foto
                </Button>
              )}
            </>
          )}
          {!guardado && (
            <>
          <div className={styles.movil}>
            {pngActual ? (
              <Button size="sm" onClick={() => void compartir()} disabled={compartiendo}>
                {compartiendo ? "Abriendo…" : "Guardar o compartir"}
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => void generar()}
                disabled={exportando || previas.cargando || !!previas.error}
              >
                {exportando ? "Preparando…" : "Preparar PNG"}
              </Button>
            )}
          </div>
          <div className={styles.descarga} data-listo={!!pngActual}>
            <Button
              size="sm"
              variant={esMovil ? "secondary" : "primary"}
              onClick={() => void descargar()}
              disabled={exportando || compartiendo || previas.cargando || !!previas.error}
            >
              {exportando ? "Generando…" : "Descargar PNG"}
            </Button>
          </div>
            </>
          )}
        </div>
      </div>
      {foto && (tipo === "partido" || tipo === "resumo" || tipo === "cronoloxia") && (
        <details className={styles.encuadre}>
          <summary>Ajustar la foto</summary>
          <Deslizador
            label="Mover a los lados"
            min={0}
            max={1}
            step={0.01}
            value={foto.x}
            onChange={(x) => setFoto({ ...foto, x })}
            extremos={["Izquierda", "Derecha"]}
          />
          <Deslizador
            label="Mover arriba o abajo"
            min={0}
            max={1}
            step={0.01}
            value={foto.y}
            onChange={(y) => setFoto({ ...foto, y })}
            extremos={["Arriba", "Abajo"]}
          />
          <Deslizador
            label="Acercar"
            min={1}
            max={4}
            step={0.01}
            value={foto.zoom ?? 1}
            onChange={(zoom) => setFoto({ ...foto, zoom })}
            extremos={["Entera", "Cerca"]}
          />
        </details>
      )}
      <div ref={caja} className={styles.vista}>
        {escala > 0 && (
          <div
            className={styles.escalado}
            style={{ left: margenIzquierdo, transform: `scale(${escala})` }}
            data-vista-cartel
          >
            <Cartel peticion={peticion} />
          </div>
        )}
      </div>
      {galeria && form.partido_id && (
        <GaleriaPartido
          partidoId={form.partido_id}
          partido={`${form.rivalNombre ? `Santiso – ${form.rivalNombre}` : "Partido"}${form.fecha ? ` · ${form.fecha}` : ""}`}
          onCerrar={() => setGaleria(false)}
          showToast={showToast}
          onElegir={(elegida) => {
            setFoto({
              url: elegida.url,
              x: elegida.foco_x,
              y: elegida.foco_y,
              estilo: foto?.estilo ?? "color",
            });
            setGaleria(false);
          }}
        />
      )}
    </section>
    {guardado && (
      <CartelesDelPaso
        key={`${guardado.partidoId}:${guardado.paso}`}
        partidoId={guardado.partidoId}
        paso={guardado.paso}
        guardados={guardado.guardados}
        preparar={prepararGuardado}
        motivo={
          previas.error
            ? "No se pudieron cargar los datos previos del partido."
            : previas.cargando
              ? "Cargando datos del partido…"
              : null
        }
        showToast={showToast}
      />
    )}
    </>
  );
}
