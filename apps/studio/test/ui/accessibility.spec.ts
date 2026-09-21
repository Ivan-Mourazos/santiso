import { createRequire } from "node:module";
import { test, expect } from "@playwright/test";
// axe ya forma parte de eslint-plugin-jsx-a11y. Sin dependencia nueva ni red.
const require = createRequire(`${process.cwd()}/package.json`);
const plugin = require.resolve("eslint-plugin-jsx-a11y", {
  paths: [require.resolve("eslint-config-next")],
});
const axePath = require.resolve("axe-core/axe.min.js", { paths: [plugin] });
for (const view of ["galería", "diálogo", "confirmación"])
  test(`axe: ${view}`, async ({ page }) => {
    await page.goto("/");
    if (view !== "galería")
      await page
        .getByRole("button", {
          name: view === "diálogo" ? "Abrir diálogo" : "Abrir confirmación",
          exact: true,
        })
        .click();
    await page.addScriptTag({ path: axePath });
    const violations = await page.evaluate(async () => {
      // axe se inyecta mediante addScriptTag; esta interfaz describe su salida mínima.
      const api = (
        window as unknown as {
          axe: {
            run: () => Promise<{
              violations: { id: string; impact: string; description: string }[];
            }>;
          };
        }
      ).axe;
      return (await api.run()).violations;
    });
    expect(violations).toEqual([]);
  });
