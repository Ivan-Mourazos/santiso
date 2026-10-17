"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  cargarEstadoRfgf,
  comprobarRfgfAhora,
  reintentarActaRfgf,
  type CompeticionRfgf,
} from "@/lib/server/acciones/rfgf";
import { ProblemasFederacion } from "./ProblemasFederacion";
import styles from "./Jornada.module.css";

interface Props {
  showToast: (msg: string, type?: "success" | "error") => void;
  /** Se llama cuando se han traído datos nuevos, para refrescar la semana. */
  onNovedades: () => void;
}

const HORA = new Intl.DateTimeFormat("es-ES", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function cuando(iso: string | null) {
  if (!iso) return "todavía no se ha mirado";
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? "—" : `mirado ${HORA.format(fecha)}`;
}

/**
 * La federación en Jornada: resultados y actas llegan solos. Aquí solo se avisa de lo que no se
 * pudo guardar solo; lo demás (qué hay traído, traer algo concreto, enlaces) está en Federación.
 */
export default function PanelRfgf({ showToast, onNovedades }: Props) {
  const [estado, setEstado] = useState<CompeticionRfgf[] | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    const resultado = await cargarEstadoRfgf();
    if (!resultado.ok) return;
    setEstado(resultado.datos);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void cargar(), 0);
    return () => window.clearTimeout(id);
  }, [cargar]);

  if (!estado || estado.length === 0) return null;
  const porRevisar = estado.flatMap((c) => c.revisar);
  const enlazadas = estado.filter((c) => c.enlace);

  async function reintentar(codActa: string) {
    setOcupado(true);
    try {
      const preparado = await reintentarActaRfgf(codActa);
      if (!preparado.ok) return showToast(preparado.error, "error");
      const resultado = await comprobarRfgfAhora();
      if (!resultado.ok) return showToast(resultado.error, "error");
      showToast(resultado.datos);
      await cargar();
      onNovedades();
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className={styles.rfgf} aria-label="Federación">
      <ProblemasFederacion
        actas={porRevisar}
        ocupado={ocupado}
        onReintentar={(codActa) => void reintentar(codActa)}
      />
      <p className={styles.rfgfNota}>
        {enlazadas.length === 0
          ? "Sin enlazar con la federación. "
          : `Federación: ${enlazadas.map((c) => `${c.categoria}, ${c.resumen || cuando(c.comprobadoEn)}`).join(" · ")}. `}
        <Link href="/admin/federacion">Ver qué hay traído y traer lo que falte</Link>
      </p>
    </section>
  );
}
