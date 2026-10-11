import type { ReactNode } from "react";
import { useEsMovil } from "@/components/ui/foundation/FiltrosMovil";
import s from "./PlegableMovil.module.css";

/** Escritorio conserva sus campos; móvil abre opciones sin alargar el formulario inicial. */
export function PlegableMovil({
  titulo,
  children,
  grupo,
  partido = false,
}: {
  titulo: string;
  children: ReactNode;
  grupo?: string;
  partido?: boolean;
}) {
  const movil = useEsMovil();
  if (!movil) return <>{children}</>;
  return (
    <details className={s.bloque} name={grupo} data-partido-plegado={partido || undefined}>
      <summary title={titulo}>
        <span>{titulo}</span>
        <span aria-hidden="true">⌄</span>
      </summary>
      <div className={s.contenido}>{children}</div>
    </details>
  );
}
