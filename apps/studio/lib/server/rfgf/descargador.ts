import "server-only";

/** Lo que la sincronización necesita de la web de la federación. En las pruebas se sustituye. */
export interface DescargadorRfgf {
  html(url: string): Promise<string>;
  pdf(url: string): Promise<Uint8Array>;
}

/** Se identifica con su nombre: son consultas puntuales de un club, no un navegador. */
const AGENTE = "UDSantisoStudio/1.0 (uso interno del club; consultas puntuales)";
/** Pausa entre consultas: no hay prisa y así no se carga la web de la federación. */
const PAUSA_MS = 1500;
const ESPERA_MS = 25_000;
const MAXIMO_SALTOS = 6;
const MAXIMO_BYTES = 15 * 1024 * 1024;

const esDeLaFederacion = (url: URL) =>
  url.protocol === "https:" && /(^|\.)futgal\.es$/i.test(url.hostname);

/**
 * Descargas de futgal.es con la sesión que la web exige (una cookie que da en la primera
 * visita) y una pausa entre consulta y consulta. Solo sale hacia la federación.
 */
export function crearDescargador(): DescargadorRfgf {
  const galletas = new Map<string, string>();
  let ultima = 0;

  async function pedir(direccion: string, saltos = 0): Promise<Response> {
    const url = new URL(direccion);
    if (!esDeLaFederacion(url)) throw new Error("Dirección fuera de la federación.");
    const espera = ultima + PAUSA_MS - Date.now();
    if (espera > 0) await new Promise((resolver) => setTimeout(resolver, espera));
    ultima = Date.now();

    const respuesta = await fetch(url, {
      headers: {
        "user-agent": AGENTE,
        cookie: [...galletas].map(([nombre, valor]) => `${nombre}=${valor}`).join("; "),
      },
      redirect: "manual",
      signal: AbortSignal.timeout(ESPERA_MS),
    });
    for (const galleta of respuesta.headers.getSetCookie()) {
      const par = galleta.split(";")[0] ?? "";
      const corte = par.indexOf("=");
      if (corte > 0) galletas.set(par.slice(0, corte).trim(), par.slice(corte + 1).trim());
    }
    if (respuesta.status >= 300 && respuesta.status < 400) {
      const destino = respuesta.headers.get("location");
      if (!destino || saltos >= MAXIMO_SALTOS) throw new Error("Redirección sin salida.");
      return pedir(new URL(destino, url).href, saltos + 1);
    }
    if (!respuesta.ok) throw new Error(`La federación respondió ${respuesta.status}.`);
    return respuesta;
  }

  async function cuerpo(url: string): Promise<Uint8Array> {
    const bytes = new Uint8Array(await (await pedir(url)).arrayBuffer());
    if (bytes.length > MAXIMO_BYTES) throw new Error("Respuesta demasiado grande.");
    return bytes;
  }

  return {
    async html(url) {
      let bytes = await cuerpo(url);
      // La primera visita solo abre la sesión y devuelve una página casi vacía: se repite.
      if (bytes.length < 2000) bytes = await cuerpo(url);
      return new TextDecoder("iso-8859-15").decode(bytes);
    },
    async pdf(url) {
      let bytes = await cuerpo(url);
      const esPdf = (b: Uint8Array) => new TextDecoder().decode(b.subarray(0, 4)) === "%PDF";
      if (!esPdf(bytes)) bytes = await cuerpo(url);
      if (!esPdf(bytes)) throw new Error("La federación no devolvió un PDF.");
      return bytes;
    },
  };
}
