import { claveNombre } from "@santiso/domain";
import type { AssetUrls } from "@/components/admin/cartel/types";
import type { CartelTeam } from "@/components/admin/cartel/useCartelForm";
import type { RecursosCartel } from "./formulario";

/** La vista previa y el paquete usan los mismos escudos, colores y logos. */
export function recursosDeCartel(equipos: CartelTeam[], recursos: AssetUrls): RecursosCartel {
  return {
    escudosClub: Object.fromEntries(
      equipos.filter((e) => e.es_propio && e.escudo_url).map((e) => [e.categoria, e.escudo_url]),
    ),
    escudosEn3d: equipos.filter((e) => e.escudo_3d && e.escudo_url).map((e) => e.escudo_url),
    coloresEquipo: Object.fromEntries(
      equipos.filter((e) => e.color).map((e) => [claveNombre(e.nombre), e.color as string]),
    ),
    coloresEquipo2: Object.fromEntries(
      equipos
        .filter((e) => e.color && e.color_2)
        .map((e) => [claveNombre(e.nombre), e.color_2 as string]),
    ),
    patrocinadores: recursos.sponsors,
    institucionales: (recursos.xuntaIsLeft
      ? [recursos.xunta, recursos.rfgf]
      : [recursos.rfgf, recursos.xunta]
    ).filter(Boolean),
  };
}
