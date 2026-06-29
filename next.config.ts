import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NOTA: React Compiler queda DESACTIVADO de momento — rompe styled-jsx
  // (hydration mismatch: el cliente pierde las clases scoped). Se reactivará
  // tras migrar el admin a CSS global (sin styled-jsx) en el sistema de diseño.
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
