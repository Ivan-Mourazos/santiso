import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NOTA: React Compiler queda DESACTIVADO de momento — rompe styled-jsx
  // (hydration mismatch: el cliente pierde las clases scoped). Se reactivará
  // tras migrar el admin a CSS global (sin styled-jsx) en el sistema de diseño.
  // Los paquetes internos exportan TypeScript sin compilar (`exports` → `src/*.ts`).
  transpilePackages: ["@santiso/db", "@santiso/domain"],
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
