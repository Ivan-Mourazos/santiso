import { defineConfig, devices } from "@playwright/test";

const URL_BASE = "http://127.0.0.1:3000";

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
    command: "pnpm dev",
    url: `${URL_BASE}/api/estado`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
