"use client";
import { useId, type ComponentPropsWithRef, type ReactNode } from "react";
import styles from "./Fields.module.css";
type LabelProps = { label: string; hint?: string; error?: string };
function useField(
  id: string | undefined,
  hint: string | undefined,
  error: string | undefined,
  describedBy: string | undefined,
) {
  const generated = useId();
  const controlId = id ?? generated;
  return {
    id: controlId,
    description:
      [describedBy, hint ? `${controlId}-hint` : null, error ? `${controlId}-error` : null]
        .filter(Boolean)
        .join(" ") || undefined,
  };
}
function Frame({
  id,
  label,
  hint,
  error,
  children,
}: { id: string; children: ReactNode } & LabelProps) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      {children}
      {hint && (
        <p className={styles.hint} id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className={styles.error} id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}
export function Field({
  label,
  hint,
  error,
  id,
  className = "",
  "aria-describedby": describedBy,
  ...props
}: LabelProps & ComponentPropsWithRef<"input">) {
  const control = useField(id, hint, error, describedBy);
  return (
    <Frame id={control.id} label={label} hint={hint} error={error}>
      <input
        {...props}
        id={control.id}
        aria-describedby={control.description}
        aria-invalid={error ? true : props["aria-invalid"]}
        className={`${styles.control} ${className}`}
      />
    </Frame>
  );
}
export function Select({
  label,
  hint,
  error,
  id,
  className = "",
  children,
  "aria-describedby": describedBy,
  ...props
}: LabelProps & ComponentPropsWithRef<"select">) {
  const control = useField(id, hint, error, describedBy);
  return (
    <Frame id={control.id} label={label} hint={hint} error={error}>
      <select
        {...props}
        id={control.id}
        aria-describedby={control.description}
        aria-invalid={error ? true : props["aria-invalid"]}
        className={`${styles.control} ${className}`}
      >
        {children}
      </select>
    </Frame>
  );
}
export function Textarea({
  label,
  hint,
  error,
  id,
  className = "",
  "aria-describedby": describedBy,
  ...props
}: LabelProps & ComponentPropsWithRef<"textarea">) {
  const control = useField(id, hint, error, describedBy);
  return (
    <Frame id={control.id} label={label} hint={hint} error={error}>
      <textarea
        rows={4}
        {...props}
        id={control.id}
        aria-describedby={control.description}
        aria-invalid={error ? true : props["aria-invalid"]}
        className={`${styles.control} ${styles.textarea} ${className}`}
      />
    </Frame>
  );
}
