/**
 * scripts/shoot-admin.ts
 * Captura cada pestaña del admin para revisión visual (no entra en la app).
 * Requiere el dev server con bypass:  DEV_AUTH_BYPASS=1 pnpm dev
 * Uso:  pnpm dlx tsx scripts/shoot-admin.ts [baseURL]
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, ".out");
mkdirSync(outDir, { recursive: true });

const base = process.argv[2] || "http://localhost:3000";
const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const viewports = [
  { name: "desktop", width: 1512, height: 950 },
  { name: "mobile", width: 390, height: 844 },
];

async function main() {
const browser = await chromium.launch();
for (const vp of viewports) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2 });
  await page.goto(`${base}/admin`, { waitUntil: "networkidle" });

  // En móvil hay que abrir el drawer para ver/clicar el nav
  const openMenu = async () => {
    if (vp.name === "mobile") {
      const burger = page.locator(".hamburger");
      if (await burger.count()) await burger.first().click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(300);
    }
  };

  await openMenu();
  const labels = await page.locator(".nav-item .nav-item-label").allInnerTexts();
  console.log(`[${vp.name}] pestañas:`, labels.join(", "));

  for (let i = 0; i < labels.length; i++) {
    await openMenu();
    const item = page.locator(".nav-item").nth(i);
    await item.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1400); // dynamic import + render
    const out = join(outDir, `admin-${vp.name}-${i}-${slug(labels[i])}.png`);
    await page.screenshot({ path: out });
    console.log("escrito:", out);
  }
  await page.close();
}
await browser.close();
}

main();
