"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fechaPartido } from "@/components/admin/jornada/TarjetaPartido";
import { useStudio } from "@/components/studio/StudioContext";
import { hoyLocal } from "@/lib/jornada/semana";
import {
  type CartelesDelPartido,
  marcador,
  partidoEnMesa,
  progresoPartido,
} from "@/lib/jornada/vestiario";
import { cargarCartelesPartido } from "@/lib/server/acciones/carteles-guardados";
import { cargarPantallaJornada } from "@/lib/server/acciones/jornada";
import type { PantallaJornada, PartidoDeLaSemana } from "@/lib/server/consultas/jornada";
import styles from "./Inicio.module.css";

interface Datos {
  momento: string;
  partidos: { categoria: string; partido: PartidoDeLaSemana }[];
  carteles: Record<string, CartelesDelPartido>;
}

function datosDe(pantalla: PantallaJornada): Omit<Datos, "carteles"> {
  return {
    momento: pantalla.momento,
    partidos: pantalla.categorias.flatMap((c) => {
      const partido = partidoEnMesa(c.proximo, c.ultimo, pantalla.momento);
      return partido ? [{ categoria: c.categoria, partido }] : [];
    }),
  };
}

/**
 * Lo primero de la portada: el partido que toca de cada equipo, con su siguiente paso a un toque.
 * Es solo un resumen; el partido entero, con todos sus pasos, está en Liga → Partidos.
 */
export default function NuestrosPartidos() {
  const { acceso } = useStudio();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [fallo, setFallo] = useState(false);
  useEffect(() => {
    let vigente = true;
    void (async () => {
      const pantalla = await cargarPantallaJornada(hoyLocal());
      if (!vigente) return;
      if (!pantalla.ok) return setFallo(true);
      const base = datosDe(pantalla.datos);
      const carteles = await cargarCartelesPartido(base.partidos.map((p) => p.partido.id));
      if (vigente) setDatos({ ...base, carteles: carteles.ok ? carteles.datos : {} });
    })().catch(() => vigente && setFallo(true));
    return () => {
      vigente = false;
    };
  }, []);

  if (fallo) return null;
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
        const { despues, pasos, principal } = progresoPartido(
          p,
          datos.momento,
          categoria,
          datos.carteles[p.id] ?? {},
          // Los carteles los lleva el delegado: al técnico no se le mandan a ellos.
          acceso?.rol !== "tecnico",
        );
        const cuando = fechaPartido(p.fecha);
        const hechos = pasos.filter((paso) => paso.tono === "hecho").length;
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
            className={styles.tablero}
            aria-label={`${categoria}: ${despues ? "último partido" : "próximo partido"}`}
          >
            <article className={styles.partido} data-partido-inicio>
              <p className={styles.partidoContexto}>
                <span className={styles.categoria}>{categoria}</span>
                <span>
                  Xornada {p.jornadaNumero} ·{" "}
                  {despues ? "Final" : p.santisoLocal ? "Casa" : "Fuera"}
                </span>
              </p>
              <div className={styles.cruce}>
                <ul>
                  {equipos.map((e) => (
                    <li key={e.nombre} data-propio={e.propio || undefined}>
                      {e.escudo ? (
                        // eslint-disable-next-line @next/next/no-img-element -- escudo de la media local
                        <img src={e.escudo} alt="" width={32} height={32} />
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
                <Link href={`/admin/partidos?categoria=${cat}`} transitionTypes={["nav-forward"]}>
                  {cuando.dia}
                  {p.campo ? ` · ${p.campo}` : ""}
                </Link>
              </p>
            </article>
            <Link
              href={principal.href}
              className={styles.siguiente}
              transitionTypes={["nav-forward"]}
              data-accion-principal
            >
              <span className={styles.siguienteCifra}>
                {hechos}/{pasos.length}
              </span>
              <span className={styles.siguienteTexto}>
                <small>Siguiente paso</small>
                {principal.titulo}
              </span>
              <span className={styles.siguienteFlecha} aria-hidden="true">
                →
              </span>
            </Link>
            <div className={styles.cuadros}>
              <Link
                href={`/admin/partidos?categoria=${cat}`}
                className={styles.cuadro}
                transitionTypes={["nav-forward"]}
              >
                <small>Pasos del partido</small>
                <span className={styles.barras} aria-hidden="true">
                  {pasos.map((paso) => (
                    <span key={paso.titulo} data-hecho={paso.tono === "hecho" || undefined} />
                  ))}
                </span>
                <span>
                  {hechos} de {pasos.length} hechos
                </span>
              </Link>
              {p.clasificacion ? (
                <Link
                  href={`/admin/clasificacion?categoria=${cat}`}
                  className={styles.cuadro}
                  transitionTypes={["nav-forward"]}
                >
                  <small>Clasificación</small>
                  <strong>{p.clasificacion.posicion}º</strong>
                  <span>
                    {p.clasificacion.puntos} pts · {p.clasificacion.jugados} PJ
                  </span>
                </Link>
              ) : (
                <Link
                  href={`/admin/liga?categoria=${cat}`}
                  className={styles.cuadro}
                  transitionTypes={["nav-forward"]}
                >
                  <small>Goleadores</small>
                  <strong>Ver</strong>
                  <span>Y tarjetas</span>
                </Link>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
