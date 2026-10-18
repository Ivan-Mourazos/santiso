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
        {/* La misma flecha amarilla que los desplegables del formulario. */}
        <svg aria-hidden="true" width="12" height="8" viewBox="0 0 12 8">
          <path
            d="m1 1 5 5 5-5"
            fill="none"
            stroke="var(--ui-accent)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </summary>
      <div className={s.contenido}>{children}</div>
    </details>
  );
}
