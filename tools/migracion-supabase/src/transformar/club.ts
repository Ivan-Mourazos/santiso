import { claveNombre, validarAjuste } from "@santiso/domain";
import { CLAVE_ESCUDO_CLUB, claveMediaDesdeUrl } from "../snapshot/media";
import type { Snapshot } from "../snapshot/tipos";
import { marcasDesde, textoOpcional } from "./comunes";
import { type AjusteNuevo, ErrorMigracion, type Informe, type PatrocinadorNuevo } from "./tipos";

const TIPOS_ASSET = new Set(["logo_institucional", "logo_patrocinador", "config"]);
const LOGOS_INSTITUCIONALES = [
  ["xunta", "cartel.logo_xunta"],
  ["rfgf", "cartel.logo_rfgf"],
] as const;

/** R14–R15: patrocinadores unificados y ajustes globales. */
export function transformarClub(
  origen: Snapshot,
  informe: Informe,
): { patrocinadores: PatrocinadorNuevo[]; ajustes: AjusteNuevo[] } {
  const subtiposInstitucionales = new Set<string>(
    LOGOS_INSTITUCIONALES.map(([subtipo]) => subtipo),
  );
  const desconocidos = origen.cartel_assets.filter(
    (asset) =>
      !TIPOS_ASSET.has(asset.tipo) ||
      (asset.tipo === "logo_institucional" && !subtiposInstitucionales.has(asset.subtipo ?? "")),
  );
  if (desconocidos.length > 0) {
    throw new ErrorMigracion(
      `Activos de cartel con tipo desconocido: ${desconocidos.map((a) => `${a.tipo}/${a.subtipo ?? ""}`).join(", ")}.`,
    );
  }

  const patrocinadores = new Map<string, PatrocinadorNuevo>();
  for (const fila of origen.patrocinadores) {
    const nombre = fila.nombre.trim();
    const clave = claveNombre(nombre);
    if (patrocinadores.has(clave)) throw new ErrorMigracion(`Patrocinador duplicado: "${nombre}".`);
    patrocinadores.set(clave, {
      id: fila.id,
      nombre,
      clave,
      logo: claveMediaDesdeUrl(fila.logo_url),
      webUrl: textoOpcional(fila.web_url),
      orden: fila.orden ?? 0,
      enCarteles: false,
      ...marcasDesde(fila.created_at),
    });
  }

  const logosCartel = origen.cartel_assets
    .filter((asset) => asset.tipo === "logo_patrocinador")
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  for (const [orden, asset] of logosCartel.entries()) {
    const nombre = asset.nombre.trim();
    const clave = claveNombre(nombre);
    const existente = patrocinadores.get(clave);
    if (existente) {
      existente.enCarteles = true;
      existente.orden = orden;
      existente.logo ??= claveMediaDesdeUrl(asset.url);
      informe.avisos.push(`Logo de cartel "${nombre}" unido al patrocinador existente.`);
      continue;
    }
    patrocinadores.set(clave, {
      id: asset.id,
      nombre,
      clave,
      logo: claveMediaDesdeUrl(asset.url),
      webUrl: null,
      orden,
      enCarteles: true,
    });
  }

  const ajustes: AjusteNuevo[] = [
    { id: "club.escudo", valor: validarAjuste("club.escudo", CLAVE_ESCUDO_CLUB) },
  ];
  for (const [subtipo, id] of LOGOS_INSTITUCIONALES) {
    const logos = origen.cartel_assets.filter(
      (asset) => asset.tipo === "logo_institucional" && asset.subtipo === subtipo,
    );
    if (logos.length > 1) {
      throw new ErrorMigracion(`Hay ${logos.length} logos institucionales "${subtipo}".`);
    }
    const claveLogo = claveMediaDesdeUrl(logos[0]?.url);
    if (claveLogo) ajustes.push({ id, valor: validarAjuste(id, claveLogo) });
  }
  const configuracion = origen.cartel_assets.find(
    (asset) => asset.tipo === "config" && asset.subtipo === "logo_order",
  );
  const ordenLogos = configuracion?.nombre === "rfgf_left" ? "rfgf_izquierda" : "xunta_izquierda";
  ajustes.push({
    id: "cartel.orden_logos",
    valor: validarAjuste("cartel.orden_logos", ordenLogos),
  });

  return { patrocinadores: [...patrocinadores.values()], ajustes };
}
