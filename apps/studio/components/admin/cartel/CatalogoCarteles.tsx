"use client";

import Link from "next/link";
import { useStudio } from "@/components/studio/StudioContext";
import type { Seccion } from "@/lib/navigation/contexto";
import { MENU } from "@/lib/navigation/menu";
import styles from "./CatalogoCarteles.module.css";

interface Entrada {
  titulo: string;
  para: string;
  href: string;
  /** Solo del administrador (los técnicos no hacen carteles salvo convocatoria y once). */
  admin?: boolean;
}

/** Convocatoria y once tienen su cartel en su propia pantalla, que es donde se hacen. */
const EN_SU_PANTALLA: readonly Seccion[] = ["convocatoria", "alineacion"];

/**
 * Los grupos y nombres salen de la hoja «Carteles» de la barra (`MENU`), para que el catálogo
 * y la hoja digan lo mismo y en el mismo orden. Antes del partido suma convocatoria y once.
 */
const GRUPOS: { titulo: string; entradas: Entrada[] }[] = (() => {
  const todas = MENU.flatMap((pestana) => (pestana.grupos ?? []).flatMap((g) => g.entradas));
  const conPantalla = EN_SU_PANTALLA.flatMap((seccion) => {
    const e = todas.find((x) => x.seccion === seccion && !x.extra);
    return e ? [{ titulo: e.label, para: e.detalle ?? "", href: `/admin/${seccion}` }] : [];
  });
  const carteles = MENU.find((pestana) => pestana.id === "carteles")?.grupos ?? [];
  return carteles.map((grupo) => {
    const entradas: Entrada[] = grupo.entradas.map((e) => {
      const consulta = new URLSearchParams(e.extra ?? {}).toString();
      return {
        titulo: e.label,
        para: e.detalle ?? "",
        href: `/admin/${e.seccion}${consulta ? `?${consulta}` : ""}`,
        admin: e.admin,
      };
    });
    return {
      titulo: grupo.titulo,
      entradas: grupo.titulo === "Antes del partido" ? [...entradas, ...conPantalla] : entradas,
    };
  });
})();

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
