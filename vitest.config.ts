import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const studio = fileURLToPath(new URL("./apps/studio/", import.meta.url)).replaceAll("\\", "/");

export default defineConfig({
  resolve: {
    alias: [
      { find: /^server-only$/, replacement: `${studio}test/server-only-vacio.ts` },
      { find: /^@\//, replacement: studio },
    ],
  },
  test: {
    include: [
      "packages/*/src/**/*.test.ts",
      "tools/*/src/**/*.test.ts",
      "apps/studio/{lib,app}/**/*.test.ts",
    ],
    environment: "node",
    // Las pruebas de acciones montan una BD migrada y cargan los módulos en frío: el primer caso
    // de cada fichero tarda 1–2 s en reposo y pasa de 5 s con el PC cargado. Al agotar el tiempo,
    // el caso seguía corriendo y pisaba el estado del siguiente (cookie de `sesion.test.ts`).
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
