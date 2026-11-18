"use client";

import Image from "next/image";
import NuestrosPartidos from "./NuestrosPartidos";
import styles from "./Inicio.module.css";

/**
 * Portada del Studio: el partido que toca de cada equipo, en tablero. El resto de pantallas está
 * en la barra de abajo (cada pestaña abre su hoja); aquí no se repite el menú.
 */
export default function AdminInicio() {
  return (
    <section className={styles.inicio} aria-label="Inicio">
      <p className={styles.firma}>
        <Image src="/logos/app-192.png" alt="" width={24} height={24} />
        U.D. Santiso
      </p>
      <NuestrosPartidos />
    </section>
  );
}
