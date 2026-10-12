import { defineConfig } from "@playwright/test";
import configuracion from "./playwright.config";

// Contrato específico de carteles: mismo lienzo y controles en los tres dispositivos.
const url = process.env.STUDIO_E2E_URL ?? "http://127.0.0.1:3300";
export default defineConfig({
  ...configuracion,
  use: { ...configuracion.use, baseURL: url },
  projects: configuracion.projects?.map((p) => ({
    ...p,
    use: { ...p.use, hasTouch: true },
    testMatch: [
      "**/*cartel*.spec.ts",
      "**/*axenda*.spec.ts",
      "**/*convocatoria*.spec.ts",
      "**/*alineacion*.spec.ts",
    ],
    // Las pruebas de pantalla conservan su ámbito; el motor se verifica en los tres.
    testIgnore:
      p.name === "chromium"
        ? ["**/movil-carteles.spec.ts", "**/movil-axenda.spec.ts"]
        : ["**/carteles.spec.ts"],
  })),
  webServer: {
    command: `pnpm exec next dev -H 127.0.0.1 -p ${new URL(url).port || "3300"}`,
    url: `${url}/api/estado`,
    reuseExistingServer: false,
    timeout: 120000,
  },
});
