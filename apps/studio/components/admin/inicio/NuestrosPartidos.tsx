"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fechaPartido } from "@/lib/jornada/fecha";
import { Button } from "@/components/ui/foundation/Button";
import { ErrorState } from "@/components/ui/foundation/States";
import { hoyLocal } from "@/lib/jornada/semana";
import { marcador, partidoEnMesa, trasPartido } from "@/lib/jornada/vestiario";
import { cargarPantallaJornada } from "@/lib/server/acciones/jornada";
import type { PantallaJornada, PartidoDeLaSemana } from "@/lib/server/consultas/jornada";
import styles from "./Inicio.module.css";

interface Datos {
  momento: string;
  partidos: { categoria: string; partido: PartidoDeLaSemana }[];
}

function datosDe(pantalla: PantallaJornada): Datos {
  return {
    momento: pantalla.momento,
    // Por fecha, no por categoría: el que se juega antes, arriba. Sin fecha, al final.
    partidos: pantalla.categorias
      .flatMap((c) => {
        const partido = partidoEnMesa(c.proximo, c.ultimo, pantalla.momento);
        return partido ? [{ categoria: c.categoria, partido }] : [];
      })
      .sort((a, b) => {
        const fa = a.partido.fecha ?? "~";
        const fb = b.partido.fecha ?? "~";
        return fa < fb ? -1 : fa > fb ? 1 : 0;
      }),
  };
}

/**
 * La portada: el partido que toca de cada equipo, nada más. Tocarlo abre su detalle en
 * Liga → Partidos, donde están el acta, los carteles y el directo.
 */
export default function NuestrosPartidos() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [fallo, setFallo] = useState(false);
  // Cada «Reintentar» vuelve a pedir la semana.
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    let vigente = true;
    void (async () => {
      const pantalla = await cargarPantallaJornada(hoyLocal());
      if (!vigente) return;
      if (!pantalla.ok) return setFallo(true);
      setDatos(datosDe(pantalla.datos));
    })().catch(() => vigente && setFallo(true));
    return () => {
      vigente = false;
    };
  }, [intento]);

  if (fallo)
    return (
      <ErrorState
        title="No se pudieron cargar los partidos de la semana"
        detail="Comprueba la conexión y vuelve a intentarlo. El calendario entero está en Liga → Partidos."
        action={
          <Button
            onClick={() => {
              setFallo(false);
              setDatos(null);
              setIntento((n) => n + 1);
            }}
          >
            Reintentar
          </Button>
        }
      />
    );
  if (!datos)
    return (
      <div className={styles.partidos} role="status" aria-label="Cargando los partidos">
        <span className={styles.esqueleto} />
        <span className={styles.esqueleto} />
      </div>
    );
  if (datos.partidos.length === 0)
    return (
      <p className={styles.vacio}>
        Sin partidos esta semana. El calendario entero está en{" "}
        <Link href="/admin/partidos" transitionTypes={["nav-forward"]}>
          Liga → Partidos
        </Link>
        .
      </p>
    );
  return (
    <div className={styles.partidos}>
      {datos.partidos.map(({ categoria, partido: p }) => {
        const despues = trasPartido(p, datos.momento);
        const abrir = `/admin/partidos?categoria=${encodeURIComponent(categoria)}&partido=${encodeURIComponent(p.id)}`;
        const cuando = fechaPartido(p.fecha);
        const cat = encodeURIComponent(categoria);
        // Local arriba, como en el acta; el Santiso siempre en amarillo.
        const equipos = [
          {
            nombre: p.santiso,
            escudo: p.santisoEscudoUrl,
            goles: p.golesSantiso,
            propio: true,
          },
          { nombre: p.rival.nombre, escudo: p.rival.escudoUrl, goles: p.golesRival, propio: false },
        ];
        if (!p.santisoLocal) equipos.reverse();
        const jugado = p.golesSantiso !== null && p.golesRival !== null;
        return (
          <section
            key={p.id}
            className={styles.tarjeta}
            aria-label={`${categoria}: ${despues ? "último partido" : "próximo partido"}`}
          >
            <article className={styles.partido} data-partido-inicio>
              <p className={styles.partidoContexto}>
                <span className={styles.categoria}>{categoria}</span>
                <span className={styles.jornada}>
                  J{p.jornadaNumero} · {despues ? "Final" : p.santisoLocal ? "Casa" : "Fuera"}
                </span>
                {p.clasificacion ? (
                  <Link
                    href={`/admin/clasificacion?categoria=${cat}`}
                    className={styles.puesto}
                    transitionTypes={["nav-forward"]}
                    aria-label={`Clasificación: ${p.clasificacion.posicion}º con ${p.clasificacion.puntos} puntos`}
                  >
                    <strong>{p.clasificacion.posicion}º</strong> · {p.clasificacion.puntos} pts
                  </Link>
                ) : null}
              </p>
              <div className={styles.cruce}>
                <ul>
                  {equipos.map((e) => (
                    <li key={e.nombre} data-propio={e.propio || undefined}>
                      {e.escudo ? (
                        // eslint-disable-next-line @next/next/no-img-element -- escudo de la media local
                        <img src={e.escudo} alt="" width={24} height={24} />
                      ) : (
                        <span className={styles.sinEscudo} aria-hidden="true" />
                      )}
                      <span>{e.nombre}</span>
                    </li>
                  ))}
                </ul>
                {jugado ? (
                  <p className={styles.goles} aria-label={`Resultado ${marcador(p)?.cifras ?? ""}`}>
                    {equipos.map((e) => (
                      <span key={e.nombre} data-propio={e.propio || undefined}>
                        {e.goles}
                      </span>
                    ))}
                  </p>
                ) : (
                  <p className={styles.hora}>{cuando.hora || "—"}</p>
                )}
              </div>
              <p className={styles.partidoCuando}>
                <Link
                  href={abrir}
                  transitionTypes={["nav-forward"]}
                  aria-label={`Abrir el partido de ${categoria} contra ${p.rival.nombre}: ${cuando.dia}${p.campo ? `, ${p.campo}` : ""}`}
                  data-abrir-partido
                >
                  {cuando.dia}
                  {p.campo ? ` · ${p.campo}` : ""}
                </Link>
              </p>
            </article>
          </section>
        );
      })}
    </div>
  );
}
