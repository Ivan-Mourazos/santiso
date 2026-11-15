import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NOTA: React Compiler queda DESACTIVADO de momento — rompe styled-jsx
  // (hydration mismatch: el cliente pierde las clases scoped). Se reactivará
  // tras migrar el admin a CSS global (sin styled-jsx) en el sistema de diseño.
  // Los paquetes internos exportan TypeScript sin compilar (`exports` → `src/*.ts`).
  // El indicador de Next tapaba el menú lateral; los errores se siguen mostrando.
  devIndicators: false,
  transpilePackages: ["@santiso/db", "@santiso/domain"],
  experimental: {
    // El navegador ya no comprime: manda la imagen original (hasta 15 MB, ver
    // `leerImagenDeFormulario`). El límite cuenta la sobrecarga de multipart, de ahí el margen.
    // El motivo del 1 MB por defecto (recursos y DoS) no aplica: escuchamos solo en 127.0.0.1.
    serverActions: { bodySizeLimit: "16mb" },
    // Con `proxy.ts` Next guarda en memoria el cuerpo de cada petición y por defecto lo corta
    // a los 10 MB: una imagen original o un acta en varias capturas pasan de ahí.
    proxyClientMaxBodySize: "64mb",
  },
  // Pantallas retiradas el 15/11/2026: un icono instalado o un enlace guardado no da «no
  // encontrado». La vieja «Jornada» va a la portada; las de meter actas y jornadas a mano, a
  // Federación, donde ahora se vuelve a traer todo. Temporales: el navegador no las memoriza.
  async redirects() {
    return [
      { source: "/admin/jornada", destination: "/admin/inicio", permanent: false },
      ...["importar", "actas", "importar-jornada"].map((vieja) => ({
        source: `/admin/${vieja}`,
        destination: "/admin/federacion",
        permanent: false,
      })),
    ];
  },
};

export default nextConfig;
