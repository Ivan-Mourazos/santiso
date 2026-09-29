import type { ReactNode } from "react";
import styles from "./Presentation.module.css";
export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
}) {
  return (
    <header className={styles.header}>
      <div>
        {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
        {/* h2: el h1 de cada pantalla ya lo pone la cabecera del Studio. */}
        <h2 className={styles.title}>{title}</h2>
        {description && <p className={styles.detail}>{description}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
