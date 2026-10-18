"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cambiarParametros, rutaSeccion } from "@/lib/navigation/contexto";
import type { EntradaMenu, GrupoMenu } from "@/lib/navigation/menu";
import { useStudio } from "./StudioContext";
import styles from "./TarjetasMenu.module.css";

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
      {grupos.map((grupo) => (
        <section key={grupo.titulo} aria-label={grupo.titulo}>
          <Titulo className={styles.grupo}>{grupo.titulo}</Titulo>
          <div className={grupo.forma === "pastillas" ? styles.pastillas : styles.tarjetas}>
            {grupo.entradas.map((entrada) => (
              <Link
                key={`${entrada.seccion}-${entrada.label}`}
                href={ruta(entrada)}
                aria-current={actual(entrada) ? "page" : undefined}
                className={grupo.forma === "pastillas" ? styles.pastilla : styles.tarjeta}
                onNavigate={(event) => {
                  event.preventDefault();
                  alElegir?.();
                  if (!actual(entrada)) navigate(ruta(entrada), "nav-forward");
                }}
              >
                {grupo.forma !== "pastillas" && (
                  <span className={styles.icono}>
                    <svg
                      aria-hidden="true"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d={entrada.icono} />
                    </svg>
                  </span>
                )}
                <span className={styles.texto}>
                  {entrada.label}
                  {entrada.detalle && grupo.forma !== "pastillas" && (
                    <small>{entrada.detalle}</small>
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
