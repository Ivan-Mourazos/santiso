"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useStudio } from "@/components/studio/StudioContext";
import { Button } from "@/components/ui/foundation/Button";
import boton from "@/components/ui/foundation/Button.module.css";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/foundation/States";
import { esDia, hoyLocal, semanaDe, semanaVecina } from "@/lib/jornada/semana";
import { cargarPantallaJornada } from "@/lib/server/acciones/jornada";
import type { PantallaJornada } from "@/lib/server/consultas/jornada";
import TarjetaPartido from "./TarjetaPartido";
import styles from "./Jornada.module.css";

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** «del 21 al 27 de septiembre», o «del 28 de septiembre al 4 de octubre». */
function rotuloSemana(desde: string, hasta: string) {
  const [, m1, d1] = desde.split("-").map(Number) as [number, number, number];
  const [, m2, d2] = hasta.split("-").map(Number) as [number, number, number];
  return m1 === m2
    ? `del ${d1} al ${d2} de ${MESES[m2 - 1]}`
    : `del ${d1} de ${MESES[m1 - 1]} al ${d2} de ${MESES[m2 - 1]}`;
}

/**
 * La semana del club en una pantalla: el partido de cada categoría y lo que toca hacer con él.
 * No guarda nada; enlaza a Carteles, Actas, Importar jornada y Clasificación con el partido ya
 * elegido. La semana vive en la URL (`?semana=AAAA-MM-DD`).
 */
export default function AdminJornada() {
  const { params, setParams } = useStudio();
  const pedida = params.get("semana");
  const dia = esDia(pedida) ? pedida : hoyLocal();
  const [pantalla, setPantalla] = useState<PantallaJornada | null>(null);
  const [error, setError] = useState<string | null>(null);
  const generacion = useRef(0);

  const cargar = useCallback(async (d: string) => {
    const esta = ++generacion.current;
    try {
      const resultado = await cargarPantallaJornada(d);
      if (esta !== generacion.current) return;
      if (!resultado.ok) return setError(resultado.error);
      setPantalla(resultado.datos);
      setError(null);
    } catch (e) {
      console.error(e);
      if (esta === generacion.current) setError("No se pudo cargar la jornada.");
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void cargar(dia), 0);
    const solicitudes = generacion;
    return () => {
      window.clearTimeout(id);
      solicitudes.current++;
    };
  }, [cargar, dia]);

  const semana = semanaDe(dia);
  const esEstaSemana = semana.desde === semanaDe(hoyLocal()).desde;
  const irA = (nuevoDia: string | null) => setParams({ semana: nuevoDia });

  const cabecera = (
    <section className={styles.semana} aria-label="Semana">
      <div>
        <h3>Semana {rotuloSemana(semana.desde, semana.hasta)}</h3>
        <p>{esEstaSemana ? "Esta semana" : "Otra semana"} · lunes a domingo</p>
      </div>
      <div className={styles.botones}>
        <Button variant="secondary" size="sm" onClick={() => irA(semanaVecina(dia, -1))}>
          ← Anterior
        </Button>
        {!esEstaSemana && (
          <Button variant="secondary" size="sm" onClick={() => irA(null)}>
            Esta semana
          </Button>
        )}
        <Button variant="secondary" size="sm" onClick={() => irA(semanaVecina(dia, 1))}>
          Siguiente →
        </Button>
        <Link
          href="/admin/carteles?plantilla=proximos"
          className={`${boton.button} ${boton.primary} ${boton.sm}`}
        >
          Próximos encuentros
        </Link>
      </div>
    </section>
  );

  if (error) {
    return (
      <div className={styles.pantalla}>
        {cabecera}
        <ErrorState
          title="No se pudo cargar la jornada"
          detail={error}
          action={<Button onClick={() => void cargar(dia)}>Reintentar</Button>}
        />
      </div>
    );
  }

  if (!pantalla || pantalla.semana.desde !== semana.desde) {
    return (
      <div className={styles.pantalla}>
        {cabecera}
        <LoadingState title="Cargando la semana…" />
      </div>
    );
  }

  return (
    <div className={styles.pantalla}>
      {cabecera}
      {pantalla.categorias.length === 0 ? (
        <EmptyState
          title="No hay competiciones en la temporada activa."
          detail="Crea una en Equipos o carga el calendario desde el PDF de la federación."
        />
      ) : (
        <div className={styles.categorias}>
          {pantalla.categorias.map(({ categoria, partidos }) => (
            <section key={categoria} className={styles.categoria} aria-label={categoria}>
              <h3>{categoria}</h3>
              {partidos.length === 0 ? (
                <p className={styles.vacia}>Sin partido esta semana.</p>
              ) : (
                partidos.map((p) => <TarjetaPartido key={p.id} partido={p} categoria={categoria} />)
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
