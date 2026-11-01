"use client";
import type { CifrasRfgf, ResultadoSantiso } from "@/lib/server/consultas/fichas-rfgf";
import styles from "./Fichas.module.css";

/** «2026-10-18…» → «18/10/2026»; sin fecha, «—». */
export function fechaCorta(fecha: string | null) {
  if (!fecha) return "—";
  return `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}/${fecha.slice(0, 4)}`;
}

/** El partido visto desde el Santiso: G, E o P en su color. */
export function Resultado({ r }: { r: ResultadoSantiso | null }) {
  if (!r) return null;
  const nombre = r === "G" ? "Ganado" : r === "E" ? "Empatado" : "Perdido";
  return (
    <span className={styles.resultado} data-r={r} title={nombre} aria-label={nombre}>
      {r}
    </span>
  );
}

/** Las cifras oficiales de la federación en cuadros, las que más importan primero. */
export function CuadrosCifras({ cifras }: { cifras: CifrasRfgf }) {
  const cuadros: [string, number | string, boolean?][] = [
    ["Jugados", cifras.jugados, true],
    ["Goles", cifras.goles ?? "—", true],
    ["Titular", cifras.titular],
    ["Suplente", cifras.suplente],
    ["Convocado", cifras.convocados],
    ["Amarillas", cifras.amarillas + cifras.doblesAmarillas],
    ["Rojas", cifras.rojas],
  ];
  return (
    <div className={styles.cuadros}>
      {cuadros.map(([nombre, valor, acento]) => (
        <div key={nombre} className={`${styles.cuadro} ${acento ? styles.cuadroAcento : ""}`}>
          <strong>{valor}</strong>
          <span>{nombre}</span>
        </div>
      ))}
    </div>
  );
}
