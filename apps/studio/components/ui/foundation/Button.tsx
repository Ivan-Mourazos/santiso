import type { ComponentPropsWithRef } from "react";
import styles from "./Button.module.css";
export type ButtonProps = ComponentPropsWithRef<"button"> & {
  variant?: "primary" | "secondary" | "danger";
  pending?: boolean;
  pendingLabel?: string;
};
export function Button({
  variant = "primary",
  pending = false,
  pendingLabel = "Guardando…",
  disabled,
  type = "button",
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={`${styles.button} ${styles[variant]} ${className}`}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
