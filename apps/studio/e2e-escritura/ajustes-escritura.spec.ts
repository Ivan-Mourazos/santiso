import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

/**
 * Ajustes gráficos escribiendo de verdad sobre la base de juguete de `sembrar.ts`. Las pruebas
 * van en orden y comparten estado: es un recorrido.
 */
test.describe.configure({ mode: "serial" });

// PNG real generado con sharp, como en los tests de servidor: uno escrito a mano en base64 es
// fácil que llegue corrupto, y entonces se prueba el aviso de error en vez de la subida.
let PNG: Buffer;
test.beforeAll(async () => {
  PNG = await sharp({
    create: { width: 40, height: 40, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } },
  })
    .png()
    .toBuffer();
});
const logo = (page: Page) => page.getByRole("region", { name: "Xunta de Galicia" });

async function abrir(page: Page) {
  await page.goto("/admin/ajustes-graficos");
  await expect(logo(page)).toBeVisible({ timeout: 30000 });
}

test("elegir una imagen no guarda nada hasta confirmar, y cancelar la descarta", async ({
  page,
}) => {
  await abrir(page);
  await expect(logo(page).getByText("Sin imagen")).toBeVisible();

  await logo(page)
    .getByLabel("Subir Xunta de Galicia")
    .setInputFiles({ name: "xunta.png", mimeType: "image/png", buffer: PNG });
  await expect(logo(page).getByText("Vista previa: todavía no se ha guardado.")).toBeVisible();
  await logo(page).getByRole("button", { name: "Cancelar" }).click();
  await expect(logo(page).getByText("Sin imagen")).toBeVisible();

  // Tras recargar sigue sin logo: cancelar no escribió nada.
  await abrir(page);
  await expect(logo(page).getByText("Sin imagen")).toBeVisible();
});

test("guardar deja la imagen puesta y sobrevive a recargar", async ({ page }) => {
  await abrir(page);
  await logo(page)
    .getByLabel("Subir Xunta de Galicia")
    .setInputFiles({ name: "xunta.png", mimeType: "image/png", buffer: PNG });
  await logo(page).getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Logo de la Xunta guardado")).toBeVisible();
  await expect(logo(page).getByRole("img", { name: "Xunta de Galicia" })).toHaveAttribute(
    "src",
    /^\/media\/cartel\/.+\.webp$/,
  );

  await abrir(page);
  await expect(logo(page).getByRole("img", { name: "Xunta de Galicia" })).toBeVisible();
  await expect(logo(page).getByLabel("Cambiar Xunta de Galicia")).toBeAttached();
});

test("el orden de la cabecera se guarda", async ({ page }) => {
  await abrir(page);
  const orden = page.getByRole("group", { name: "Qué logo va a la izquierda" });
  const rfgf = orden.getByRole("button", { name: "RFGF a la izquierda" });
  await expect(rfgf).toHaveAttribute("aria-pressed", "false");
  await rfgf.click();
  await expect(rfgf).toHaveAttribute("aria-pressed", "true");

  await abrir(page);
  await expect(
    page
      .getByRole("group", { name: "Qué logo va a la izquierda" })
      .getByRole("button", { name: "RFGF a la izquierda" }),
  ).toHaveAttribute("aria-pressed", "true");
});
