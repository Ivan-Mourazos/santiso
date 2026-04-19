/**
 * lib/cartel/constants.ts
 * Layout and brand constants for the UD Santiso poster generator.
 */

// ─── Canvas dimensions ────────────────────────────────────────────────────────
export const W = 1080;
export const H = 1350;

// ─── Layout constants ─────────────────────────────────────────────────────────
export const BAR_W = 60;
export const PAD   = 48;
export const CL    = BAR_W + PAD;       // 108
export const CR    = W - BAR_W - PAD;   // 972
export const CW    = CR - CL;           // 864
export const CX    = W / 2;             // 540

// ─── Brand colors ─────────────────────────────────────────────────────────────
export const GOLD      = "#facc15";
export const BAR_CLR   = "#c9a420";
export const GREEN_D   = "#1b4a18";
export const GREEN_L   = "#2e7a28";
export const GREEN_TXT = "#3a8a34";

// ─── Category tint colors ─────────────────────────────────────────────────────
export const CAT_TINT: Record<string, string> = {
  Senior:    "rgba(27,74,24,0.14)",
  Femenino:  "rgba(80,20,80,0.14)",
  Veteranos: "rgba(20,40,100,0.14)",
};
