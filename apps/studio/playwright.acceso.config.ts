import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * Pruebas del acceso con usuario y contraseña. Van aparte porque necesitan un servidor con
 * `STUDIO_ACCESO=1`: en el resto de pruebas (y en desarrollo) el acceso está apagado.
 * Usan la misma base de datos de juguete que las de escritura, en su propia carpeta temporal.
 *
 * Next no admite dos `next dev` en la misma carpeta: con `pnpm dev` abierto no arranca.
 */
const DIR =
  process.env.SANTISO_E2E_DIR ?? mkdtempSync(path.join(os.tmpdir(), "santiso-e2e-acceso-"));
const PUERTO = 3112;
const URL_BASE = `http://127.0.0.1:${PUERTO}`;

export default defineConfig({
  testDir: "./e2e-acceso",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: { baseURL: URL_BASE, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm exec tsx e2e-escritura/sembrar.ts && pnpm exec next dev -H 127.0.0.1 -p ${PUERTO}`,
    // La pantalla de entrada es lo único que responde sin sesión.
    url: `${URL_BASE}/entrar`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      SANTISO_DATA_DIR: DIR,
      SANTISO_E2E_DIR: DIR,
      PORT: String(PUERTO),
      STUDIO_ACCESO: "1",
      STUDIO_RFGF_AUTO: "",
      STUDIO_COPIA_DIARIA: "",
    },
  },
});
