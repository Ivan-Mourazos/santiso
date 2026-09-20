import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NOTA: React Compiler queda DESACTIVADO de momento — rompe styled-jsx
  // (hydration mismatch: el cliente pierde las clases scoped). Se reactivará
  // tras migrar el admin a CSS global (sin styled-jsx) en el sistema de diseño.
  // Los paquetes internos exportan TypeScript sin compilar (`exports` → `src/*.ts`).
  transpilePackages: ["@santiso/db", "@santiso/domain"],
  experimental: {
    // El navegador ya no comprime: manda la imagen original (hasta 15 MB, ver
    // `leerImagenDeFormulario`). El límite cuenta la sobrecarga de multipart, de ahí el margen.
    // El motivo del 1 MB por defecto (recursos y DoS) no aplica: escuchamos solo en 127.0.0.1.
    serverActions: { bodySizeLimit: "16mb" },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },
};

export default nextConfig;
