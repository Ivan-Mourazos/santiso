"use client";
import Link from "next/link";
import { useId, type CSSProperties } from "react";
import { usePathname } from "next/navigation";
import { cambiarParametros, rutaSeccion } from "@/lib/navigation/contexto";
import type { EntradaMenu, GrupoMenu } from "@/lib/navigation/menu";
import { useStudio } from "./StudioContext";
import styles from "./TarjetasMenu.module.css";

/**
 * El icono como máscara de CSS y no como `<svg>` en la página: el WebKit de las pruebas se caía
 * al capturar decenas de SVG en la animación entre pantallas.
 */
function mascara(trazo: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="${trazo}"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/**
 * Los grupos de una pestaña en tarjetas de dos en dos (los ajustes, en pastillas). Lo usan la
 * hoja que abre cada pestaña y el catálogo de Carteles, para que se vean igual.
 */
export function TarjetasMenu({
  grupos,
  alElegir,
  titulo = "h3",
}: {
  grupos: GrupoMenu[];
  /** Antes de navegar: cerrar la hoja. */
  alElegir?: () => void;
  titulo?: "h2" | "h3";
}) {
  const pathname = usePathname();
  const { params, navigate } = useStudio();
  const Titulo = titulo;
  // La explicación de cada tarjeta es su descripción, no parte del nombre.
  const base = useId();
  const ruta = (entrada: EntradaMenu) =>
    rutaSeccion(
      entrada.seccion,
      cambiarParametros(params, {
        plantilla: entrada.extra?.plantilla ?? null,
        tema: entrada.extra?.tema ?? null,
        partido: null,
      }),
    );
  const actual = (entrada: EntradaMenu) =>
    pathname === `/admin/${entrada.seccion}` &&
    (!entrada.extra?.plantilla || entrada.extra.plantilla === params.get("plantilla"));
  return (
    <div className={styles.hoja}>
      {grupos.map((grupo, g) => (
        <section key={grupo.titulo} aria-label={grupo.titulo}>
          <Titulo className={styles.grupo}>{grupo.titulo}</Titulo>
          <div className={grupo.forma === "pastillas" ? styles.pastillas : styles.tarjetas}>
            {grupo.entradas.map((entrada, e) => (
              <Link
                key={`${entrada.seccion}-${entrada.label}`}
                href={ruta(entrada)}
                aria-describedby={
                  entrada.detalle && grupo.forma !== "pastillas" ? `${base}-${g}-${e}` : undefined
                }
                aria-current={actual(entrada) ? "page" : undefined}
                className={grupo.forma === "pastillas" ? styles.pastilla : styles.tarjeta}
                onNavigate={(event) => {
                  event.preventDefault();
                  alElegir?.();
                  if (!actual(entrada)) navigate(ruta(entrada), "nav-forward");
                }}
              >
                {grupo.forma !== "pastillas" && (
                  <span
                    className={styles.icono}
                    aria-hidden="true"
                    style={{ "--icono": mascara(entrada.icono) } as CSSProperties}
                  />
                )}
                <span className={styles.texto}>
                  {entrada.label}
                  {entrada.detalle && grupo.forma !== "pastillas" && (
                    <small id={`${base}-${g}-${e}`} aria-hidden="true">
                      {entrada.detalle}
                    </small>
                  )}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
