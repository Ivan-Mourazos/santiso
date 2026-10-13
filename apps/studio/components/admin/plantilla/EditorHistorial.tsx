"use client";

import { useId } from "react";
import { Button } from "@/components/ui/foundation/Button";
import {
  filaSiguiente,
  filasDeHistorial,
  temporadasPosibles,
  textoDeHistorial,
  type FilaHistorial,
} from "@/lib/plantilla/historial";
import styles from "./Plantilla.module.css";

interface Props {
  /** El historial como se guarda: una línea «25/26: Club» por temporada. */
  valor: string;
  onCambiar: (valor: string) => void;
}

/**
 * Historial deportivo por filas: se elige la temporada, se escribe el club y «Añadir temporada»
 * propone la anterior con el mismo club. Nada de escribir el formato a mano.
 */
export default function EditorHistorial({ valor, onCambiar }: Props) {
  const id = useId();
  // Las filas a medio escribir (sin club todavía) viven en el propio texto: una línea «25/26: ».
  const filas: FilaHistorial[] = valor
    .split("\n")
    .filter((linea) => linea.trim())
    .map((linea) => filasDeHistorial(linea)[0] ?? { temporada: "", equipo: "" });
  const temporadas = temporadasPosibles(new Date());
  const escribir = (nuevas: FilaHistorial[]) =>
    onCambiar(
      nuevas
        .map((fila) => (fila.temporada ? `${fila.temporada}: ${fila.equipo}` : fila.equipo))
        .join("\n"),
    );
  const cambiar = (indice: number, parche: Partial<FilaHistorial>) =>
    escribir(filas.map((fila, i) => (i === indice ? { ...fila, ...parche } : fila)));

  return (
    <div className={styles.historial} role="group" aria-labelledby={`${id}-titulo`}>
      <p id={`${id}-titulo`} className={styles.historialTitulo}>
        Historial deportivo
      </p>
      {filas.length === 0 && (
        <p className={styles.historialVacio}>Sin temporadas apuntadas todavía.</p>
      )}
      <ul className={styles.historialFilas}>
        {filas.map((fila, i) => (
          <li key={i}>
            <select
              className={styles.historialTemporada}
              aria-label={`Temporada de la fila ${i + 1}`}
              value={fila.temporada}
              onChange={(e) => cambiar(i, { temporada: e.target.value })}
            >
              {!temporadas.includes(fila.temporada) && (
                <option value={fila.temporada}>{fila.temporada || "—"}</option>
              )}
              {temporadas.map((temporada) => (
                <option key={temporada} value={temporada}>
                  {temporada}
                </option>
              ))}
            </select>
            <input
              className={styles.historialEquipo}
              aria-label={`Club de la fila ${i + 1}`}
              placeholder="Club y, si quieres, categoría"
              value={fila.equipo}
              onChange={(e) => cambiar(i, { equipo: e.target.value.replace(/\n/gu, " ") })}
              autoComplete="off"
            />
            <Button
              variant="secondary"
              size="sm"
              aria-label={`Quitar la fila ${i + 1}`}
              onClick={() => escribir(filas.filter((_, j) => j !== i))}
            >
              Quitar
            </Button>
          </li>
        ))}
      </ul>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => escribir([...filas, filaSiguiente(filas, new Date())])}
      >
        Añadir temporada
      </Button>
    </div>
  );
}

/** Lo que se guarda: sin las filas que se quedaron sin club. */
export function historialParaGuardar(valor: string): string {
  return textoDeHistorial(filasDeHistorial(valor).filter((fila) => fila.equipo.trim()));
}
