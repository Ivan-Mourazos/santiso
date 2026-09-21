import { defineConfig, devices } from "@playwright/test";

const URL_BASE = process.env.STUDIO_E2E_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./e2e",
  // Una sola BD SQLite local compartida: sin paralelismo entre pruebas.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: { baseURL: URL_BASE, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm exec next dev -H 127.0.0.1 -p ${new URL(URL_BASE).port || "3000"}`,
    url: `${URL_BASE}/api/estado`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
