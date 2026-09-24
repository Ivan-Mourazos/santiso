"use client";

import Link from "next/link";
import { useState } from "react";
import { useStudio, useUnsavedChanges } from "@/components/studio/StudioContext";
import { Button } from "@/components/ui/foundation/Button";
import { Select } from "@/components/ui/foundation/Fields";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/foundation/States";
import { borrarJornada } from "@/lib/server/acciones/calendario";
import Descansos from "./Descansos";
import DialogoJornadas from "./DialogoJornadas";
import DialogoReglas from "./DialogoReglas";
import FilaPartido from "./FilaPartido";
import NuevoPartido from "./NuevoPartido";
import { useCalendario } from "./useCalendario";
import styles from "./Calendario.module.css";

interface Props {
  showToast: (msg: string, type?: "success" | "error") => void;
  showConfirm: (msg: string, onConfirm: () => void) => void;
  categoria: string;
}

/** Nombre visible de una jornada: número y, si la tiene, su fase. */
const nombreJornada = (j: { numero: number; nombre_fase?: string | null }) =>
  `Jornada ${j.numero}${j.nombre_fase ? ` · ${j.nombre_fase}` : ""}`;

/**
 * Calendario de una competición: jornadas, partidos y descansos. Desde la 6G las piezas viven
 * aparte; aquí solo se elige qué se ve y se reparte. Crear temporadas y competiciones ya no se
 * hace aquí: tienen su pantalla (Temporadas y Equipos) y se enlazan.
 */
export default function AdminCalendario({ showToast, showConfirm, categoria }: Props) {
  const c = useCalendario(categoria);
  const { setParams } = useStudio();
  const [dialogo, setDialogo] = useState<"jornadas" | "reglas" | null>(null);
  useUnsavedChanges(c.partidos.some(c.conCambios));

  const competicion = c.competicionesEnCategoria.find((x) => x.id === c.selectedCompetitionId);
  const jornada = c.jornadas.find((j) => j.id === c.selectedJornada);

  function borrarLaJornada() {
    if (!jornada) return;
    showConfirm(
      `¿Eliminar la ${nombreJornada(jornada)} con todos sus partidos? La clasificación se recalculará.`,
      async () => {
        const resultado = await borrarJornada(jornada.id);
        if (!resultado.ok) return showToast(resultado.error, "error");
        await c.cargarJornadas();
        showToast("Jornada borrada");
      },
    );
  }

  if (!c.contextoListo && !c.errorCompeticiones) {
    return <LoadingState title="Cargando contexto deportivo…" />;
  }
  if (c.errorCompeticiones) {
    return (
      <ErrorState
        title="No se pudieron cargar las competiciones"
        detail={c.errorCompeticiones}
        action={<Button onClick={() => void c.loadCompeticiones()}>Reintentar</Button>}
      />
    );
  }

  return (
    <div className={styles.panel}>
      <section className={styles.bloque} aria-label="Qué se ve">
        <div className={styles.selectores}>
          <Select
            label="Temporada"
            value={c.selectedSeasonId}
            onChange={(e) =>
              setParams({ temporada: e.target.value, competicion: null, jornada: null })
            }
          >
            {c.temporadas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
                {t.activa ? " (activa)" : ""}
              </option>
            ))}
          </Select>
          <Select
            label="Competición"
            value={c.selectedCompetitionId}
            onChange={(e) => c.setSelectedCompetitionId(e.target.value)}
            disabled={c.competicionesEnCategoria.length === 0}
          >
            {c.competicionesEnCategoria.length === 0 && <option value="">Sin competiciones</option>}
            {c.competicionesEnCategoria.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nombre}
              </option>
            ))}
          </Select>
          {c.vista === "jornada" && (
            <Select
              label="Jornada"
              value={c.selectedJornada ?? ""}
              onChange={(e) => c.setSelectedJornada(e.target.value || null)}
              disabled={c.jornadas.length === 0}
            >
              {c.jornadas.length === 0 && <option value="">Sin jornadas</option>}
              {c.jornadas.map((j) => (
                <option key={j.id} value={j.id}>
                  {nombreJornada(j)}
                </option>
              ))}
            </Select>
          )}
        </div>

        {/* Para corregir horas y campos de toda la temporada sin ir jornada a jornada. */}
        <div className={styles.acciones} role="group" aria-label="Qué partidos">
          <Button
            size="sm"
            variant={c.vista === "jornada" ? "primary" : "secondary"}
            aria-pressed={c.vista === "jornada"}
            onClick={() => c.setVista("jornada")}
          >
            Por jornada
          </Button>
          <Button
            size="sm"
            variant={c.vista === "santiso" ? "primary" : "secondary"}
            aria-pressed={c.vista === "santiso"}
            onClick={() => c.setVista("santiso")}
          >
            Partidos del Santiso
          </Button>
        </div>

        <div className={styles.acciones}>
          <Button
            variant="secondary"
            onClick={() => setDialogo("jornadas")}
            disabled={!c.selectedCompetitionId}
          >
            Jornadas…
          </Button>
          <Button
            variant="secondary"
            onClick={() => setDialogo("reglas")}
            disabled={!c.selectedCompetitionId}
          >
            Zonas de la clasificación
          </Button>
          {jornada && c.vista === "jornada" && (
            <Button variant="danger" onClick={borrarLaJornada}>
              Borrar jornada
            </Button>
          )}
          <p className={styles.nota}>
            <Link href="/admin/temporadas">Gestionar temporadas</Link> ·{" "}
            <Link href={`/admin/equipos?categoria=${encodeURIComponent(categoria)}`}>
              Gestionar competiciones
            </Link>
          </p>
        </div>
      </section>

      {c.competicionesEnCategoria.length === 0 ? (
        <EmptyState
          title={`${categoria} no tiene competiciones en esta temporada.`}
          detail="Se crean en Equipos, o al cargar el calendario desde el PDF de la federación."
        />
      ) : c.cargando && c.jornadas.length === 0 ? (
        <LoadingState title="Cargando jornadas…" />
      ) : c.vista === "santiso" ? (
        <section className={styles.bloque} aria-label="Partidos del Santiso">
          <h3 className={styles.titulo}>Partidos del Santiso · toda la temporada</h3>
          <p className={`${styles.nota} ${styles.vacio}`}>
            Corrige aquí fecha, hora y campo de cada partido; cada fila se guarda con su botón.
          </p>
          {c.partidos.length === 0 ? (
            <p className={`${styles.nota} ${styles.vacio}`}>
              El Santiso no tiene partidos en esta competición.
            </p>
          ) : (
            <div className={`${styles.partidos} ${styles.vacio}`}>
              {c.partidos.map((p) => {
                const suJornada = c.jornadas.find((j) => j.id === p.jornada_id);
                return (
                  <FilaPartido
                    key={p.id}
                    contexto={suJornada ? nombreJornada(suJornada) : undefined}
                    partido={p}
                    local={c.nombreEquipo(p.equipo_local_id)}
                    visitante={c.nombreEquipo(p.equipo_visitante_id)}
                    escudoLocal={c.escudoEquipo(p.equipo_local_id)}
                    escudoVisitante={c.escudoEquipo(p.equipo_visitante_id)}
                    campos={c.campos}
                    conCambios={c.conCambios(p)}
                    onEditar={(cambio) => c.editarPartido(p.id, cambio)}
                    onRecargar={c.cargarPartidos}
                    showToast={showToast}
                    showConfirm={showConfirm}
                  />
                );
              })}
            </div>
          )}
        </section>
      ) : !jornada ? (
        <EmptyState
          title="Esta competición todavía no tiene jornadas."
          detail="Créalas en «Jornadas…», de una en una o todas de golpe."
          action={<Button onClick={() => setDialogo("jornadas")}>Crear jornadas</Button>}
        />
      ) : (
        <>
          <section
            className={styles.bloque}
            aria-label={`Partidos de la ${nombreJornada(jornada)}`}
          >
            <h3 className={styles.titulo}>Partidos · {nombreJornada(jornada)}</h3>
            {c.partidos.length === 0 ? (
              <p className={styles.nota}>No hay partidos registrados en esta jornada.</p>
            ) : (
              <div className={styles.partidos}>
                {c.partidos.map((p) => (
                  <FilaPartido
                    key={p.id}
                    partido={p}
                    local={c.nombreEquipo(p.equipo_local_id)}
                    visitante={c.nombreEquipo(p.equipo_visitante_id)}
                    escudoLocal={c.escudoEquipo(p.equipo_local_id)}
                    escudoVisitante={c.escudoEquipo(p.equipo_visitante_id)}
                    campos={c.campos}
                    conCambios={c.conCambios(p)}
                    onEditar={(cambio) => c.editarPartido(p.id, cambio)}
                    onRecargar={c.cargarPartidos}
                    showToast={showToast}
                    showConfirm={showConfirm}
                  />
                ))}
              </div>
            )}
          </section>

          <NuevoPartido
            key={`partido-${jornada.id}`}
            jornadaId={jornada.id}
            equipos={c.equipos}
            campos={c.campos}
            partidos={c.partidos}
            ocupados={c.ocupados}
            onCreado={() => c.cargarPartidos()}
            showToast={showToast}
          />

          <Descansos
            key={`descanso-${jornada.id}`}
            jornadaId={jornada.id}
            equipos={c.equipos}
            descansos={c.descansos}
            ocupados={c.ocupados}
            nombreEquipo={c.nombreEquipo}
            onCambiado={c.cargarDescansos}
            showToast={showToast}
            showConfirm={showConfirm}
          />
        </>
      )}

      {dialogo === "jornadas" && competicion && (
        <DialogoJornadas
          competicionId={competicion.id}
          competicion={competicion.nombre}
          onCerrar={() => setDialogo(null)}
          onCreadas={c.cargarJornadas}
          showToast={showToast}
        />
      )}
      {dialogo === "reglas" && competicion && (
        <DialogoReglas
          competicionId={competicion.id}
          competicion={competicion.nombre}
          onCerrar={() => setDialogo(null)}
          showToast={showToast}
        />
      )}
    </div>
  );
}
