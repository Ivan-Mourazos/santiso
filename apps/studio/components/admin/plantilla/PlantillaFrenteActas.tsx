"use client";
import { useEffect, useState } from "react";
import { useStudio } from "@/components/studio/StudioContext";
import { Button } from "@/components/ui/foundation/Button";
import {
  anadirJugadorDesdeActa,
  cargarPlantillaFrenteActas,
} from "@/lib/server/acciones/plantilla-actas";
import type { PlantillaFrenteActas as Comparacion } from "@/lib/server/consultas/plantilla-actas";
import styles from "./Plantilla.module.css";

/** «SÁNCHEZ VÁZQUEZ, IVÁN» → «Iván Sánchez Vázquez», solo para enseñarlo. */
function nombreLegible(federacion: string) {
  const [apellidos, nombre] = federacion.split(",").map((p) => p.trim());
  const texto = nombre ? `${nombre} ${apellidos}` : federacion;
  return texto.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, sep, l) => sep + l.toUpperCase());
}

/**
 * La plantilla frente a las actas de la federación de esta temporada: quién juega con el
 * Santiso y no está apuntado (con «Añadir a la plantilla») y quién está apuntado y aún no
 * salió en ningún acta. Sin nada que avisar, no se ve.
 */
export default function PlantillaFrenteActas({
  categoria,
  onAnadido,
}: {
  categoria: string;
  onAnadido: () => void;
}) {
  const { acceso, showToast } = useStudio();
  const [datos, setDatos] = useState<{ categoria: string; comparacion: Comparacion } | null>(null);
  const [anadiendo, setAnadiendo] = useState<string | null>(null);
  useEffect(() => {
    let vigente = true;
    void cargarPlantillaFrenteActas(categoria).then((r) => {
      if (vigente && r.ok) setDatos({ categoria, comparacion: r.datos });
    });
    return () => {
      vigente = false;
    };
  }, [categoria]);
  if (!datos || datos.categoria !== categoria) return null;
  const { enActasSinPlantilla, enPlantillaSinActas } = datos.comparacion;
  if (enActasSinPlantilla.length === 0 && enPlantillaSinActas.length === 0) return null;
  const admin = acceso?.rol !== "tecnico";

  async function anadir(codigo: string) {
    setAnadiendo(codigo);
    const r = await anadirJugadorDesdeActa(categoria, codigo);
    setAnadiendo(null);
    if (!r.ok) return showToast(r.error, "error");
    showToast(
      `${r.datos.nombre} añadido a la plantilla${r.datos.dorsal !== null ? ` con el ${r.datos.dorsal}` : ""}.`,
    );
    setDatos((d) =>
      d
        ? {
            ...d,
            comparacion: {
              ...d.comparacion,
              enActasSinPlantilla: d.comparacion.enActasSinPlantilla.filter(
                (j) => j.codigo !== codigo,
              ),
            },
          }
        : d,
    );
    onAnadido();
  }

  return (
    <section className={styles.frenteActas} aria-label="Plantilla y actas de la federación">
      {enActasSinPlantilla.length > 0 && (
        <div className={styles.frenteAviso}>
          <h4>Juegan y no están en la plantilla</h4>
          <ul>
            {enActasSinPlantilla.map((j) => (
              <li key={j.codigo}>
                <span>
                  <strong>{nombreLegible(j.nombre)}</strong>
                  <small>
                    {j.dorsales.length > 0 ? `Dorsal ${j.dorsales[0]} · ` : ""}
                    {j.partidos} {j.partidos === 1 ? "partido" : "partidos"} en actas
                    {j.titular ? ` · ${j.titular} de titular` : ""}
                  </small>
                </span>
                {admin && (
                  <Button
                    size="sm"
                    pending={anadiendo === j.codigo}
                    pendingLabel="Añadiendo…"
                    disabled={anadiendo !== null}
                    aria-label={`Añadir a la plantilla: ${nombreLegible(j.nombre)}`}
                    onClick={() => void anadir(j.codigo)}
                  >
                    Añadir
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {enPlantillaSinActas.length > 0 && (
        <details className={styles.frenteSinActas}>
          <summary>
            {enPlantillaSinActas.length} de la plantilla aún sin salir en ningún acta
          </summary>
          <p>
            {enPlantillaSinActas
              .map((j) => `${j.dorsal !== null ? `${j.dorsal} ` : ""}${j.nombre}`)
              .join(" · ")}
          </p>
        </details>
      )}
    </section>
  );
}
