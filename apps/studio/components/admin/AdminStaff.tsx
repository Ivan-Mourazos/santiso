"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStudio } from "@/components/studio/StudioContext";
import { Button } from "@/components/ui/foundation/Button";
import { Field } from "@/components/ui/foundation/Fields";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/foundation/States";
import type { StaffDto } from "@/lib/dto";
import { filtrarStaff } from "@/lib/plantilla/modelo";
import {
  cargarCandidatosStaff,
  cargarStaff,
  incorporarStaff,
  quitarMiembroStaffDeTemporada,
} from "@/lib/server/acciones/staff";
import { useCompeticiones } from "@/lib/useCompeticiones";
import BarraTemporada from "./plantilla/BarraTemporada";
import EditorStaff from "./plantilla/EditorStaff";
import IncorporarDeTemporada, { type Elegido } from "./plantilla/IncorporarDeTemporada";
import styles from "./plantilla/Plantilla.module.css";

interface AdminStaffProps {
  showToast: (msg: string, type?: "success" | "error") => void;
  showConfirm: (msg: string, onConfirm: () => void) => void;
  tipo: "Tecnico" | "Directiva";
  categoria?: string;
}

/** Qué tiene abierto el editor. `clave` cambia en cada apertura para montarlo de cero. */
type EstadoEditor = { clave: number; miembro: StaffDto | null } | null;

export default function AdminStaff({ showToast, showConfirm, tipo, categoria }: AdminStaffProps) {
  const { setParams } = useStudio();
  // La temporada que se consulta sale de la URL (`?temporada=`); sin ella, la activa.
  const {
    temporadas,
    selectedSeasonId: temporadaId,
    loadingCompeticiones,
    errorCompeticiones,
    loadCompeticiones,
  } = useCompeticiones(undefined, true);
  const temporadaNombre = temporadas.find((t) => t.id === temporadaId)?.nombre ?? "";
  // La directiva no tiene categoría deportiva: nunca se le pasa, aunque la URL traiga una.
  const categoriaDestino = tipo === "Tecnico" ? categoria : undefined;
  const titulo = tipo === "Tecnico" ? `Cuerpo Técnico (${categoria})` : "Junta Directiva";
  const plural = tipo === "Tecnico" ? "técnicos" : "directivos";

  const [staff, setStaff] = useState<StaffDto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [candidatos, setCandidatos] = useState<{ origen: string; miembros: StaffDto[] } | null>(
    null,
  );
  const [incorporando, setIncorporando] = useState(false);
  const [texto, setTexto] = useState("");
  const [editor, setEditor] = useState<EstadoEditor>(null);
  const generacion = useRef(0);

  const fetchStaff = useCallback(async () => {
    if (!temporadaId) return;
    const esta = ++generacion.current;
    setCargando(true);
    try {
      const lista = await cargarStaff(tipo, categoriaDestino, temporadaId);
      if (esta !== generacion.current) return;
      setStaff(lista);
      setErrorCarga(null);
    } catch (err) {
      console.error(err);
      if (esta === generacion.current) {
        setErrorCarga("No se pudo cargar el staff. Comprueba la conexión e inténtalo de nuevo.");
      }
    } finally {
      if (esta === generacion.current) setCargando(false);
    }
    try {
      const r = await cargarCandidatosStaff(tipo, categoriaDestino, temporadaId);
      if (esta === generacion.current) {
        setCandidatos(r.origen ? { origen: r.origen.nombre, miembros: r.miembros } : null);
      }
    } catch (err) {
      // Sin candidatos solo desaparece el botón de incorporar; la pantalla sigue.
      console.error(err);
      if (esta === generacion.current) setCandidatos(null);
    }
  }, [tipo, categoriaDestino, temporadaId]);

  useEffect(() => {
    const id = window.setTimeout(() => void fetchStaff(), 0);
    return () => window.clearTimeout(id);
  }, [fetchStaff]);

  const visibles = useMemo(() => filtrarStaff(staff, texto), [staff, texto]);
  const candidatosDialogo = useMemo(
    () =>
      (candidatos?.miembros ?? []).map((m) => ({
        clave: m.inscripcion_id,
        nombre: m.nombre,
        detalle: m.cargo,
        foto_url: m.foto_url,
      })),
    [candidatos],
  );
  const hayCandidatos = (candidatos?.miembros.length ?? 0) > 0;
  const abrirEditor = (miembro: StaffDto | null) => setEditor({ clave: Date.now(), miembro });

  async function handleIncorporar(elegidos: Elegido[]) {
    const resultado = await incorporarStaff({
      temporadaId,
      inscripciones: elegidos.map((e) => e.clave),
    });
    if (!resultado.ok) {
      showToast(resultado.error, "error");
      return;
    }
    showToast(`${resultado.datos} añadido(s) a ${temporadaNombre}`);
    setIncorporando(false);
    void fetchStaff();
  }

  function handleQuitar(miembro: StaffDto) {
    showConfirm(
      `¿Quitar a ${miembro.nombre} (${miembro.cargo}) de ${temporadaNombre}? Sus otras temporadas no se tocan.`,
      async () => {
        const resultado = await quitarMiembroStaffDeTemporada(miembro.inscripcion_id);
        if (!resultado.ok) {
          showToast(resultado.error, "error");
          return;
        }
        showToast(`${miembro.nombre} ya no está en ${temporadaNombre}`);
        void fetchStaff();
      },
    );
  }

  let contenido: React.ReactNode;
  if (errorCompeticiones) {
    contenido = (
      <ErrorState
        title="No se pudieron cargar las temporadas"
        detail={errorCompeticiones}
        action={<Button onClick={() => void loadCompeticiones()}>Reintentar</Button>}
      />
    );
  } else if (!loadingCompeticiones && temporadas.length === 0) {
    contenido = (
      <EmptyState
        title="Todavía no hay ninguna temporada."
        detail="Crea la temporada en Ajustes › Temporadas y vuelve aquí."
      />
    );
  } else if (errorCarga) {
    contenido = (
      <ErrorState
        title="No se pudo cargar el staff"
        detail={errorCarga}
        action={<Button onClick={() => void fetchStaff()}>Reintentar</Button>}
      />
    );
  } else if (!temporadaId || (cargando && staff.length === 0)) {
    contenido = <LoadingState title="Cargando…" />;
  } else if (staff.length === 0) {
    contenido = (
      <EmptyState
        title={`No hay ${plural}${categoriaDestino ? ` en ${categoriaDestino}` : ""} en ${temporadaNombre}.`}
        detail={
          hayCandidatos
            ? `Trae a quien sigue de ${candidatos?.origen} o da de alta a los nuevos.`
            : "Da de alta a los de esta temporada."
        }
        action={
          <div className={styles.acciones}>
            {hayCandidatos && (
              <Button onClick={() => setIncorporando(true)}>Añadir de {candidatos?.origen}</Button>
            )}
            <Button variant="secondary" onClick={() => abrirEditor(null)}>
              Añadir
            </Button>
          </div>
        }
      />
    );
  } else {
    contenido = (
      <>
        <div className={styles.herramientas} role="search" aria-label={`Filtrar ${plural}`}>
          <Field
            label="Buscar"
            type="search"
            placeholder="Nombre o cargo"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
        </div>
        <p className={styles.contador} role="status">
          {visibles.length === staff.length
            ? `${staff.length} ${plural}`
            : `${visibles.length} de ${staff.length} ${plural}`}
        </p>
        {visibles.length === 0 ? (
          <EmptyState
            title="Nadie coincide con la búsqueda."
            action={
              <Button variant="secondary" onClick={() => setTexto("")}>
                Quitar búsqueda
              </Button>
            }
          />
        ) : (
          <table className={styles.tabla} aria-label={`${titulo} ${temporadaNombre}`}>
            <thead>
              <tr>
                <th scope="col">Foto</th>
                <th scope="col">Nombre</th>
                <th scope="col">Cargo</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((m) => (
                <tr key={m.inscripcion_id}>
                  <td className={styles.celdaFoto}>
                    {m.foto_url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- media local servida por el route handler
                      <img className={styles.foto} src={m.foto_url} alt="" />
                    ) : (
                      <span className={styles.foto} aria-hidden="true" />
                    )}
                  </td>
                  <td className={`${styles.nombre} ${styles.celdaNombre}`}>
                    <strong>{m.nombre}</strong>
                    {/* En móvil la columna de cargo se oculta: se ve aquí, bajo el nombre. */}
                    <span className={styles.soloMovil}>{m.cargo}</span>
                  </td>
                  <td className={styles.celdaPosicion}>{m.cargo}</td>
                  <td className={styles.celdaAcciones}>
                    <div className={styles.filaAcciones}>
                      <Button
                        variant="secondary"
                        onClick={() => abrirEditor(m)}
                        size="sm"
                        aria-label={`Editar a ${m.nombre} (${m.cargo})`}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => handleQuitar(m)}
                        size="sm"
                        aria-label={`Quitar a ${m.nombre} de ${temporadaNombre}`}
                      >
                        Quitar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </>
    );
  }

  const listo = Boolean(temporadaId) && !errorCompeticiones && !errorCarga;

  return (
    <div className={styles.panel}>
      <BarraTemporada
        temporadas={temporadas}
        seleccionada={temporadaId}
        onCambiar={(id) => setParams({ temporada: id })}
      />

      <div className={styles.cabecera}>
        <div>
          <h3>{titulo}</h3>
          <p>Nombres, cargos y fotos de la temporada elegida.</p>
        </div>
        {listo && staff.length > 0 && (
          <div className={styles.acciones}>
            {hayCandidatos && (
              <Button variant="secondary" onClick={() => setIncorporando(true)}>
                Añadir de {candidatos?.origen}
              </Button>
            )}
            <Button onClick={() => abrirEditor(null)}>Añadir</Button>
          </div>
        )}
      </div>

      {contenido}

      {candidatos && (
        <IncorporarDeTemporada
          open={incorporando}
          onClose={() => setIncorporando(false)}
          origen={candidatos.origen}
          candidatos={candidatosDialogo}
          onConfirmar={handleIncorporar}
        />
      )}

      {editor && (
        <EditorStaff
          key={editor.clave}
          miembro={editor.miembro}
          destino={{ temporadaId, temporadaNombre, tipo, categoria: categoriaDestino }}
          onCerrar={() => setEditor(null)}
          onGuardado={(guardado, alta) => {
            setEditor(null);
            showToast(
              alta ? `${guardado.nombre} añadido a ${temporadaNombre}` : "Cambios guardados",
            );
            void fetchStaff();
          }}
        />
      )}
    </div>
  );
}
