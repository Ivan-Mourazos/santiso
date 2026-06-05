"use client";

interface BusyBannerProps {
  show: boolean;
  text?: string;
  progress?: number;
}

export default function BusyBanner({ show, progress }: BusyBannerProps) {
  if (!show) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "1.5rem",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9000,
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        padding: "0.45rem 0.9rem",
        borderRadius: "999px",
        background: "rgba(10,10,10,0.85)",
        border: "1px solid rgba(250, 204, 21, 0.2)",
        backdropFilter: "blur(8px)",
        pointerEvents: "none",
      }}
    >
      <span
        style={{
          width: "13px",
          height: "13px",
          borderRadius: "50%",
          border: "2px solid rgba(250, 204, 21, 0.25)",
          borderTopColor: "#facc15",
          animation: "busy-spin 0.8s linear infinite",
          flexShrink: 0,
        }}
      />
      {typeof progress === "number" && (
        <span style={{ color: "#facc15", fontSize: "0.75rem", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
          {Math.max(0, Math.min(100, Math.round(progress)))}%
        </span>
      )}
      <style jsx>{`
        @keyframes busy-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
