"use client";

import { useState } from "react";
import { Button } from "@/components/ui/foundation/Button";
import { Field, Select } from "@/components/ui/foundation/Fields";
import { ErrorState, LoadingState } from "@/components/ui/foundation/States";
import type { CalendarioLeido } from "@/lib/server/acciones/calendario-pdf";
import {
  guardarCalendario,
  leerCalendarioPdf,
  traerCalendarioRfgf,
} from "@/lib/server/acciones/calendario-pdf";
import { useCompeticiones } from "@/lib/useCompeticiones";
import PlanCalendario from "./PlanCalendario";
import styles from "./Importar.module.css";

interface Props {
  showToast: (msg: string, type?: "success" | "error") => void;
  showConfirm: (msg: string, onConfirm: () => void) => void;
}

const CATEGORIAS = ["Senior", "Veteranos"];

/**
 * Cargar el calendario de la temporada desde el PDF de la federación, sin IA. Primero se lee y
 * se enseña el plan; solo al confirmar se crean jornadas y partidos, y lo que ya existe no se toca.
 */
export default function ImportarCalendarioPdf({ showToast, showConfirm }: Props) {
  const [categoria, setCategoria] = useState("Senior");
  const {
    competicionesEnCategoria,
    selectedCompetitionId,
    setSelectedCompetitionId,
    errorCompeticiones,
    loadCompeticiones,
  } = useCompeticiones(categoria);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [leido, setLeido] = useState<CalendarioLeido | null>(null);
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [origenLeido, setOrigenLeido] = useState<"pdf" | "federacion">("pdf");

  /** Lee el calendario del PDF subido o, sin fichero, del enlace de la federación. */
  async function leer(origen: "pdf" | "federacion" = "pdf") {
    if (origen === "pdf" && !archivo) return showToast("Elige el PDF del calendario.", "error");
    if (!selectedCompetitionId) return showToast("Elige la competición de destino.", "error");
    setOcupada(origen === "pdf" ? "Leyendo el calendario…" : "Trayendo el calendario de la federación…");
    try {
      let resultado;
      if (origen === "pdf") {
        const formulario = new FormData();
        formulario.append("calendario", archivo!);
        formulario.append("competicionId", selectedCompetitionId);
        resultado = await leerCalendarioPdf(formulario);
      } else {
        resultado = await traerCalendarioRfgf(selectedCompetitionId);
      }
      if (!resultado.ok) {
        showToast(resultado.error, "error");
        setLeido(null);
        return;
      }
      setLeido(resultado.datos);
      setOrigenLeido(origen);
      showToast("Calendario leído. Revisa el plan antes de aplicarlo.");
    } catch {
      showToast("No se pudo leer el calendario. Comprueba la conexión.", "error");
    } finally {
      setOcupada(null);
    }
  }

  function aplicar() {
    if (!leido || !selectedCompetitionId) return;
    const { resumen } = leido.plan;
    showConfirm(
      `Se crearán ${resumen.equiposNuevos} equipo(s), ${resumen.jornadasNuevas} jornada(s) y ` +
        `${resumen.crucesNuevos} partido(s). ` +
        `Lo que ya existe no se toca. ¿Continuar?`,
      async () => {
        setOcupada("Guardando el calendario…");
        try {
          const resultado = await guardarCalendario({
            competicionId: selectedCompetitionId,
            plan: leido.plan,
          });
          if (!resultado.ok) return showToast(resultado.error, "error");
          showToast(
            `Creados ${resultado.datos.equipos} equipo(s), ${resultado.datos.jornadas} jornada(s) y ` +
              `${resultado.datos.partidos} partido(s).`,
          );
          // Releer para que el plan refleje lo que acaba de escribirse.
          await leer(origenLeido);
        } catch {
          showToast("No se pudo guardar el calendario. Comprueba la conexión.", "error");
        } finally {
          setOcupada(null);
        }
      },
    );
  }

  const hayOcupacion = ocupada !== null;

  return (
    <div className={styles.panel}>
      <div className={styles.cabecera}>
        <div>
          <h3>Cargar calendario desde PDF</h3>
          <p>
            El PDF de la federación, leído en el ordenador, sin IA: súbelo o deja que el Studio lo
            baje con el enlace de la competición. Antes de escribir nada se enseña qué se va a crear.
          </p>
        </div>
      </div>

      {errorCompeticiones ? (
        <ErrorState
          title="No se pudieron cargar las competiciones"
          detail={errorCompeticiones}
          action={<Button onClick={() => void loadCompeticiones()}>Reintentar</Button>}
        />
      ) : (
        <div className={styles.fila}>
          <Select
            id="cal-categoria"
            label="Categoría"
            value={categoria}
            onChange={(e) => {
              // Cambiar de ámbito invalida el plan: se calculó contra la competición anterior.
              setCategoria(e.target.value);
              setLeido(null);
            }}
            disabled={hayOcupacion}
          >
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Select
            id="cal-competicion"
            label="Competición de destino"
            value={selectedCompetitionId}
            onChange={(e) => {
              setSelectedCompetitionId(e.target.value);
              setLeido(null);
            }}
            disabled={hayOcupacion}
          >
            <option value="">Elige una competición</option>
            {competicionesEnCategoria.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div className={styles.dropzone} data-con-archivo={archivo !== null}>
        <Field
          id="cal-file"
          label="PDF del calendario"
          type="file"
          accept="application/pdf"
          disabled={hayOcupacion}
          onChange={(e) => {
            setArchivo(e.target.files?.[0] ?? null);
            setLeido(null);
          }}
        />
        <div className={styles.accion}>
          <Button
            onClick={() => void leer()}
            disabled={hayOcupacion || !archivo || !selectedCompetitionId}
          >
            Leer calendario (sin IA)
          </Button>
          <Button
            variant="secondary"
            onClick={() => void leer("federacion")}
            disabled={hayOcupacion || !selectedCompetitionId}
          >
            Traer de la federación
          </Button>
        </div>
      </div>

      {ocupada && <LoadingState title={ocupada} />}

      {leido && <PlanCalendario leido={leido} ocupado={hayOcupacion} onAplicar={aplicar} />}
    </div>
  );
}
