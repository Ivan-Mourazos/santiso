import { expect, test } from "@playwright/test";
test.use({ viewport: { width: 360, height: 780 } });
test("crear entrenamiento, pasar lista y ver multa automática en móvil", async ({
  page,
}, testInfo) => {
  // Inicializa catálogo con las normas habituales de Multas.
  await page.goto("/admin/multas");
  await expect(page.getByRole("button", { name: "Nueva multa" })).toBeVisible({ timeout: 30000 });
  await page.goto("/admin/adestramentos");
  await page.getByRole("button", { name: "Crear entrenamiento" }).click();
  await expect(page.getByText("0 multas nuevas", { exact: false })).toBeVisible();
  await page.getByLabel("Fecha", { exact: true }).fill("2026-11-04");
  const persona = page.getByRole("region", { name: "Uno Aliñación Ficticio", exact: true });
  const presente = persona.getByRole("button", { name: "Presente", exact: true });
  const tarde = persona.getByRole("button", { name: "Tarde", exact: true });
  const falta = persona.getByRole("button", { name: "Falta", exact: true });
  await expect(presente).toHaveAttribute("aria-pressed", "true");
  await expect(tarde).toHaveAttribute("aria-pressed", "false");
  await expect(falta).toHaveAttribute("aria-pressed", "false");
  const fondoPresente = await presente.evaluate((e) => getComputedStyle(e).backgroundColor);
  expect(await tarde.evaluate((e) => getComputedStyle(e).backgroundColor)).not.toBe(fondoPresente);
  await tarde.click();
  await expect(presente).toHaveAttribute("aria-pressed", "false");
  await expect(tarde).toHaveAttribute("aria-pressed", "true");
  await expect(falta).toHaveAttribute("aria-pressed", "false");
  const fondoTarde = await tarde.evaluate((e) => getComputedStyle(e).backgroundColor);
  expect(await presente.evaluate((e) => getComputedStyle(e).backgroundColor)).not.toBe(fondoTarde);
  await persona.getByLabel("Motivo (opcional)").fill("Tráfico de prueba");
  const otra = page
    .getByRole("region")
    .filter({ has: page.getByRole("button", { name: "Tarde", exact: true }) })
    .nth(1);
  await otra.getByRole("button", { name: "Tarde", exact: true }).click();
  await expect(page.getByText("2 multas nuevas", { exact: false })).toBeVisible();
  await otra.getByRole("button", { name: "Presente", exact: true }).click();
  await expect(page.getByText("1 multa nueva · 0,50 €")).toBeVisible();
  await persona.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("estados-360.png") });
  const ultima = page
    .getByRole("region")
    .filter({ has: page.getByRole("button", { name: "Falta", exact: true }) })
    .last();
  await ultima.getByRole("button", { name: "Falta", exact: true }).click();
  await expect(ultima.getByRole("button", { name: "Falta", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(ultima.getByRole("button", { name: "Presente", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await ultima.getByRole("checkbox", { name: "Justificado" }).check();
  const motivoFinal = ultima.getByLabel("Motivo (opcional)");
  await motivoFinal.fill("Ausencia justificada de prueba");
  const guardar = page.getByRole("button", { name: "Guardar asistencia" });
  await guardar.scrollIntoViewIfNeeded();
  await expect(motivoFinal).toBeInViewport();
  await expect(guardar).toBeInViewport();
  for (const control of [motivoFinal, guardar]) {
    expect(
      await control.evaluate((e) => {
        const r = e.getBoundingClientRect();
        return e.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      }),
    ).toBe(true);
  }
  await page.screenshot({ path: testInfo.outputPath("ultima-persona-360.png") });
  // Ultima persona es Uno: restaura su retraso para comprobar la multa en Multas.
  await ultima.getByRole("button", { name: "Tarde", exact: true }).click();
  await motivoFinal.fill("Tráfico de prueba");
  await otra.getByRole("button", { name: "Falta", exact: true }).click();
  await otra.getByRole("checkbox", { name: "Justificado" }).check();
  await guardar.click();
  await expect(page.getByRole("status").filter({ hasText: "Asistencia guardada" })).toContainText(
    "Asistencia guardada",
  );
  await expect(page.getByRole("list", { name: "Entrenamientos" })).toContainText("mié 4/11/2026");
  const resumen = page.getByRole("list", { name: "Resumen de asistencia" });
  await expect(resumen.getByRole("listitem").first()).toContainText("1 entrenamiento ");
  await expect(resumen).toContainText(/1 presente ·/);
  await expect(resumen).toContainText(/1 ausente ·/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.goto("/admin/multas");
  const multa = page
    .getByRole("list", { name: "Multas" })
    .getByRole("listitem")
    .filter({ hasText: "Uno Aliñación Ficticio" });
  await expect(multa).toContainText("Chegar tarde (inxustificado)");
  await expect(multa).toContainText("0,50 €");
  // Limpia la multa pendiente mediante asistencia, para aislar el flujo de Multas.
  await page.goto("/admin/adestramentos");
  await page.getByRole("button", { name: "Pasar lista" }).click();
  await page
    .getByRole("region", { name: "Uno Aliñación Ficticio", exact: true })
    .getByRole("button", { name: "Presente", exact: true })
    .click();
  await page.getByRole("button", { name: "Guardar asistencia" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Asistencia guardada" })).toContainText(
    "Asistencia guardada",
  );
});
