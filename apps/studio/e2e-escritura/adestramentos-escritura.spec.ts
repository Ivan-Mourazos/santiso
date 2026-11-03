import { expect, test } from "@playwright/test";
test.use({
  viewport: { width: 360, height: 780 },
  permissions: ["clipboard-read", "clipboard-write"],
});
test("crear entrenamiento, pasar lista y ver multa automática en móvil", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
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
  await page.getByRole("link", { name: "Volver a entrenos" }).click();
  // Segunda fecha: valida desplazamiento con varias columnas, incluso con la cabecera compacta.
  await page.getByRole("button", { name: "Crear entrenamiento" }).click();
  await page.getByLabel("Fecha", { exact: true }).fill("2026-11-03");
  await page.getByRole("button", { name: "Guardar asistencia" }).click();
  await expect(page.getByRole("region", { name: "Detalle del entrenamiento" })).toBeVisible();
  await page.getByRole("link", { name: "Volver a entrenos" }).click();
  await expect(page.getByRole("list", { name: "Entrenamientos" })).toContainText("mié 4/11/2026");
  const sinDesbordamiento = async () => {
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  };
  await sinDesbordamiento();
  await expect(page.getByRole("status").filter({ hasText: "Asistencia guardada" })).toHaveCount(0, {
    timeout: 6000,
  });
  const listaEntrenos = page.getByRole("list", { name: "Entrenamientos" });
  await listaEntrenos.getByRole("button", { name: "Copiar", exact: true }).first().click();
  await expect(page.getByRole("region", { name: "Detalle del entrenamiento" })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("entrenos-360.png"), fullPage: true });
  // Zona de chevron abre el detalle; Copiar, comprobado arriba, no lo abre.
  const filaEntreno = listaEntrenos.getByRole("listitem").first();
  await filaEntreno.click({ position: { x: (await filaEntreno.boundingBox())!.width - 8, y: 24 } });
  const detalle = page.getByRole("region", { name: "Detalle del entrenamiento" });
  await expect(detalle).toContainText("Pendiente");
  await expect(
    detalle.getByRole("heading", { name: "mié 4/11/2026 · Senior", exact: true }),
  ).toBeVisible();
  await expect(detalle).not.toContainText("2026-11-04");
  await expect(detalle).toContainText("0,50 €");
  await detalle.getByRole("button", { name: "Editar lista" }).click();
  await page.getByLabel("Nota del entrenamiento").fill("Nota editada de prueba");
  await page.getByRole("button", { name: "Guardar asistencia" }).click();
  await expect(detalle).toContainText("Nota editada de prueba");
  await expect(detalle).toContainText("Pendiente");
  await detalle.getByRole("button", { name: "Copiar", exact: true }).click();
  await expect(detalle.getByRole("status")).toHaveText("Copiado.");
  const whatsapp = await page.evaluate(() => navigator.clipboard.readText());
  expect(whatsapp).toContain("Entrenamiento mié 4/11 · Senior");
  expect(whatsapp).toContain("Uno Aliñación Ficticio");
  expect(whatsapp).not.toContain("€");
  await sinDesbordamiento();
  await expect(page.getByRole("status").filter({ hasText: "Asistencia guardada" })).toHaveCount(0, {
    timeout: 6000,
  });
  await page.screenshot({ path: testInfo.outputPath("detalle-360.png"), fullPage: true });
  await page.getByRole("tab", { name: "Asistencia", exact: true }).click();
  await expect(page).toHaveURL(/vista=asistencia/);
  const tabla = page.getByRole("table", { name: "Cuadrante de asistencia" });
  await expect(tabla).toBeVisible();
  await expect(tabla).toContainText("4/11");
  await sinDesbordamiento();
  await page.getByRole("button", { name: "Copiar tabla" }).click();
  const tsv = await page.evaluate(() => navigator.clipboard.readText());
  expect(tsv).toContain("Persona\t4/11\t3/11\tAsistencia");
  expect(tsv).toContain("100%");
  await page.screenshot({ path: testInfo.outputPath("asistencia-360.png"), fullPage: true });
  const nombreFijo = tabla.getByRole("button", { name: "Uno Aliñación Ficticio", exact: true });
  await nombreFijo.click();
  await expect(tabla).toContainText("Tráfico de prueba");
  await nombreFijo.click();
  const xAntes = (await nombreFijo.boundingBox())!.x;
  const desplazable = page.getByRole("region", { name: "Cuadrante desplazable" });
  await desplazable.evaluate((e) => {
    e.scrollLeft = e.scrollWidth;
  });
  expect(await desplazable.evaluate((e) => e.scrollLeft)).toBeGreaterThan(0);
  expect((await nombreFijo.boundingBox())!.x).toBeCloseTo(xAntes, 0);
  await sinDesbordamiento();
  await desplazable.evaluate((e) => {
    e.scrollLeft = 0;
  });
  await page.reload();
  await expect(tabla).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 720 });
  await sinDesbordamiento();
  await page.screenshot({ path: testInfo.outputPath("asistencia-1280.png"), fullPage: true });
  await page.getByRole("tab", { name: "Entrenos", exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath("entrenos-1280.png"), fullPage: true });
  await page.goto("/admin/multas");
  const multa = page
    .getByRole("list", { name: "Multas" })
    .getByRole("listitem")
    .filter({ hasText: "Uno Aliñación Ficticio" });
  await expect(multa).toContainText("Chegar tarde (inxustificado)");
  await expect(multa).toContainText("0,50 €");
  await multa.getByRole("button", { name: /^Cobrar a/ }).click();
  await expect(multa).toHaveCount(0);
  await page.goto("/admin/adestramentos");
  await page
    .getByRole("list", { name: "Entrenamientos" })
    .getByRole("button", { name: /mié,? 4/ })
    .click();
  await expect(detalle).toContainText("Pagada");
  await page.screenshot({ path: testInfo.outputPath("detalle-1280.png"), fullPage: true });
  // La copia manual funciona también cuando el navegador no ofrece portapapeles.
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true }),
  );
  await detalle.getByRole("button", { name: "Copiar", exact: true }).click();
  await expect(detalle.getByLabel("Texto para copiar")).toBeFocused();
  expect(
    await detalle
      .getByLabel("Texto para copiar")
      .evaluate((e: HTMLTextAreaElement) => e.selectionEnd - e.selectionStart),
  ).toBeGreaterThan(0);
  await page.goto("/admin/multas");
  await page.getByRole("button", { name: "Todas", exact: true }).click();
  await multa.getByRole("button", { name: /^Ver la multa/ }).click();
  await page.getByRole("button", { name: /^Quitar la multa/ }).click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(page.getByText("Multa quitada", { exact: true })).toBeVisible();
  await page.goto("/admin/adestramentos");
  await page
    .getByRole("list", { name: "Entrenamientos" })
    .getByRole("button", { name: /mié,? 4/ })
    .click();
  await expect(detalle).toContainText("Quitada en Multas");
  await expect(detalle).not.toContainText("0,50 €");
});
