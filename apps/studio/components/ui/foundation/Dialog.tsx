"use client";

import { useId, useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";
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
  id?: string;
  mobilePresentation?: "fullscreen" | "sheet";
  lightDismiss?: boolean;
}

/**
 * Con `html { overflow-x: clip }` (globals.css), el `overflow: hidden` del body no llega a la
 * ventana y Safari seguía moviendo la página por detrás del diálogo. Bloquear `html` tampoco
 * vale: cambiar su `overflow` en plena transición de vista cuelga WebKit (19/11/2026). Así que
 * se cortan la rueda y el arrastre que moverían el fondo, sin tocar el diseño: dentro de un
 * diálogo abierto se sigue desplazando lo que aún tenga recorrido en ese sentido.
 */
function bloquearFondo(documento: Document) {
  let inicioX = 0;
  let inicioY = 0;
  const puedeDesplazar = (objetivo: EventTarget | null, haciaAbajo: boolean) => {
    if (!(objetivo instanceof Element)) return false;
    const dialogo = objetivo.closest("dialog[open]");
    if (!dialogo) return false;
    for (let el: Element | null = objetivo; el; el = el.parentElement) {
      const { overflowY } = getComputedStyle(el);
      if ((overflowY === "auto" || overflowY === "scroll") && el.scrollHeight > el.clientHeight) {
        const queda = haciaAbajo
          ? el.scrollTop + el.clientHeight < el.scrollHeight - 1
          : el.scrollTop > 0;
        if (queda) return true;
      }
      if (el === dialogo) break;
    }
    return false;
  };
  const rueda = (evento: WheelEvent) => {
    if (evento.ctrlKey || evento.deltaY === 0) return;
    if (!puedeDesplazar(evento.target, evento.deltaY > 0)) evento.preventDefault();
  };
  const tocar = (evento: TouchEvent) => {
    inicioX = evento.touches[0]?.clientX ?? 0;
    inicioY = evento.touches[0]?.clientY ?? 0;
  };
  const arrastrar = (evento: TouchEvent) => {
    if (evento.touches.length !== 1) return;
    const { clientX: x, clientY: y } = evento.touches[0]!;
    const dx = x - inicioX;
    const dy = y - inicioY;
    inicioX = x;
    inicioY = y;
    // Lo horizontal (deslizadores, carruseles) no mueve la página: se deja pasar.
    if (Math.abs(dx) >= Math.abs(dy)) return;
    if (!puedeDesplazar(evento.target, dy < 0)) evento.preventDefault();
  };
  const opciones = { passive: false } as const;
  documento.addEventListener("wheel", rueda, opciones);
  documento.addEventListener("touchstart", tocar, { passive: true });
  documento.addEventListener("touchmove", arrastrar, opciones);
  return () => {
    documento.removeEventListener("wheel", rueda);
    documento.removeEventListener("touchstart", tocar);
    documento.removeEventListener("touchmove", arrastrar);
  };
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
  id: dialogId,
  mobilePresentation = "fullscreen",
  lightDismiss = false,
}: DialogProps) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // `showModal` enfoca el primer elemento enfocable, que es la guarda: sin esto saltaba al último
  // control y la lista aparecía desplazada hasta abajo.
  const abriendo = useRef(false);
  const focusRef = useRef(initialFocusRef);
  useLayoutEffect(() => {
    focusRef.current = initialFocusRef;
  }, [initialFocusRef]);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const previous = dialog.ownerDocument.activeElement;
    // El fondo no se desplaza con el diálogo abierto: en iOS `overscroll-behavior` no basta.
    // Sin `overflow: hidden` en el body: con `html { overflow-x: clip }` no llegaba a la ventana
    // y no bloqueaba nada (ver `bloquearFondo`).
    const soltarFondo = bloquearFondo(dialog.ownerDocument);
    abriendo.current = true;
    dialog.showModal();
    abriendo.current = false;
    (focusRef.current?.current ?? headingRef.current)?.focus({ preventScroll: true });
    return () => {
      dialog.close();
      soltarFondo();
      if (previous instanceof HTMLElement && previous.isConnected) {
        previous.focus({ preventScroll: true });
      }
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
      {...(lightDismiss ? { closedby: "any" } : {})}
      id={dialogId}
      ref={dialogRef}
      className={`${styles.dialog} ${mobilePresentation === "sheet" ? styles.sheet : ""}`}
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
        onFocus={() => !abriendo.current && focusEdge("last")}
      />
      <div className={styles.header}>
        <h2 ref={headingRef} tabIndex={-1} id={id + "-title"} className={styles.title}>
          {title}
        </h2>
        <button
          type="button"
          className={styles.cerrar}
          disabled={pending}
          onClick={onClose}
          aria-label={closeLabel}
        >
          <svg
            aria-hidden="true"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          >
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
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
