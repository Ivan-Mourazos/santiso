"use client";

import { useId, type ReactNode, type KeyboardEvent } from "react";
import styles from "./Tabs.module.css";

export interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  label: string;
  items: readonly { value: string; label: string; content: ReactNode; disabled?: boolean }[];
}

export function Tabs({ value, onValueChange, label, items }: TabsProps) {
  const id = useId();
  const enabled = items.filter((item) => !item.disabled);
  const focusValue = enabled.some((item) => item.value === value) ? value : enabled[0]?.value;

  function navigate(event: KeyboardEvent<HTMLButtonElement>, current: string) {
    const index = enabled.findIndex((item) => item.value === current);
    let next: number;
    switch (event.key) {
      case "ArrowLeft":
        next = (index - 1 + enabled.length) % enabled.length;
        break;
      case "ArrowRight":
        next = (index + 1) % enabled.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = enabled.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const target = enabled[next];
    if (!target) return;
    const targetIndex = items.findIndex((item) => item.value === target.value);
    event.currentTarget.ownerDocument.getElementById(id + "-tab-" + targetIndex)?.focus();
    onValueChange(target.value);
  }

  return (
    <div className={styles.root}>
      <div role="tablist" aria-label={label} className={styles.list}>
        {items.map((item, index) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            id={id + "-tab-" + index}
            aria-controls={id + "-panel-" + index}
            aria-selected={item.value === value}
            tabIndex={item.value === focusValue ? 0 : -1}
            disabled={item.disabled}
            className={styles.tab}
            onClick={() => onValueChange(item.value)}
            onKeyDown={(event) => navigate(event, item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {items.map((item, index) => (
        <div
          key={item.value}
          role="tabpanel"
          id={id + "-panel-" + index}
          aria-labelledby={id + "-tab-" + index}
          hidden={item.value !== value}
          tabIndex={0}
          className={styles.panel}
        >
          {item.content}
        </div>
      ))}
    </div>
  );
}
