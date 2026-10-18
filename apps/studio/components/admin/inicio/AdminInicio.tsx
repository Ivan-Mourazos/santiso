"use client";

import NuestrosPartidos from "./NuestrosPartidos";
import styles from "./Inicio.module.css";

/**
 * Portada del Studio: el partido que toca de cada equipo, en tablero. El resto de pantallas está
 * en la barra de abajo (cada pestaña abre su hoja); aquí no se repite el menú.
 */
export default function AdminInicio() {
  return (
    <section className={styles.inicio} aria-label="Inicio">
      <NuestrosPartidos />
    </section>
  );
}
