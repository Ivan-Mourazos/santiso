import type { ComponentPropsWithRef } from "react";
import styles from "./Button.module.css";
export type ButtonProps = ComponentPropsWithRef<"button"> & {
  variant?: "primary" | "secondary" | "danger";
  /** `sm`: para acciones dentro de filas de tabla. En pantallas táctiles vuelve a 44 px. */
  size?: "md" | "sm";
  pending?: boolean;
  pendingLabel?: string;
};
export function Button({
  variant = "primary",
  size = "md",
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
      className={`${styles.button} ${styles[variant]} ${size === "sm" ? styles.sm : ""} ${className}`}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
