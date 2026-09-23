"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  JornadaGeminiResponse,
  JornadaMatchExtracted,
} from "@/app/api/admin/jornada-gemini/route";
import { Button } from "@/components/ui/foundation/Button";
import { Field, Select } from "@/components/ui/foundation/Fields";
import { LoadingState } from "@/components/ui/foundation/States";
import {
  competitionsForCategory,
  pickDefaultCompetitionId,
  type CompetenciaRow,
} from "@/lib/competition";
import {
  mejorCampo,
  mejorEquipo,
  normalizarFecha,
  parecido,
  type CampoCatalogo,
  type ConNombre,
} from "@/lib/importar/emparejar";
import { fetchCompeticiones } from "@/lib/lecturas-cliente";
import {
  cargarPantallaCalendario,
  crearJornada,
  guardarPartidoDeJornada,
} from "@/lib/server/acciones/calendario";
import { matchLocalDateTimeToIso } from "../cartel/matchDateTime";
import TarjetaFila, { type FilaRevision } from "./TarjetaFila";
import styles from "./Importar.module.css";

interface Props {
  showToast: (msg: string, type?: "success" | "error") => void;
  showConfirm: (msg: string, onConfirm: () => void) => void;
}

interface JornadaCatalogo {
  id: string;
  numero: number;
}

const CATEGORIAS = ["Senior", "Veteranos"];

function construirFilas(
  datos: JornadaGeminiResponse,
  equipos: readonly ConNombre[],
  campos: readonly CampoCatalogo[],
): FilaRevision[] {
  return datos.partidos.map((p: JornadaMatchExtracted, i) => {
    const campoId = mejorCampo(p.campoNombre || "", p.campoPoblacion || "", campos);
    let fecha = normalizarFecha(p.fecha || "");
    if (fecha && p.hora) fecha = `${fecha}T${p.hora}`;
    return {
      key: `fila-${i}`,
      extracted: p,
      localId: mejorEquipo(p.localNombre, equipos),
      visitanteId: mejorEquipo(p.visitanteNombre, equipos),
      golesLocal: p.golesLocal,
      golesVisitante: p.golesVisitante,
      fecha,
      campoId,
      campoNombre: campoId ? "" : p.campoNombre || "",
      campoPoblacion: campoId ? "" : p.campoPoblacion || "",
      // Marcada por defecto aunque no traiga goles: puede ser un partido aún por jugar.
      selected: !p.descansa,
    };
  });
}

/**
 * Importar una jornada desde una captura de resultados: Gemini lee la imagen, la pantalla
 * enlaza equipos y campos con el catálogo y se revisa antes de guardar. La lógica viene tal
 * cual de `AdminJornadaImporter` (hasta la 6H); el destino se ve ya antes de analizar.
 */
export default function ImportarFoto({ showToast, showConfirm }: Props) {
  const [categoria, setCategoria] = useState("Senior");
  const [catalogo, setCatalogo] = useState<CompetenciaRow[]>([]);
  const [elegida, setElegida] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);
  const [equipos, setEquipos] = useState<ConNombre[]>([]);
  const [jornadas, setJornadas] = useState<JornadaCatalogo[]>([]);
  const [campos, setCampos] = useState<CampoCatalogo[]>([]);
  const [jornadaId, setJornadaId] = useState("");
  const [ocupada, setOcupada] = useState<string | null>("Cargando competiciones…");
  const [leido, setLeido] = useState<JornadaGeminiResponse | null>(null);
  const [filas, setFilas] = useState<FilaRevision[]>([]);
  const [modelo, setModelo] = useState("");
  const vistaActual = useRef<string | null>(null);

  const opciones = useMemo(
    () => competitionsForCategory(catalogo, categoria),
    [catalogo, categoria],
  );
  // La competición elegida vale mientras sea de la categoría; si no, la de por defecto.
  const competicionId = opciones.some((o) => o.id === elegida)
    ? elegida
    : pickDefaultCompetitionId(catalogo, categoria);

  useEffect(() => {
    let vigente = true;
    void (async () => {
      const lista = await fetchCompeticiones();
      if (!vigente) return;
      setCatalogo(lista);
      setOcupada(null);
    })();
    return () => {
      vigente = false;
    };
  }, []);

  // La vista previa ocupa memoria hasta que se libera: al cambiarla y al salir.
  useEffect(
    () => () => {
      if (vistaActual.current) URL.revokeObjectURL(vistaActual.current);
    },
    [],
  );

  const cargarBase = useCallback(async () => {
    if (!competicionId) return;
    setOcupada("Cargando datos…");
    try {
      // Una sola acción trae jornadas, equipos inscritos y campos.
      const datos = await cargarPantallaCalendario(competicionId, "");
      setEquipos(datos.equipos as ConNombre[]);
      setCampos(datos.campos as CampoCatalogo[]);
      setJornadas(datos.jornadas as JornadaCatalogo[]);
      if (datos.jornadas.length > 0) {
        setJornadaId((prev) =>
          datos.jornadas.some((j) => j.id === prev)
            ? prev
            : (datos.jornadas[datos.jornadas.length - 1]?.id ?? ""),
        );
      }
    } catch (error) {
      console.error("cargarBase", error);
      showToast("Error al cargar datos de la liga", "error");
    } finally {
      setOcupada(null);
    }
  }, [competicionId, showToast]);

  useEffect(() => {
    const id = window.setTimeout(() => void cargarBase(), 0);
    return () => window.clearTimeout(id);
  }, [cargarBase]);

  function elegirArchivo(nuevo: File | null) {
    setArchivo(nuevo);
    if (vistaActual.current) URL.revokeObjectURL(vistaActual.current);
    vistaActual.current = nuevo ? URL.createObjectURL(nuevo) : null;
    setVistaPrevia(vistaActual.current);
    setLeido(null);
    setFilas([]);
  }

  async function analizar() {
    if (!archivo) return showToast("Selecciona una imagen primero", "error");
    setOcupada("Analizando imagen con Gemini…");
    try {
      const fd = new FormData();
      fd.append("image", archivo);
      fd.append("equipos", JSON.stringify(equipos.map((e) => e.nombre)));
      const res = await fetch("/api/admin/jornada-gemini", { method: "POST", body: fd });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(
          `${payload.error || "Error Gemini"}${payload.detail ? `: ${String(payload.detail).slice(0, 400)}` : ""}`,
        );
      }

      const datos = payload.data as JornadaGeminiResponse;
      let equiposActuales = equipos;
      let jornadasActuales = jornadas;

      // Detectar categoría y competición por el nombre que trae la captura.
      if (datos.competicion) {
        let mejorCategoria = categoria;
        let mejorCompeticion = competicionId;
        let mejorPuntos = 0;
        for (const cat of CATEGORIAS) {
          for (const fila of competitionsForCategory(catalogo, cat)) {
            const puntos = parecido(datos.competicion, fila.nombre);
            if (puntos > mejorPuntos && puntos >= 0.3) {
              mejorPuntos = puntos;
              mejorCategoria = cat;
              mejorCompeticion = fila.id;
            }
          }
        }
        if (mejorCategoria !== categoria || mejorCompeticion !== competicionId) {
          setCategoria(mejorCategoria);
          setElegida(mejorCompeticion);
          const otra = await cargarPantallaCalendario(mejorCompeticion, "");
          equiposActuales = otra.equipos as ConNombre[];
          jornadasActuales = otra.jornadas as JornadaCatalogo[];
          setEquipos(equiposActuales);
          setJornadas(jornadasActuales);
        }
      }

      // Y la jornada, por número.
      if (datos.jornada && jornadasActuales.length > 0) {
        const numero = Number.parseInt(datos.jornada, 10);
        const encontrada = jornadasActuales.find((j) => j.numero === numero);
        if (encontrada) setJornadaId(encontrada.id);
      }

      setLeido(datos);
      setModelo(payload.model || "");
      setFilas(construirFilas(datos, equiposActuales, campos));
      showToast("Analizado. Comprueba los cruces antes de guardar.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Error al analizar", "error");
    } finally {
      setOcupada(null);
    }
  }

  async function crearLaJornada(numero: number) {
    if (!competicionId) return;
    setOcupada(`Creando jornada ${numero}…`);
    try {
      const resultado = await crearJornada({
        competicionId,
        numero: String(numero),
        fechaInicio: "",
        nombreFase: "",
      });
      if (!resultado.ok) {
        showToast(resultado.error, "error");
        await cargarBase();
        return;
      }
      showToast(`Jornada ${numero} creada correctamente`);
      await cargarBase();
      setJornadaId(resultado.datos.id);
    } catch {
      showToast("No se pudo crear la jornada. Comprueba la conexión.", "error");
    } finally {
      setOcupada(null);
    }
  }

  const cambiarFila = (indice: number, cambio: Partial<FilaRevision>) =>
    setFilas((prev) => prev.map((f, i) => (i === indice ? { ...f, ...cambio } : f)));

  async function guardar() {
    const aGuardar = filas.filter(
      (f) => f.selected && !f.extracted.descansa && f.localId && f.visitanteId,
    );
    for (const f of aGuardar) {
      if (f.localId === f.visitanteId) {
        return showToast(
          `Error: ${f.extracted.localNombre} no puede jugar contra sí mismo.`,
          "error",
        );
      }
    }
    if (!aGuardar.length) return showToast("No hay filas seleccionadas con datos válidos", "error");
    if (!jornadaId) return showToast("Selecciona una jornada de destino", "error");

    setOcupada("Guardando partidos…");
    let ok = 0;
    let errores = 0;
    try {
      for (const fila of aGuardar) {
        // Una acción por fila: identifica el partido por el cruce, resuelve el campo por nombre
        // y deja el estado coherente con el marcador.
        const resultado = await guardarPartidoDeJornada({
          jornadaId,
          equipoLocalId: fila.localId,
          equipoVisitanteId: fila.visitanteId,
          golesLocal: fila.golesLocal,
          golesVisitante: fila.golesVisitante,
          fecha: matchLocalDateTimeToIso(normalizarFecha(fila.fecha)) ?? "",
          campoId: fila.campoId || "",
          campoNombre: fila.campoNombre,
          campoPoblacion: fila.campoPoblacion,
        });
        if (resultado.ok) ok++;
        else {
          errores++;
          console.error("No se pudo guardar la fila:", resultado.error);
        }
      }
    } catch (error) {
      // Antes de la 6H esto dejaba la pantalla ocupada para siempre.
      console.error(error);
      showToast(
        `No se pudieron guardar los partidos (${ok} guardados). Comprueba la conexión y vuelve a intentarlo.`,
        "error",
      );
      return;
    } finally {
      setOcupada(null);
    }

    if (errores === 0) {
      showToast(`${ok} partido(s) guardados correctamente`);
      setLeido(null);
      setFilas([]);
      elegirArchivo(null);
    } else {
      showToast(`${ok} guardados, ${errores} con errores. Revisa la consola.`, "error");
    }
  }

  const seleccionadas = filas.filter((f) => f.selected && !f.extracted.descansa).length;
  const jornadaLeida = leido?.jornada ? Number.parseInt(String(leido.jornada), 10) : null;
  const faltaJornada =
    jornadaLeida !== null &&
    Number.isFinite(jornadaLeida) &&
    !jornadas.some((j) => j.numero === jornadaLeida);
  const hayOcupacion = ocupada !== null;

  return (
    <div className={styles.panel}>
      <div className={styles.cabecera}>
        <div>
          <h3>Importar jornada desde imagen</h3>
          <p>
            Sube una captura de resultados de la federación. Gemini la lee, la pantalla enlaza
            equipos y campos, y revisas antes de guardar.
          </p>
        </div>
        {modelo && <span className={styles.modelo}>{modelo}</span>}
      </div>

      <section aria-label="Destino">
        <h4 className={styles.titulo}>Dónde se guarda</h4>
        <div className={styles.fila}>
          <Select
            label="Categoría"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            disabled={hayOcupacion}
          >
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Select
            label="Competición"
            value={competicionId}
            onChange={(e) => setElegida(e.target.value)}
            disabled={hayOcupacion || opciones.length === 0}
          >
            {opciones.length === 0 && <option value="">Sin competiciones</option>}
            {opciones.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </Select>
          <Select
            label="Jornada de destino"
            value={jornadaId}
            onChange={(e) => setJornadaId(e.target.value)}
            disabled={hayOcupacion}
          >
            <option value="">Elegir jornada</option>
            {jornadas.map((j) => (
              <option key={j.id} value={j.id}>
                Jornada {j.numero}
              </option>
            ))}
          </Select>
          {faltaJornada && jornadaLeida !== null && (
            <Button
              variant="secondary"
              onClick={() => void crearLaJornada(jornadaLeida)}
              disabled={hayOcupacion}
            >
              Crear jornada {jornadaLeida}
            </Button>
          )}
        </div>
      </section>

      <div
        className={styles.dropzone}
        data-con-archivo={archivo !== null}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const soltado = e.dataTransfer.files?.[0];
          if (soltado) elegirArchivo(soltado);
        }}
      >
        <Field
          id="jornada-file-input"
          label="Captura de la jornada"
          hint="Imagen o PDF. También puedes arrastrarla aquí."
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => elegirArchivo(e.target.files?.[0] ?? null)}
          disabled={hayOcupacion}
        />
        <div className={styles.accion}>
          <Button onClick={() => void analizar()} disabled={hayOcupacion || !archivo}>
            Analizar con Gemini
          </Button>
          {archivo && (
            <span className={styles.nota}>
              {archivo.name} · {(archivo.size / 1024).toFixed(0)} KB
            </span>
          )}
        </div>
      </div>

      {ocupada && <LoadingState title={ocupada} />}

      {vistaPrevia && (
        <div className={styles.vistaPrevia}>
          {archivo?.type === "application/pdf" ? (
            <iframe src={vistaPrevia} title="Vista previa del PDF" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- vista previa en memoria
            <img src={vistaPrevia} alt="Vista previa de la captura" />
          )}
        </div>
      )}

      {filas.length > 0 && (
        <section aria-label="Revisión">
          <div className={styles.tarjetaCabecera}>
            <h4 className={styles.titulo}>
              Resultados leídos{leido?.jornada ? ` · Jornada ${leido.jornada}` : ""}
            </h4>
            <span className={styles.nota}>{seleccionadas} seleccionado(s)</span>
          </div>
          {leido?.warnings && leido.warnings.length > 0 && (
            <ul className={styles.avisos} aria-label="Avisos de la lectura">
              {leido.warnings.map((aviso, i) => (
                <li key={i}>{aviso}</li>
              ))}
            </ul>
          )}
          <div className={styles.tarjetas}>
            {filas.map((fila, i) => (
              <TarjetaFila
                key={fila.key}
                fila={fila}
                numero={i + 1}
                equipos={equipos}
                campos={campos}
                onCambiar={(cambio) => cambiarFila(i, cambio)}
                deshabilitada={hayOcupacion}
              />
            ))}
          </div>
          <div className={styles.accion}>
            <Button
              disabled={hayOcupacion || seleccionadas === 0 || !jornadaId}
              onClick={() =>
                showConfirm(
                  `¿Guardar ${seleccionadas} partido(s)? Los que ya existan se actualizarán.`,
                  guardar,
                )
              }
            >
              Guardar {seleccionadas} partido(s)
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
