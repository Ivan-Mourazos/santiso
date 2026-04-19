/**
 * components/admin/cartel/Common.tsx
 * Shared UI pieces for the poster generator forms.
 */

import React from "react";

export const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p style={{
    fontSize: "0.68rem", fontWeight: 800, textTransform: "uppercase",
    letterSpacing: "1.5px", color: "var(--primary)", margin: "1.4rem 0 0.8rem",
  }}>
    {children}
  </p>
);

export const CategorySelector: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => (
  <div className="input-group" style={{ marginBottom: "1.5rem" }}>
    <label>Categoría</label>
    <select value={value} onChange={e => onChange(e.target.value)}>
      <option value="Senior">Senior</option>
      <option value="Femenino">Femenino</option>
      <option value="Veteranos">Veteranos</option>
    </select>
  </div>
);

export const Toggle: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
  <button onClick={onClick} style={{
    flex: 1, padding: "0.7rem", borderRadius: "0.5rem",
    border: active ? "none" : "1px solid var(--border)",
    background: active ? "var(--primary)" : "rgba(255,255,255,0.03)",
    color: active ? "#000" : "#fff",
    fontFamily: "inherit", fontWeight: 800, fontSize: "0.82rem", cursor: "pointer",
  }}>
    {label}
  </button>
);
