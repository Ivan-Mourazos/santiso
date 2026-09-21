import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  fullyParallel: false,
  workers: 1,
  outputDir: "../../test-results/ui",
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3107", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm exec next dev test/ui/fixture -H 127.0.0.1 -p 3107",
    cwd: process.cwd(),
    url: "http://127.0.0.1:3107",
    reuseExistingServer: false,
    timeout: 120000,
  },
});
