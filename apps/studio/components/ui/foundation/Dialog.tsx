"use client";

import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import styles from "./Dialog.module.css";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  closeLabel?: string;
  pending?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  closeLabel = "Cerrar diálogo",
  pending = false,
  initialFocusRef,
}: DialogProps) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusRef = useRef(initialFocusRef);
  useEffect(() => {
    focusRef.current = initialFocusRef;
  }, [initialFocusRef]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const previous = dialog.ownerDocument.activeElement;
    dialog.showModal();
    (focusRef.current?.current ?? headingRef.current)?.focus();
    return () => {
      dialog.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [open]);

  function focusEdge(edge: "first" | "last") {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const controls = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        "a[href], button, input, select, textarea, summary, [contenteditable], [tabindex]",
      ),
    ).filter(
      (element) =>
        element.tabIndex >= 0 &&
        !element.hasAttribute("data-focus-guard") &&
        !element.matches(":disabled") &&
        !element.closest("[inert]") &&
        element.checkVisibility({ checkVisibilityCSS: true }),
    );
    (edge === "first" ? controls[0] : controls[controls.length - 1])?.focus();
    if (!controls.length) headingRef.current?.focus();
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={id + "-title"}
      aria-describedby={description ? id + "-description" : undefined}
      aria-busy={pending || undefined}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onClose();
      }}
      onClose={() => {
        // Ignore queued close events from effect cleanup or a quick reopen.
        if (open && !dialogRef.current?.open && !pending) onClose();
      }}
    >
      {/* Los límites conservan el Tab nativo dentro de controles compuestos, como fechas. */}
      <span
        tabIndex={0}
        data-focus-guard=""
        className={styles.focusGuard}
        onFocus={() => focusEdge("last")}
      />
      <div className={styles.header}>
        <h2 ref={headingRef} tabIndex={-1} id={id + "-title"} className={styles.title}>
          {title}
        </h2>
        <button
          type="button"
          className={styles.button}
          disabled={pending}
          onClick={onClose}
          aria-label={closeLabel}
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
      {description ? (
        <p id={id + "-description"} className={styles.description}>
          {description}
        </p>
      ) : null}
      <div className={styles.content}>{children}</div>
      {footer ? <div className={styles.footer}>{footer}</div> : null}
      <span
        tabIndex={0}
        data-focus-guard=""
        className={styles.focusGuard}
        onFocus={() => focusEdge("first")}
      />
    </dialog>
  );
}
