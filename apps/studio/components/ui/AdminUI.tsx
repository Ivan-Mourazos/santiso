import type { ReactNode } from "react";

interface ShellProps {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
}

export function PageShell({
  eyebrow,
  title,
  description,
  children,
  actions,
}: ShellProps) {
  return (
    <section className="page-shell">
      <div className="page-shell__header">
        <div>
          {eyebrow ? <p className="page-shell__eyebrow">{eyebrow}</p> : null}
          <h2 className="page-shell__title">{title}</h2>
          {description ? (
            <p className="page-shell__description">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="page-shell__actions">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function PanelCard({ children }: { children: ReactNode }) {
  return <div className="panel-card glass">{children}</div>;
}

export function LoadingState({
  title = "Cargando...",
  detail,
}: {
  title?: string;
  detail?: string;
}) {
  return (
    <div className="state-card state-card--loading">
      <span className="state-card__spinner" aria-hidden="true" />
      <strong>{title}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}

export function EmptyState({
  title,
  detail,
}: {
  title: string;
  detail?: string;
}) {
  return (
    <div className="state-card">
      <strong>{title}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}

export function ActionBar({ children }: { children: ReactNode }) {
  return <div className="action-bar">{children}</div>;
}
