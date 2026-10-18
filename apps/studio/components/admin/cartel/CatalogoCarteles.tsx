"use client";

import Link from "next/link";
import { useStudio } from "@/components/studio/StudioContext";
import styles from "./CatalogoCarteles.module.css";

interface Entrada {
  titulo: string;
  para: string;
  href: string;
  /** Solo del administrador (los técnicos no hacen carteles salvo convocatoria y once). */
  admin?: boolean;
}

/**
 * Los carteles en el orden de la semana: lo de antes del partido, lo de después, la liga y lo
 * del club. Convocatoria y once tienen su cartel en su propia pantalla, que es donde se hacen.
 */
const GRUPOS: { titulo: string; entradas: Entrada[] }[] = [
  {
    titulo: "Antes del partido",
    entradas: [
      {
        titulo: "Próximos partidos",
        para: "La agenda del fin de semana",
        href: "/admin/carteles?plantilla=proximos",
        admin: true,
      },
      {
        titulo: "Cartel de partido",
        para: "Rival, día, hora y campo",
        href: "/admin/carteles?plantilla=partido",
        admin: true,
      },
      { titulo: "Convocatoria", para: "Los convocados del partido", href: "/admin/convocatoria" },
      { titulo: "Once inicial", para: "La alineación en el campo", href: "/admin/alineacion" },
    ],
  },
  {
    titulo: "Después del partido",
    entradas: [
      {
        titulo: "Resultado",
        para: "Marcador y goleadores",
        href: "/admin/carteles?plantilla=resumo",
        admin: true,
      },
      {
        titulo: "O Noso 11",
        para: "El once que jugó, con foto",
        href: "/admin/carteles?plantilla=noso11",
        admin: true,
      },
      {
        titulo: "Cronoloxía",
        para: "Goles, tarjetas y cambios minuto a minuto",
        href: "/admin/carteles?plantilla=cronoloxia",
        admin: true,
      },
    ],
  },
  {
    titulo: "Liga",
    entradas: [
      {
        titulo: "Clasificación",
        para: "La tabla de la competición",
        href: "/admin/carteles?plantilla=clasificacion",
        admin: true,
      },
    ],
  },
  {
    titulo: "Club",
    entradas: [
      {
        titulo: "Fichajes y renovaciones",
        para: "Nova incorporación",
        href: "/admin/carteles?plantilla=multiusos&tema=fichaje",
        admin: true,
      },
      {
        titulo: "Comunicados y avisos",
        para: "Aviso oficial o parte médico",
        href: "/admin/carteles?plantilla=multiusos&tema=formal",
        admin: true,
      },
      {
        titulo: "Celebraciones y despedidas",
        para: "Títulos, ascensos, grazas",
        href: "/admin/carteles?plantilla=multiusos&tema=celebracion",
        admin: true,
      },
    ],
  },
];

/** Carteles sin plantilla elegida: el catálogo por grupos, una fila por cartel. */
export default function CatalogoCarteles() {
  const { acceso, params } = useStudio();
  const tecnico = acceso?.rol === "tecnico";
  // La categoría elegida viaja con el enlace, como en el resto del panel.
  const categoria = params.get("categoria");
  const conCategoria = (href: string) =>
    categoria ? `${href}${href.includes("?") ? "&" : "?"}categoria=${encodeURIComponent(categoria)}` : href;
  return (
    <div className={styles.catalogo}>
      {GRUPOS.map((grupo) => {
        const entradas = grupo.entradas.filter((e) => !(tecnico && e.admin));
        if (entradas.length === 0) return null;
        return (
          <section key={grupo.titulo} aria-labelledby={`carteles-${grupo.titulo}`}>
            <h2 id={`carteles-${grupo.titulo}`} className={styles.grupo}>
              {grupo.titulo}
            </h2>
            <div className={styles.lista}>
              {entradas.map((e) => (
                <Link
                  key={e.href}
                  className={styles.fila}
                  href={conCategoria(e.href)}
                  transitionTypes={["nav-forward"]}
                >
                  <span className={styles.texto}>
                    <strong>{e.titulo}</strong>
                    <span>{e.para}</span>
                  </span>
                  <span className={styles.flecha} aria-hidden="true">
                    ›
                  </span>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
