"use client";

import { useRef } from "react";
import { Dialog } from "./Dialog";
import styles from "./Dialog.module.css";

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  pending?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  pending = false,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      pending={pending}
      initialFocusRef={cancelRef}
      footer={
        <>
          <button
            ref={cancelRef}
            type="button"
            className={styles.button}
            disabled={pending}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={styles.danger}
            disabled={pending}
            onClick={() => {
              if (!pending) onConfirm();
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      {null}
    </Dialog>
  );
}
