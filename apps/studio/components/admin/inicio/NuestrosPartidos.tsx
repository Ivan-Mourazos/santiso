"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useStudio } from "@/components/studio/StudioContext";
import { fechaPartido } from "@/lib/jornada/fecha";
import { Button } from "@/components/ui/foundation/Button";
import { EmptyState, ErrorState, StateLink } from "@/components/ui/foundation/States";
import { TITULARES } from "@/lib/alineacion/modelo";
import { hoyLocal, semanaDe } from "@/lib/jornada/semana";
import { reservada } from "@/lib/navigation/contexto";
import { marcador, partidoEnMesa, preparaConvocatoria, trasPartido } from "@/lib/jornada/vestiario";
import { cargarPantallaJornada } from "@/lib/server/acciones/jornada";
import type { PantallaJornada, PartidoDeLaSemana } from "@/lib/server/consultas/jornada";
import styles from "./Inicio.module.css";

interface Datos {
  momento: string;
  semana: PantallaJornada["semana"];
  partidos: { categoria: string; partido: PartidoDeLaSemana }[];
}

function datosDe(pantalla: PantallaJornada): Datos {
  return {
    momento: pantalla.momento,
    semana: pantalla.semana,
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

function tarea(p: PartidoDeLaSemana, categoria: string, despues: boolean) {
  if (despues) return p.cierreHecho ? "Carrusel listo" : null;
  if (!preparaConvocatoria(categoria)) return null;
  const { titulares, convocatoria } = p.preparacion;
  if (titulares > 0) return `Once inicial · ${titulares}/${TITULARES}`;
  return convocatoria ? `${convocatoria} convocados` : null;
}

function accionDelDia(
  p: PartidoDeLaSemana,
  categoria: string,
  despues: boolean,
  puedeHacerCarteles: boolean,
) {
  const contexto = `categoria=${encodeURIComponent(categoria)}&partido=${encodeURIComponent(p.id)}`;
  if (p.estado === "en_juego")
    return { href: `/admin/directo?${contexto}`, texto: "Abrir directo" };
  if (despues && marcador(p) && !p.cierreHecho && puedeHacerCarteles)
    return { href: `/admin/carteles?plantilla=despues&${contexto}`, texto: "Preparar resultado" };
  if (despues || p.estado === "aplazado" || p.estado === "cancelado" || !preparaConvocatoria(categoria))
    return null;
  if (!p.preparacion.convocatoria)
    return { href: `/admin/convocatoria?${contexto}`, texto: "Preparar convocatoria" };
  if (p.preparacion.titulares < TITULARES)
    return { href: `/admin/alineacion?${contexto}`, texto: "Preparar once inicial" };
  return null;
}

const formatoSemana = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long" });

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

  const semana = datos?.semana ?? semanaDe(hoyLocal());
  const fecha = formatoSemana.formatRange(
    new Date(`${semana.desde}T12:00`),
    new Date(`${semana.hasta}T12:00`),
  );
  return (
    <>
      <header className={styles.semana}>
        <h2>Esta semana</h2>
        <p>{fecha}</p>
      </header>
      {fallo ? (
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
      ) : !datos ? (
        <div className={styles.partidos} role="status">
          <p className={styles.espera}>Cargando los partidos de la semana…</p>
          <span className={styles.esqueleto} aria-hidden="true" />
          <span className={styles.esqueleto} aria-hidden="true" />
        </div>
      ) : datos.partidos.length === 0 ? (
        <EmptyState
          title="Sin partidos esta semana"
          detail="Consulta las próximas jornadas o revisa las anteriores en Liga."
          action={<StateLink href="/admin/partidos">Ver jornadas</StateLink>}
        />
      ) : (
        <TarjetasPartidos datos={datos} />
      )}
    </>
  );
}

function TarjetasPartidos({ datos }: { datos: Datos }) {
  const { acceso } = useStudio();
  const puedeHacerCarteles = !reservada("carteles", acceso);
  const partidos = datos.partidos.map(({ categoria, partido }) => {
    const despues = trasPartido(partido, datos.momento);
    return {
      categoria,
      partido,
      despues,
      accion: accionDelDia(partido, categoria, despues, puedeHacerCarteles),
    };
  });
  const destacada = Math.max(0, partidos.findIndex(({ accion }) => accion));
  return (
    <div className={styles.partidos}>
      {partidos.map(({ categoria, partido: p, despues, accion }, indice) => {
        const destacadaEsta = indice === destacada;
        const principal = destacadaEsta ? accion : null;
        const abrir = `/admin/partidos?categoria=${encodeURIComponent(categoria)}&partido=${encodeURIComponent(p.id)}`;
        const cuando = fechaPartido(p.fecha);
        const cat = encodeURIComponent(categoria);
        // Local arriba, como en el acta.
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
        const resultado = marcador(p);
        const estadoTarea = tarea(p, categoria, despues);
        return (
          <section
            key={p.id}
            className={styles.tarjeta}
            data-destacada={destacadaEsta || undefined}
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
                <ul aria-label={resultado ? `Resultado ${resultado.cifras}` : undefined}>
                  {equipos.map((e) => (
                    <li key={e.nombre} data-propio={e.propio || undefined}>
                      {e.escudo ? (
                        // eslint-disable-next-line @next/next/no-img-element -- escudo de la media local
                        <img src={e.escudo} alt="" width={24} height={24} />
                      ) : (
                        <span className={styles.sinEscudo} aria-hidden="true" />
                      )}
                      <span className={styles.nombreEquipo}>{e.nombre}</span>
                      {resultado && <span className={styles.gol}>{e.goles}</span>}
                    </li>
                  ))}
                </ul>
                {!resultado && <p className={styles.hora}>{cuando.hora || "—"}</p>}
              </div>
              {estadoTarea && <p className={styles.tarea}>{estadoTarea}</p>}
              <p className={styles.partidoCuando}>
                <Link
                  href={abrir}
                  transitionTypes={["nav-forward"]}
                  aria-label={`Ver partido de ${categoria} contra ${p.rival.nombre}: ${cuando.dia}${p.campo ? `, ${p.campo}` : ""}`}
                  data-abrir-partido
                >
                  <span>{cuando.dia}</span>
                  {p.campo && <span className={styles.campo}>{p.campo}</span>}
                  {!principal && (
                    <span className={styles.accion}>
                      Ver partido <span aria-hidden="true">→</span>
                    </span>
                  )}
                </Link>
              </p>
            </article>
            {principal && (
              <Link
                className={styles.accion}
                data-accion-principal
                href={principal.href}
                transitionTypes={["nav-forward"]}
              >
                {principal.texto} <span aria-hidden="true">→</span>
              </Link>
            )}
          </section>
        );
      })}
    </div>
  );
}
