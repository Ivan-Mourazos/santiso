import localFont from "next/font/local";
/* Títulos y números: Big Shoulders Display, la letra de marcador de estadio. */
export const marcador = localFont({
  src: "../app/fonts/BigShouldersDisplay-latin.woff2",
  variable: "--font-marcador",
  weight: "100 900",
  display: "swap",
});
/* Para leer: Manrope, redonda y clara en el móvil. */
export const manrope = localFont({
  src: "../app/fonts/Manrope-latin.woff2",
  variable: "--font-manrope",
  weight: "200 800",
  display: "swap",
});
