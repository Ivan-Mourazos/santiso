"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/foundation/Button";
import { Field } from "@/components/ui/foundation/Fields";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/foundation/States";
import { filtrarEquipos, type EquipoCatalogo } from "@/lib/equipos/modelo";
import { cargarCatalogoEquipos } from "@/lib/server/acciones/equipos";
import { useCompeticiones } from "@/lib/useCompeticiones";
import ControlesCompeticion from "./equipos/ControlesCompeticion";
import EditorEquipo from "./equipos/EditorEquipo";
import IncorporarEquipo from "./equipos/IncorporarEquipo";
import EliminarEquipo from "./equipos/EliminarEquipo";
import styles from "./equipos/Equipos.module.css";

interface Props {
  showToast: (msg: string, type?: "success" | "error") => void;
  showConfirm: (msg: string, onConfirm: () => void) => void;
  categoria: string;
}
type Dialogo =
  | { tipo: "editor"; equipo: EquipoCatalogo | null }
  | { tipo: "incorporar" }
  | { tipo: "baja"; id: string; modo: "quitar" | "eliminar" };

export default function AdminEquipos({ categoria, showToast }: Props) {
  const contexto = useCompeticiones(categoria, true);
  const [catalogo, setCatalogo] = useState<EquipoCatalogo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [biblioteca, setBiblioteca] = useState(false);
  const [texto, setTexto] = useState("");
  const [sinEscudo, setSinEscudo] = useState(false);
  const [dialogo, setDialogo] = useState<Dialogo | null>(null);
  const generacion = useRef(0);
  const competicion = contexto.competicionesEnCategoria.find(
    (c) => c.id === contexto.selectedCompetitionId,
  );
  const verBiblioteca = biblioteca || !competicion;
  const recargar = useCallback(async (trasGuardar = false) => {
    const token = ++generacion.current;
    setCargando(true);
    try {
      const datos = await cargarCatalogoEquipos();
      if (token !== generacion.current) return;
      setCatalogo(datos);
      setError(null);
    } catch {
      if (token === generacion.current)
        setError(
          trasGuardar
            ? "La operación terminó, pero no se pudo actualizar la vista. Recarga el catálogo."
            : "No se pudo cargar el catálogo de equipos.",
        );
    } finally {
      if (token === generacion.current) setCargando(false);
    }
  }, []);
  useEffect(() => {
    if (!contexto.contextoListo) return;
    void recargar();
    const solicitudes = generacion;
    return () => {
      solicitudes.current++;
    };
  }, [recargar, contexto.contextoListo]);
  const base = useMemo(
    () =>
      catalogo.filter(
        (e) =>
          e.categoria === categoria &&
          (verBiblioteca || e.competiciones.some((c) => c.id === competicion?.id)),
      ),
    [catalogo, categoria, verBiblioteca, competicion?.id],
  );
  const visibles = useMemo(
    () => filtrarEquipos(base, { texto, soloSinEscudo: sinEscudo }),
    [base, texto, sinEscudo],
  );
  const equipoBaja =
    dialogo?.tipo === "baja" ? catalogo.find((e) => e.id === dialogo.id) : undefined;
  function terminado(mensaje: string) {
    setDialogo(null);
    showToast(mensaje);
    void recargar(true);
  }
  if (contexto.errorCompeticiones)
    return (
      <ErrorState
        title="No se pudo cargar el contexto"
        detail={contexto.errorCompeticiones}
        action={<Button onClick={() => void contexto.loadCompeticiones()}>Reintentar</Button>}
      />
    );
  if (!contexto.contextoListo) return <LoadingState title="Cargando contexto deportivo…" />;
  return (
    <div className={styles.panel}>
      <header className={styles.cabecera}>
        <div>
          <h3>Equipos · {categoria}</h3>
          <p className={styles.detalle}>Biblioteca de clubes, escudos e inscripciones.</p>
        </div>
        <div className={styles.acciones}>
          <Button
            disabled={!competicion || cargando || Boolean(error)}
            onClick={() => setDialogo({ tipo: "incorporar" })}
          >
            Añadir a competición
          </Button>
          <Button
            variant="secondary"
            disabled={cargando || Boolean(error)}
            onClick={() => setDialogo({ tipo: "editor", equipo: null })}
          >
            Crear equipo
          </Button>
        </div>
      </header>
      <ControlesCompeticion
        contexto={contexto}
        categoria={categoria}
        onMutado={() => {
          showToast("Competición actualizada");
          void recargar(true);
        }}
      />
      {!competicion && (
        <p className={styles.detalle}>
          No hay competición seleccionada. Puedes gestionar la biblioteca; crea una competición para
          inscribir equipos.
        </p>
      )}
      <div className={styles.vistas} role="group" aria-label="Vista de equipos">
        <Button
          size="sm"
          variant={verBiblioteca ? "secondary" : "primary"}
          aria-pressed={!verBiblioteca}
          disabled={!competicion}
          onClick={() => setBiblioteca(false)}
        >
          Esta competición
        </Button>
        <Button
          size="sm"
          variant={verBiblioteca ? "primary" : "secondary"}
          aria-pressed={verBiblioteca}
          onClick={() => setBiblioteca(true)}
        >
          Biblioteca de {categoria}
        </Button>
      </div>
      {error ? (
        <ErrorState
          title={error}
          action={<Button onClick={() => void recargar()}>Reintentar</Button>}
        />
      ) : cargando ? (
        <LoadingState title="Cargando equipos…" />
      ) : (
        <>
          <div className={styles.herramientas} role="search" aria-label="Filtrar equipos">
            <Field
              label="Buscar equipo"
              type="search"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Nombre del equipo"
            />
            <label className={styles.casilla}>
              <input
                className={styles.check}
                type="checkbox"
                checked={sinEscudo}
                onChange={(e) => setSinEscudo(e.target.checked)}
              />
              Sin escudo
            </label>
          </div>
          <p role="status" className={styles.contador}>
            {visibles.length} de {base.length} equipos
          </p>
          {base.length === 0 ? (
            <EmptyState
              title={
                verBiblioteca ? "La biblioteca está vacía." : "No hay equipos en esta competición."
              }
              detail={
                verBiblioteca
                  ? "Crea el primer equipo de esta categoría."
                  : "Añade un equipo de la biblioteca o crea uno nuevo."
              }
            />
          ) : visibles.length === 0 ? (
            <EmptyState
              title="Ningún equipo coincide con los filtros."
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setTexto("");
                    setSinEscudo(false);
                  }}
                >
                  Quitar filtros
                </Button>
              }
            />
          ) : (
            <table className={styles.tabla} aria-label={`Equipos ${categoria}`}>
              <thead>
                <tr>
                  <th scope="col">Escudo</th>
                  <th scope="col">Equipo y competiciones</th>
                  <th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((equipo) => (
                  <tr key={equipo.id}>
                    <td>
                      {equipo.escudo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element -- escudo local del catálogo
                        <img
                          className={styles.escudo}
                          src={equipo.escudo_url}
                          alt={`Escudo de ${equipo.nombre}`}
                        />
                      ) : (
                        <span className={styles.escudo} role="img" aria-label="Sin escudo" />
                      )}
                    </td>
                    <td>
                      <span className={styles.nombre}>{equipo.nombre}</span>
                      <span className={styles.detalle}>
                        {equipo.categoria} · {equipo.numeroPartidos}{" "}
                        {equipo.numeroPartidos === 1 ? "partido" : "partidos"}
                      </span>
                      {/* Una línea: con varias competiciones la fila crecía sin control. Completo al
                          pasar el ratón. */}
                      <span
                        className={`${styles.detalle} ${styles.unaLinea}`}
                        title={equipo.competiciones
                          .map((c) => `${c.nombre} · ${c.temporadaNombre}`)
                          .join("; ")}
                      >
                        {equipo.competiciones
                          .map((c) => `${c.nombre} · ${c.temporadaNombre}`)
                          .join("; ") || "Sin competiciones"}
                      </span>
                    </td>
                    <td>
                      <div className={styles.acciones}>
                        <Button
                          variant="secondary"
                          size="sm"
                          aria-label={`Editar a ${equipo.nombre}`}
                          onClick={() => setDialogo({ tipo: "editor", equipo })}
                        >
                          Editar
                        </Button>
                        {competicion &&
                          equipo.competiciones.some((c) => c.id === competicion.id) && (
                            <Button
                              variant="secondary"
                              size="sm"
                              aria-label={`Quitar ${equipo.nombre} de ${competicion.nombre}`}
                              onClick={() =>
                                setDialogo({ tipo: "baja", id: equipo.id, modo: "quitar" })
                              }
                            >
                              Quitar
                            </Button>
                          )}
                        <Button
                          variant="secondary"
                          size="sm"
                          aria-label={
                            equipo.numeroPartidos > 0
                              ? `Revisar baja de ${equipo.nombre}`
                              : `Eliminar ${equipo.nombre} de biblioteca`
                          }
                          onClick={() =>
                            setDialogo({ tipo: "baja", id: equipo.id, modo: "eliminar" })
                          }
                        >
                          {equipo.numeroPartidos > 0 ? "Baja" : "Eliminar"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
      {dialogo?.tipo === "editor" && (
        <EditorEquipo
          equipo={dialogo.equipo}
          destino={{
            categoria,
            competicionId: !dialogo.equipo && !verBiblioteca ? competicion?.id : undefined,
            competicionNombre: competicion?.nombre,
          }}
          onCerrar={() => setDialogo(null)}
          onGuardado={() => terminado("Equipo guardado")}
        />
      )}
      {dialogo?.tipo === "incorporar" && competicion && (
        <IncorporarEquipo
          catalogo={catalogo}
          categoria={categoria}
          competicion={competicion}
          onCerrar={() => setDialogo(null)}
          onGuardado={() => terminado("Equipo añadido a la competición")}
        />
      )}
      {dialogo?.tipo === "baja" && equipoBaja && (
        <EliminarEquipo
          equipo={equipoBaja}
          competicion={competicion}
          modoInicial={dialogo.modo}
          onCerrar={() => setDialogo(null)}
          onGuardado={terminado}
          onReleer={() => recargar()}
        />
      )}
    </div>
  );
}
