import type { Page } from "@playwright/test";

/**
 * Herramienta local: ninguna pantalla debería salir a internet. Antes de la 2C las pruebas
 * comprobaban que no se llamara a la nube de la que venían los datos; retirada esa nube, la
 * comprobación ya no decía nada. Ahora se vigila la invariante que importa de verdad: ningún
 * host que no sea el propio servidor.
 *
 * **Excepción pendiente:** `globals.css` carga las tipografías desde Google Fonts en su primera
 * línea, así que el panel sí sale a internet al abrirse. La Fase 3A las pasa a locales; cuando
 * lo haga, basta con vaciar `PERMITIDOS` y la prueba se aprieta sola.
 */
const PERMITIDOS = ["fonts.googleapis.com", "fonts.gstatic.com"];

export function vigilarSalidasAInternet(page: Page): string[] {
  const externas: string[] = [];
  page.on("request", (peticion) => {
    const url = peticion.url();
    if (url.startsWith("data:") || url.startsWith("blob:")) return;
    const host = new URL(url).hostname;
    if (host === "127.0.0.1" || host === "localhost") return;
    if (PERMITIDOS.includes(host)) return;
    externas.push(url);
  });
  return externas;
}
