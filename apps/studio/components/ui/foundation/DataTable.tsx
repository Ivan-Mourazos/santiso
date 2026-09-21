import type { ReactNode, Key } from "react";
import styles from "./DataTable.module.css";
export type Column<T> = {
  id: string;
  heading: string;
  render: (row: T) => ReactNode;
  numeric?: boolean;
  rowHeader?: boolean;
};
export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  emptyMessage = "No hay registros.",
}: {
  caption: string;
  columns: readonly Column<T>[];
  rows: readonly T[];
  rowKey: (row: T) => Key;
  emptyMessage?: string;
}) {
  return (
    <div className={styles.scroll} role="region" aria-label={caption} tabIndex={0}>
      <table className={styles.table}>
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.id}
                scope="col"
                className={column.numeric ? styles.numeric : undefined}
              >
                {column.heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={Math.max(1, columns.length)}>{emptyMessage}</td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((column) =>
                  column.rowHeader ? (
                    <th key={column.id} scope="row">
                      {column.render(row)}
                    </th>
                  ) : (
                    <td key={column.id} className={column.numeric ? styles.numeric : undefined}>
                      {column.render(row)}
                    </td>
                  ),
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
