"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/foundation/Button";
import { Field } from "@/components/ui/foundation/Fields";
import {
  cargarEstadoRfgf,
  comprobarRfgfAhora,
  guardarEnlaceRfgf,
  reintentarActaRfgf,
  type CompeticionRfgf,
} from "@/lib/server/acciones/rfgf";
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
 * Sincronización con la web de la federación: resultados y actas llegan solos. Aquí se ve
 * cómo va, se enlaza cada competición una vez y se avisa de lo que no se pudo guardar solo.
 */
export default function PanelRfgf({ showToast, onNovedades }: Props) {
  const [estado, setEstado] = useState<CompeticionRfgf[] | null>(null);
  const [enlaces, setEnlaces] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    const resultado = await cargarEstadoRfgf();
    if (!resultado.ok) return;
    setEstado(resultado.datos);
    setEnlaces(Object.fromEntries(resultado.datos.map((c) => [c.competicionId, c.enlace])));
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void cargar(), 0);
    return () => window.clearTimeout(id);
  }, [cargar]);

  if (!estado || estado.length === 0) return null;
  const porRevisar = estado.flatMap((c) => c.revisar);
  const enlazadas = estado.filter((c) => c.enlace);

  async function comprobar() {
    setOcupado(true);
    try {
      const resultado = await comprobarRfgfAhora();
      if (!resultado.ok) return showToast(resultado.error, "error");
      showToast(resultado.datos);
      await cargar();
      onNovedades();
    } finally {
      setOcupado(false);
    }
  }

  async function guardarEnlace(competicionId: string) {
    setOcupado(true);
    try {
      const resultado = await guardarEnlaceRfgf(competicionId, enlaces[competicionId] ?? "");
      if (!resultado.ok) return showToast(resultado.error, "error");
      showToast("Enlace guardado");
      await cargar();
    } finally {
      setOcupado(false);
    }
  }

  async function reintentar(codActa: string) {
    setOcupado(true);
    try {
      const preparado = await reintentarActaRfgf(codActa);
      if (!preparado.ok) return showToast(preparado.error, "error");
      await comprobar();
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className={styles.rfgf} aria-label="Federación">
      {porRevisar.length > 0 && (
        <div className={styles.rfgfAviso} role="alert">
          <strong>La federación tiene un acta que no pude guardar sola</strong>
          <ul>
            {porRevisar.map((acta) => (
              <li key={acta.codActa}>
                <span>
                  {acta.partido}: {acta.motivo}.
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={ocupado}
                  onClick={() => void reintentar(acta.codActa)}
                >
                  Reintentar
                </Button>
              </li>
            ))}
          </ul>
          <p>
            Si es un jugador nuevo, dalo de alta en Jugadores y pulsa «Reintentar». También puedes
            meter el acta a mano desde Importar.
          </p>
        </div>
      )}
      <details className={styles.rfgfDetalle}>
        <summary>
          <span>
            Federación ·{" "}
            {enlazadas.length === 0
              ? "sin enlazar"
              : enlazadas.map((c) => `${c.categoria}: ${c.resumen || cuando(c.comprobadoEn)}`).join(" · ")}
          </span>
        </summary>
        <p className={styles.rfgfNota}>
          Los resultados y las actas se traen solos de futgal.es cuando la federación cierra cada
          acta. Pega una vez el enlace del calendario de cada competición.
        </p>
        {estado.map((c) => (
          <div key={c.competicionId} className={styles.rfgfFila}>
            <Field
              label={`Enlace de ${c.nombre} (${c.categoria})`}
              hint={c.enlace ? cuando(c.comprobadoEn) : "Sin enlazar: no se sincroniza."}
              type="url"
              inputMode="url"
              placeholder="https://www.futgal.es/pnfg/NPcd/NFG_VisCalendario_Vis?…"
              value={enlaces[c.competicionId] ?? ""}
              onChange={(e) => setEnlaces({ ...enlaces, [c.competicionId]: e.target.value })}
              disabled={ocupado}
            />
            <Button
              variant="secondary"
              disabled={ocupado || (enlaces[c.competicionId] ?? "") === c.enlace}
              onClick={() => void guardarEnlace(c.competicionId)}
            >
              Guardar
            </Button>
          </div>
        ))}
        <Button disabled={ocupado || enlazadas.length === 0} onClick={() => void comprobar()}>
          {ocupado ? "Mirando…" : "Comprobar ahora"}
        </Button>
      </details>
    </section>
  );
}
