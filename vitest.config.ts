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
  },
});
