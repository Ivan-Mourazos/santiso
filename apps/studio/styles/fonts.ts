import localFont from "next/font/local";
/* Títulos y números: la misma Barlow Condensed de los carteles. */
export const barlowUi = localFont({
  src: [
    { path: "../app/fonts/BarlowCondensed-600-latin.woff2", weight: "600", style: "normal" },
    { path: "../app/fonts/BarlowCondensed-800-latin.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-barlow",
  display: "swap",
});
export const nunito = localFont({
  src: "../app/fonts/Nunito-latin.woff2",
  variable: "--font-nunito",
  weight: "200 1000",
  display: "swap",
});
