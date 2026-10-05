import type { MetadataRoute } from "next";

/**
 * Para «Añadir a pantalla de inicio» en el móvil: nombre, icono y que se abra a pantalla
 * completa, sin la barra del navegador. La herramienta sigue siendo privada (Tailscale).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "UD Santiso Studio",
    short_name: "Santiso",
    description: "Herramienta interna de la UD Santiso: carteles, actas, alineaciones y multas.",
    start_url: "/admin/jornada",
    display: "standalone",
    background_color: "#0b0b0c",
    theme_color: "#0b0b0c",
    icons: [
      { src: "/logos/app-192.png", sizes: "192x192", type: "image/png" },
      { src: "/logos/app-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
