"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fechaPartido } from "@/components/admin/jornada/TarjetaPartido";
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
 * Es solo un resumen; el partido entero, con todos sus pasos, está en la mesa de la jornada.
 */
export default function NuestrosPartidos() {
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
  if (datos.partidos.length === 0) return null;
  return (
    <section className={styles.partidos} aria-label="Nuestros partidos">
      {datos.partidos.map(({ categoria, partido: p }) => {
        const { despues, pasos, principal } = progresoPartido(
          p,
          datos.momento,
          categoria,
          datos.carteles[p.id] ?? {},
        );
        const cuando = fechaPartido(p.fecha);
        const resultado = marcador(p);
        const hechos = pasos.filter((paso) => paso.tono === "hecho").length;
        return (
          <article key={p.id} className={styles.partido} data-partido-inicio>
            <p className={styles.partidoContexto}>
              <span className={styles.categoria}>{categoria}</span>
              {despues ? "Último partido" : "Próximo"} · J{p.jornadaNumero} ·{" "}
              {p.santisoLocal ? "Casa" : "Fuera"}
            </p>
            <div className={styles.partidoRival}>
              <h3>
                <Link
                  href={`/admin/jornada?categoria=${encodeURIComponent(categoria)}`}
                  transitionTypes={["nav-forward"]}
                >
                  {p.rival.nombre}
                </Link>
              </h3>
              <strong>{resultado?.cifras ?? (cuando.hora || "—")}</strong>
            </div>
            <p className={styles.partidoCuando}>
              {cuando.dia}
              {p.campo ? ` · ${p.campo}` : ""}
            </p>
            <Link
              href={principal.href}
              className={styles.siguiente}
              transitionTypes={["nav-forward"]}
              data-accion-principal
            >
              <span>
                <small>
                  Siguiente paso · {hechos}/{pasos.length}
                </small>
                {principal.titulo}
              </span>
              <span aria-hidden="true">→</span>
            </Link>
          </article>
        );
      })}
    </section>
  );
}
