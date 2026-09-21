import localFont from "next/font/local";
export const outfit = localFont({
  src: "../app/fonts/Outfit-latin.woff2",
  variable: "--font-outfit",
  weight: "100 900",
  display: "swap",
});
export const nunito = localFont({
  src: "../app/fonts/Nunito-latin.woff2",
  variable: "--font-nunito",
  weight: "200 1000",
  display: "swap",
});
