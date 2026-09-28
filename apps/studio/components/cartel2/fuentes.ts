import localFont from "next/font/local";

/**
 * Fuentes de los carteles nuevos, servidas en local (OFL, ver `app/fonts/README.md`). `block`:
 * el cartel no se pinta con la fuente de reserva, ni en la vista previa ni en el PNG.
 */
export const anton = localFont({
  src: "../../app/fonts/Anton-400-latin.woff2",
  variable: "--f-display",
  display: "block",
});

export const barlow = localFont({
  src: [
    { path: "../../app/fonts/BarlowCondensed-600-latin.woff2", weight: "600", style: "normal" },
    { path: "../../app/fonts/BarlowCondensed-800-latin.woff2", weight: "800", style: "normal" },
    {
      path: "../../app/fonts/BarlowCondensed-800-italic-latin.woff2",
      weight: "800",
      style: "italic",
    },
  ],
  variable: "--f-texto",
  display: "block",
});
