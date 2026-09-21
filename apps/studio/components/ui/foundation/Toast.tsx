"use client";

import styles from "./Toast.module.css";

export interface ToastProps {
  message: string | null;
  kind?: "success" | "error";
  onDismiss: () => void;
}

export function Toast({ message, kind = "success", onDismiss }: ToastProps) {
  return (
    <div className={styles.root} data-kind={kind}>
      <div role="status" aria-live="polite" aria-atomic="true" className={styles.message}>
        {message}
      </div>
      {message !== null ? (
        <button
          type="button"
          className={styles.close}
          aria-label="Cerrar aviso"
          onClick={onDismiss}
        >
          <span aria-hidden="true">×</span>
        </button>
      ) : null}
    </div>
  );
}
