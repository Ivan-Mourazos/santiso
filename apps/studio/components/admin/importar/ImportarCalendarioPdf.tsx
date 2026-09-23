"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/foundation/Button";
import { Field, Select } from "@/components/ui/foundation/Fields";
import { ErrorState, LoadingState } from "@/components/ui/foundation/States";
import type { CalendarioLeido } from "@/lib/server/acciones/calendario-pdf";
import { guardarCalendario, leerCalendarioPdf } from "@/lib/server/acciones/calendario-pdf";
import { useCompeticiones } from "@/lib/useCompeticiones";
import styles from "./Importar.module.css";

interface Props {
  showToast: (msg: string, type?: "success" | "error") => void;
  showConfirm: (msg: string, onConfirm: () => void) => void;
}

const CATEGORIAS = ["Senior", "Femenino", "Veteranos"];

function Dato({
  valor,
  etiqueta,
  tono,
}: {
  valor: number;
  etiqueta: string;
  tono?: "bien" | "neutro" | "mal";
}) {
  return (
    <p className={styles.dato} data-tono={tono}>
      <strong>{valor}</strong>
      <span>{etiqueta}</span>
    </p>
  );
}

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

  const porJornada = useMemo(() => {
    if (!leido) return [];
    const mapa = new Map<number, typeof leido.plan.cruces>();
    for (const cruce of leido.plan.cruces) {
      const lista = mapa.get(cruce.jornada) ?? [];
      lista.push(cruce);
      mapa.set(cruce.jornada, lista);
    }
    return [...mapa.entries()].sort((a, b) => a[0] - b[0]);
  }, [leido]);

  async function leer() {
    if (!archivo) return showToast("Elige el PDF del calendario.", "error");
    if (!selectedCompetitionId) return showToast("Elige la competición de destino.", "error");
    setOcupada("Leyendo el calendario…");
    try {
      const formulario = new FormData();
      formulario.append("calendario", archivo);
      formulario.append("competicionId", selectedCompetitionId);
      const resultado = await leerCalendarioPdf(formulario);
      if (!resultado.ok) {
        showToast(resultado.error, "error");
        setLeido(null);
        return;
      }
      setLeido(resultado.datos);
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
      `Se crearán ${resumen.jornadasNuevas} jornada(s) y ${resumen.crucesNuevos} partido(s). ` +
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
            `Creadas ${resultado.datos.jornadas} jornada(s) y ${resultado.datos.partidos} partido(s).`,
          );
          // Releer para que el plan refleje lo que acaba de escribirse.
          await leer();
        } catch {
          showToast("No se pudo guardar el calendario. Comprueba la conexión.", "error");
        } finally {
          setOcupada(null);
        }
      },
    );
  }

  const resumen = leido?.plan.resumen;
  const nadaQueHacer =
    resumen !== undefined && resumen.jornadasNuevas === 0 && resumen.crucesNuevos === 0;
  const hayOcupacion = ocupada !== null;

  return (
    <div className={styles.panel}>
      <div className={styles.cabecera}>
        <div>
          <h3>Cargar calendario desde PDF</h3>
          <p>
            El PDF de la federación, leído en el ordenador, sin IA. Antes de escribir nada se enseña
            qué se va a crear.
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
        </div>
      </div>

      {ocupada && <LoadingState title={ocupada} />}

      {leido && resumen && (
        <section aria-label="Plan de importación">
          <h4 className={styles.titulo}>{leido.competicion}</h4>
          <p className={styles.nota}>Temporada {leido.temporada}</p>

          <div className={styles.resumen}>
            <Dato valor={resumen.jornadasNuevas} etiqueta="jornadas nuevas" />
            <Dato valor={resumen.crucesNuevos} etiqueta="partidos nuevos" tono="bien" />
            <Dato valor={resumen.crucesExistentes} etiqueta="ya estaban" tono="neutro" />
            <Dato
              valor={resumen.crucesSinEquipo}
              etiqueta="sin equipo"
              tono={resumen.crucesSinEquipo > 0 ? "mal" : "neutro"}
            />
          </div>

          {leido.plan.sinResolver.length > 0 && (
            <div className={styles.avisos} role="status">
              <p>
                Estos nombres del PDF no corresponden a ningún equipo de la competición. Sus
                partidos no se crearán. Dalos de alta en «Equipos» y vuelve a leer el PDF:
              </p>
              <p>
                <strong>{leido.plan.sinResolver.join(" · ")}</strong>
              </p>
            </div>
          )}

          <div className={styles.accion}>
            <Button onClick={aplicar} disabled={hayOcupacion || nadaQueHacer}>
              {nadaQueHacer ? "Nada que crear" : "Crear jornadas y partidos"}
            </Button>
          </div>

          <div className={styles.jornadas}>
            {porJornada.map(([numero, cruces]) => (
              <div key={numero}>
                <h5 className={styles.titulo}>Jornada {numero}</h5>
                <ul>
                  {cruces.map((cruce, indice) => (
                    <li key={`${numero}-${indice}`} data-estado={cruce.estado}>
                      {cruce.estado === "nuevo" ? "+" : cruce.estado === "existe" ? "=" : "!"}{" "}
                      {cruce.localNombre} vs {cruce.visitanteNombre}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
