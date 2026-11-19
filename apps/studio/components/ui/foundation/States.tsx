import type { ReactNode } from "react";
import Link from "next/link";
import styles from "./Presentation.module.css";

export function StateLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link className={styles.stateLink} href={href} transitionTypes={["nav-forward"]}>
      {children}
    </Link>
  );
}
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
      {action && <div className={styles.stateAction}>{action}</div>}
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
      {detail && <p className={styles.detail}>{detail}</p>}
      {action && <div className={styles.stateAction}>{action}</div>}
    </div>
  );
}
