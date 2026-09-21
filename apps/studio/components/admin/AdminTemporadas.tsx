"use client";
import { useState, useEffect, useCallback, useRef, type FormEvent } from "react";
import type { TemporadaDto } from "@/lib/dto";
import {
  activarTemporada,
  cargarTemporadas,
  crearTemporada,
} from "@/lib/server/acciones/temporadas";
import { useUnsavedChanges } from "@/components/studio/StudioContext";
import { Button } from "@/components/ui/foundation/Button";
import { Field } from "@/components/ui/foundation/Fields";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/foundation/States";
import styles from "./AdminTemporadas.module.css";

interface AdminTemporadasProps {
  showToast: (msg: string, type?: "success" | "error") => void;
  showConfirm: (msg: string, onConfirm: () => void | Promise<void>) => void;
}

export default function AdminTemporadas({ showToast, showConfirm }: AdminTemporadasProps) {
  const [temporadas, setTemporadas] = useState<TemporadaDto[]>([]);
  const [nombre, setNombre] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const operation = useRef(false);
  const [fetching, setFetching] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string>();
  const [activationError, setActivationError] = useState<string | null>(null);
  useUnsavedChanges(nombre !== "");

  const load = useCallback(async () => {
    setFetching(true);
    setLoadError(null);
    try {
      const result = await cargarTemporadas();
      if (result.ok) setTemporadas(result.datos);
      else setLoadError(result.error);
    } catch {
      setLoadError("No se pudieron cargar las temporadas.");
    } finally {
      setFetching(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (operation.current || !nombre.trim()) return;
    operation.current = true;
    setPending("create");
    setFormError(undefined);
    try {
      const result = await crearTemporada(nombre.trim());
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      setTemporadas((previous) =>
        [...previous, result.datos].sort((a, b) => b.nombre.localeCompare(a.nombre)),
      );
      setNombre("");
      showToast("Temporada creada");
    } catch {
      setFormError("No se pudo crear la temporada. Tus datos siguen aquí.");
    } finally {
      operation.current = false;
      setPending(null);
    }
  }

  async function activate(id: string) {
    if (operation.current) return;
    operation.current = true;
    setPending(id);
    setActivationError(null);
    try {
      const result = await activarTemporada(id);
      if (!result.ok) {
        setActivationError(result.error);
        return;
      }
      setTemporadas((previous) =>
        previous.map((season) => ({ ...season, activa: season.id === id })),
      );
      showToast("Temporada activa actualizada");
    } catch {
      setActivationError("No se pudo activar la temporada. Vuelve a intentarlo.");
    } finally {
      operation.current = false;
      setPending(null);
    }
  }

  return (
    <div className={styles.layout}>
      <section className={styles.list} aria-labelledby="temporadas-listado">
        <div className={styles.intro}>
          <h2 id="temporadas-listado">Tu historial deportivo</h2>
          <p>
            La temporada activa se usa como destino por defecto. Consultar otra temporada en
            Calendario no cambia cuál está activa.
          </p>
        </div>
        {activationError && <ErrorState title={activationError} />}
        {fetching ? (
          <LoadingState title="Cargando temporadas…" />
        ) : loadError ? (
          <ErrorState
            title={loadError}
            action={
              <Button variant="secondary" onClick={() => void load()}>
                Reintentar
              </Button>
            }
          />
        ) : temporadas.length === 0 ? (
          <EmptyState
            title="Todavía no hay temporadas"
            detail="Crea la primera para empezar a organizar las competiciones."
          />
        ) : (
          <ul className={styles.seasons}>
            {temporadas.map((season) => (
              <li key={season.id} className={`${styles.row} ${season.activa ? styles.active : ""}`}>
                <div className={styles.identity}>
                  <strong>{season.nombre}</strong>
                  {season.activa && <span className={styles.badge}>Activa</span>}
                </div>
                {!season.activa && (
                  <Button
                    variant="secondary"
                    disabled={pending !== null}
                    pending={pending === season.id}
                    pendingLabel="Activando…"
                    aria-label={`Usar ${season.nombre} como temporada activa`}
                    onClick={() =>
                      showConfirm(
                        `Usar ${season.nombre} como temporada activa cambia el destino por defecto de las nuevas operaciones. Los datos de las otras temporadas se conservan.`,
                        () => activate(season.id),
                      )
                    }
                  >
                    Usar como activa
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className={styles.create} aria-labelledby="temporadas-crear">
        <h2 id="temporadas-crear">Nueva temporada</h2>
        <p>La primera queda activa automáticamente. Las siguientes se activan cuando tú decidas.</p>
        <form onSubmit={create} className={styles.form}>
          <Field
            label="Nombre de temporada"
            hint="Formato: 2026/27"
            placeholder="2026/27"
            value={nombre}
            onChange={(event) => {
              setNombre(event.target.value);
              setFormError(undefined);
            }}
            error={formError}
            disabled={pending !== null}
            required
          />
          <Button
            type="submit"
            disabled={pending !== null || fetching || loadError !== null || !nombre.trim()}
            pending={pending === "create"}
            pendingLabel="Creando…"
          >
            Crear temporada
          </Button>
        </form>
      </section>
    </div>
  );
}
