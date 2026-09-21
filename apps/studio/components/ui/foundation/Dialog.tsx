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

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={id + "-title"}
      aria-describedby={description ? id + "-description" : undefined}
      aria-busy={pending || undefined}
      onKeyDown={(event) => {
        if (event.key !== "Tab" || event.defaultPrevented || !event.currentTarget.open) return;
        const dialog = event.currentTarget;
        const candidates = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            "a[href], area[href], button, input, select, textarea, iframe, object, embed, summary, audio[controls], video[controls], [contenteditable], [tabindex]",
          ),
        )
          .filter(
            (element) =>
              element.tabIndex >= 0 &&
              !element.matches(":disabled") &&
              !element.closest("[inert]") &&
              element.checkVisibility({ checkVisibilityCSS: true }),
          )
          .sort((left, right) => {
            // El orden positivo precede a tabindex=0; sort conserva el orden DOM entre iguales.
            const leftOrder = left.tabIndex || Number.MAX_SAFE_INTEGER;
            const rightOrder = right.tabIndex || Number.MAX_SAFE_INTEGER;
            return leftOrder - rightOrder;
          });
        event.preventDefault();
        const index = candidates.findIndex(
          (element) => element === dialog.ownerDocument.activeElement,
        );
        const nextIndex = event.shiftKey
          ? index <= 0
            ? candidates.length - 1
            : index - 1
          : (index + 1) % candidates.length;
        (candidates[nextIndex] ?? headingRef.current)?.focus();
      }}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onClose();
      }}
      onClose={() => {
        // Ignore queued close events from effect cleanup or a quick reopen.
        if (open && !dialogRef.current?.open && !pending) onClose();
      }}
    >
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
    </dialog>
  );
}
