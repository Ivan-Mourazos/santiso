import type { ReactNode } from "react";
import { iniciales } from "@/lib/iniciales";
import styles from "./IdentidadJugador.module.css";

export function IdentidadJugador({
  nombre,
  nombreVisible = nombre,
  fotoUrl,
  dorsal,
  completa = false,
  children,
}: {
  nombre: string;
  nombreVisible?: string;
  fotoUrl: string | null;
  dorsal?: number | null;
  completa?: boolean;
  children?: ReactNode;
}) {
  const Nombre = completa ? "h2" : "strong";
  return (
    <div className={styles.identidad}>
      <div className={styles.retrato}>
        {fotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- media local
          <img src={fotoUrl} alt="" width={64} height={64} />
        ) : (
          <span className={styles.iniciales} aria-hidden="true">{iniciales(nombre)}</span>
        )}
      </div>
      <div className={styles.texto}>
        <div className={styles.linea}>
          <Nombre className={completa ? styles.titular : undefined}>{nombreVisible}</Nombre>
          {dorsal != null && <span className={styles.dorsal}>Dorsal {dorsal}</span>}
        </div>
        {children}
      </div>
    </div>
  );
}
