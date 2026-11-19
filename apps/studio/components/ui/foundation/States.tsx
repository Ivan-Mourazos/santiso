import type { ReactNode } from "react";
import styles from "./Presentation.module.css";
export function EmptyState({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <section className={styles.state}>
      <h2>{title}</h2>
      {detail && <p className={styles.detail}>{detail}</p>}
      {action}
    </section>
  );
}
/** Reserva el espacio de las primeras filas o del marcador mientras llegan los datos. */
export function LoadingState({
  title = "Cargando…",
  shape = "list",
}: {
  title?: string;
  shape?: "list" | "table" | "scoreboard";
}) {
  return (
    <div className={styles.loading} data-shape={shape} role="status">
      <p>{title}</p>
      <span aria-hidden="true" />
      <span aria-hidden="true" />
      <span aria-hidden="true" />
    </div>
  );
}
export function ErrorState({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className={`${styles.state} ${styles.error}`} role="alert">
      <h2>{title}</h2>
      {detail && <p>{detail}</p>}
      {action}
    </div>
  );
}
