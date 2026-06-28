import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Panel UD Santiso",
  description: "Herramienta interna de gestión: carteles, actas y base de datos.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <meta name="theme-color" content="#facc15" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="UD Santiso" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body>{children}</body>
    </html>
  );
}
