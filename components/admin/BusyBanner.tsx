"use client";

interface BusyBannerProps {
  show: boolean;
  text: string;
  progress?: number;
}

export default function BusyBanner({ show, text, progress }: BusyBannerProps) {
  if (!show) return null;

  return (
    <>
      <div
        style={{
          marginBottom: "1rem",
          padding: "0.7rem 0.9rem",
          borderRadius: "10px",
          border: "1px solid rgba(250, 204, 21, 0.25)",
          background: "rgba(250, 204, 21, 0.08)",
          color: "#facc15",
          fontSize: "0.8rem",
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          gap: "0.6rem",
        }}
      >
        <span
          style={{
            width: "14px",
            height: "14px",
            borderRadius: "50%",
            border: "2px solid rgba(250, 204, 21, 0.35)",
            borderTopColor: "#facc15",
            animation: "busy-spin 0.8s linear infinite",
            flexShrink: 0,
          }}
        />
        <span>{text}</span>
        {typeof progress === "number" && (
          <span style={{ marginLeft: "auto", fontVariantNumeric: "tabular-nums" }}>
            {Math.max(0, Math.min(100, Math.round(progress)))}%
          </span>
        )}
      </div>
      <style jsx>{`
        @keyframes busy-spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </>
  );
}
