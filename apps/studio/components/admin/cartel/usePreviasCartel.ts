import { useEffect, useState } from "react";
import type { PreviaCartel } from "@/lib/cartel2/previa";
import { cargarPreviasCartel } from "@/lib/server/acciones/previa-cartel";

export function usePreviasCartel(ids: string[]) {
  const clave = [...new Set(ids.filter(Boolean))].slice(0, 4).sort().join("|");
  const [intento, setIntento] = useState(0);
  const [lectura, setLectura] = useState<{
    clave: string;
    datos: Record<string, PreviaCartel>;
    error: string | null;
  }>({ clave: "", datos: {}, error: null });
  useEffect(() => {
    if (!clave) return;
    let vigente = true;
    void cargarPreviasCartel(clave.split("|"))
      .then((r) => {
        if (vigente)
          setLectura({ clave, datos: r.ok ? r.datos : {}, error: r.ok ? null : r.error });
      })
      .catch(() => {
        if (vigente)
          setLectura({
            clave,
            datos: {},
            error: "No se pudo cargar la previa. Vuelve a intentarlo.",
          });
      });
    return () => {
      vigente = false;
    };
  }, [clave, intento]);
  const resultado =
    lectura.clave === clave
      ? { ...lectura, cargando: false }
      : { datos: {}, error: null, cargando: !!clave };
  return {
    ...resultado,
    reintentar: () => {
      setLectura({ clave: "", datos: {}, error: null });
      setIntento((i) => i + 1);
    },
  };
}
