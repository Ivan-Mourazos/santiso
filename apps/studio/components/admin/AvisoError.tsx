"use client";

/**
 * Franja de error para una lectura que falló. Existe porque hasta la 2C estas pantallas
 * tapaban el fallo rellenándose con un catálogo escrito a mano: parecían llenas, pero los
 * identificadores no existían en la base de datos. Es preferible no enseñar nada y decirlo.
 */
export default function AvisoError({ mensaje }: { mensaje: string | null }) {
  if (!mensaje) return null;
  return (
    <p
      role="alert"
      style={{
        margin: "0 0 0.5rem",
        padding: "0.5rem 0.75rem",
        borderRadius: "var(--radius-sm)",
        background: "rgba(239,68,68,0.08)",
        border: "1px solid rgba(239,68,68,0.22)",
        color: "#f87171",
        fontSize: "0.8rem",
      }}
    >
      {mensaje}
    </p>
  );
}
