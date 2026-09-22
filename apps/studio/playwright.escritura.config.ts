import { defineConfig, devices } from "@playwright/test";
import { DIR_ESCRITURA, PUERTO_ESCRITURA } from "./e2e-escritura/datos";

/**
 * Pruebas que ESCRIBEN. Van aparte de `pnpm e2e` porque necesitan su propia base de datos:
 * `sembrar.ts` la crea en una carpeta temporal y el servidor arranca apuntando a ella con
 * `SANTISO_DATA_DIR`, que manda sobre `.env.local`.
 *
 * Next no admite dos `next dev` en la misma carpeta: con `pnpm dev` abierto no arranca.
 */
const URL_BASE = `http://127.0.0.1:${PUERTO_ESCRITURA}`;

export default defineConfig({
  testDir: "./e2e-escritura",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: { baseURL: URL_BASE, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm exec tsx e2e-escritura/sembrar.ts && pnpm exec next dev -H 127.0.0.1 -p ${PUERTO_ESCRITURA}`,
    url: `${URL_BASE}/api/estado`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { SANTISO_DATA_DIR: DIR_ESCRITURA, SANTISO_E2E_DIR: DIR_ESCRITURA },
  },
});
