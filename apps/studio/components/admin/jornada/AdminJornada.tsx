"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useStudio } from "@/components/studio/StudioContext";
import { Button } from "@/components/ui/foundation/Button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/foundation/States";
import { esDia, hoyLocal, semanaDe, semanaVecina } from "@/lib/jornada/semana";
import { cargarPantallaJornada } from "@/lib/server/acciones/jornada";
import type { PantallaJornada } from "@/lib/server/consultas/jornada";
import PanelRfgf from "./PanelRfgf";
import TarjetaPartido, { fechaPartido } from "./TarjetaPartido";
import { marcador, partidoEnMesa } from "@/lib/jornada/vestiario";
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
function rotuloSemana(desde: string, hasta: string) {
  const [, m1, d1] = desde.split("-").map(Number) as [number, number, number];
  const [, m2, d2] = hasta.split("-").map(Number) as [number, number, number];
  return m1 === m2
    ? `del ${d1} al ${d2} de ${MESES[m2 - 1]}`
    : `del ${d1} de ${MESES[m1 - 1]} al ${d2} de ${MESES[m2 - 1]}`;
}

/** Mesa de trabajo de cada equipo. Todas las acciones aquí son navegación o consulta. */
export default function AdminJornada() {
  const { params, setParams, showToast } = useStudio();
  const pedida = params.get("semana");
  const historico = esDia(pedida);
  const dia = historico ? pedida : hoyLocal();
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
  const categoria =
    pantalla?.categorias.find((c) => c.categoria === params.get("categoria")) ??
    pantalla?.categorias[0];
  const base = categoria
    ? historico
      ? (categoria.partidos[0] ?? null)
      : partidoEnMesa(categoria.proximo, categoria.ultimo, pantalla!.momento)
    : null;
  const candidatos = categoria ? [categoria.proximo, categoria.ultimo, ...categoria.partidos] : [];
  const elegido = candidatos.find((p) => p?.id === params.get("partido"));
  const partido = elegido ?? base;
  const ultimo = categoria?.ultimo;
  const proximo = categoria?.proximo;
  const irA = (d: string | null) => setParams({ semana: d, partido: null });

  if (error)
    return (
      <ErrorState
        title="No se pudo cargar la jornada"
        detail={error}
        action={<Button onClick={() => void cargar(dia)}>Reintentar</Button>}
      />
    );
  if (!pantalla || pantalla.semana.desde !== semana.desde)
    return <LoadingState title="Cargando el próximo partido…" />;

  return (
    <div className={styles.pantalla}>
      <div className={styles.mesaCabecera}>
        <p className={styles.etiqueta}>{historico ? "Archivo de partidos" : "Mesa de partido"}</p>
        <div className={styles.equipos} role="group" aria-label="Equipo">
          {pantalla.categorias.map((c) => (
            <button
              key={c.categoria}
              type="button"
              aria-pressed={c.categoria === categoria?.categoria}
              onClick={() => setParams({ categoria: c.categoria, partido: null })}
            >
              {c.categoria}
            </button>
          ))}
        </div>
      </div>
      {pantalla.categorias.length === 0 ? (
        <EmptyState
          title="No hay competiciones en la temporada activa."
          detail="Crea una en Equipos o carga el calendario desde el PDF de la federación."
        />
      ) : (
        <section className={styles.categoria} aria-label={categoria!.categoria}>
          {historico && (
            <div className={styles.archivoCabecera}>
              <h3>Semana {rotuloSemana(semana.desde, semana.hasta)}</h3>
              <button type="button" className={styles.acceso} onClick={() => irA(null)}>
                Volver al próximo partido<span aria-hidden="true">→</span>
              </button>
              {categoria!.partidos.length > 1 && (
                <label>
                  Partido
                  <select
                    value={partido?.id ?? ""}
                    onChange={(ev) => setParams({ partido: ev.target.value })}
                  >
                    {categoria!.partidos.map((p) => (
                      <option key={p.id} value={p.id}>
                        J{p.jornadaNumero} · {p.rival.nombre} · {fechaPartido(p.fecha).dia}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )}
          <div className={styles.mesa}>
            {partido ? (
              <TarjetaPartido
                key={partido.id}
                partido={partido}
                categoria={categoria!.categoria}
                momento={pantalla.momento}
              />
            ) : (
              <EmptyState
                title={historico ? "Sin partido esta semana." : "Sin próximo partido."}
                detail="Consulta el calendario para ver fechas pendientes o preparar otro encuentro."
                action={
                  <Link
                    className={styles.acceso}
                    href={`/admin/calendario?categoria=${encodeURIComponent(categoria!.categoria)}&vista=santiso`}
                  >
                    Ver calendario →
                  </Link>
                }
              />
            )}
            <aside className={styles.resumenes} aria-label="Contexto del equipo">
              {proximo && partido?.id !== proximo.id && (
                <section className={styles.resumen} aria-label="Siguiente encuentro">
                  <p className={styles.etiqueta}>Próximo partido</p>
                  <h3>{proximo.rival.nombre}</h3>
                  <p>
                    {fechaPartido(proximo.fecha).dia} ·{" "}
                    {fechaPartido(proximo.fecha).hora || "Sin hora"} ·{" "}
                    {proximo.santisoLocal ? "Casa" : "Fuera"}
                  </p>
                  <button
                    type="button"
                    className={styles.acceso}
                    onClick={() => setParams({ semana: null, partido: proximo.id })}
                  >
                    Preparar siguiente<span aria-hidden="true">→</span>
                  </button>
                </section>
              )}
              {/* Si el último partido ya está en la mesa, no se repite debajo. */}
              {ultimo && partido?.id === ultimo.id ? null : ultimo ? (
                <section className={styles.resumen} aria-label="Último partido">
                  <p className={styles.etiqueta}>
                    Último partido · {fechaPartido(ultimo.fecha).dia}
                  </p>
                  <h3>
                    {ultimo.rival.nombre}
                    <span className={styles.resultado}>
                      {marcador(ultimo)?.cifras ?? "Sin resultado"}
                    </span>
                  </h3>
                  <p>
                    {[marcador(ultimo)?.desenlace, ultimo.santisoLocal ? "Casa" : "Fuera"]
                      .filter(Boolean)
                      .join(" · ")}{" "}
                    ·{" "}
                    {ultimo.acta ? "Acta guardada" : "Acta pendiente"}
                  </p>
                  {ultimo.acta && (
                    <p>
                      {ultimo.acta.convocados} convocados
                      {ultimo.acta.goleadores.length
                        ? ` · Goles: ${ultimo.acta.goleadores.map((g) => `${g.nombre} (${g.goles})`).join(", ")}`
                        : ""}
                      {ultimo.acta.amarillas ? ` · ${ultimo.acta.amarillas} amarillas` : ""}
                      {ultimo.acta.rojas ? ` · ${ultimo.acta.rojas} rojas` : ""}
                    </p>
                  )}
                  {partido?.id !== ultimo.id && (
                    <button
                      type="button"
                      className={styles.acceso}
                      onClick={() => setParams({ semana: null, partido: ultimo.id })}
                    >
                      Acta y publicaciones<span aria-hidden="true">→</span>
                    </button>
                  )}
                </section>
              ) : (
                <p className={styles.nota}>Todavía no hay partidos jugados.</p>
              )}
            </aside>
          </div>
        </section>
      )}
      <details className={styles.archivo} open={historico || undefined}>
        <summary>Otras semanas</summary>
        {!historico && <h3>Semana {rotuloSemana(semana.desde, semana.hasta)}</h3>}
        <div className={styles.botones}>
          <button type="button" onClick={() => irA(semanaVecina(dia, -1))}>
            ← Anterior
          </button>
          {!esEstaSemana && (
            <button type="button" onClick={() => irA(null)}>
              Esta semana
            </button>
          )}
          <button type="button" onClick={() => irA(semanaVecina(dia, 1))}>
            Siguiente →
          </button>
        </div>
      </details>
      {/* A la vista: es el cartel de cada semana, no algo de archivo. */}
      <Link className={styles.acceso} href="/admin/carteles?plantilla=proximos&rellenar=1">
        Próximos encuentros<span aria-hidden="true">↗</span>
      </Link>
      <PanelRfgf showToast={showToast} onNovedades={() => void cargar(dia)} />
    </div>
  );
}
