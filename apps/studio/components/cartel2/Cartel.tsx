import type { PeticionCartel } from "@/lib/cartel2/modelo";
import { CartelAlineacion } from "./CartelAlineacion";
import { CartelAnuncio } from "./CartelAnuncio";
import { CartelClasificacion } from "./CartelClasificacion";
import { CartelCronoloxia } from "./CartelCronoloxia";
import { CartelOnce } from "./CartelOnce";
import { CartelPartido } from "./CartelPartido";
import { CartelProximos } from "./CartelProximos";
import { CartelResultado } from "./CartelResultado";

/** El cartel de cualquier plantilla del motor nuevo. Lo usan la vista previa y la exportación. */
export function Cartel({ peticion }: { peticion: PeticionCartel }) {
  switch (peticion.plantilla) {
    case "partido":
      return <CartelPartido datos={peticion.datos} composicion={peticion.composicion} />;
    case "resultado":
      return <CartelResultado datos={peticion.datos} />;
    case "cronoloxia":
      return <CartelCronoloxia datos={peticion.datos} />;
    case "proximos":
      return <CartelProximos datos={peticion.datos} />;
    case "once":
      return <CartelOnce datos={peticion.datos} />;
    case "anuncio":
      return <CartelAnuncio datos={peticion.datos} />;
    case "clasificacion":
      return <CartelClasificacion datos={peticion.datos} />;
    case "alineacion":
      return <CartelAlineacion datos={peticion.datos} />;
  }
}
