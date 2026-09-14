import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "turso",
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dbCredentials: { url: "file:../../data/santiso.db" },
  strict: true,
});
