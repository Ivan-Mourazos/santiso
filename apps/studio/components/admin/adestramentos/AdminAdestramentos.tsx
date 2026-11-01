"use client";
import { useCallback, useEffect, useState } from "react";
import { claveNombre } from "@santiso/domain";
import { Button } from "@/components/ui/foundation/Button";
import { Field } from "@/components/ui/foundation/Fields";
import { LoadingState, ErrorState } from "@/components/ui/foundation/States";
import { conceptoDe, cambioDe, type Marca, type Estado } from "@/lib/adestramentos/modelo";
import { hoyLocal } from "@/lib/jornada/semana";
import { euros, importeDeMulta } from "@/lib/multas/modelo";
import { sinConexion } from "@/lib/resultado";
import {
  cargarAdestramentos,
  guardarAdestramento,
  borrarAdestramento,
} from "@/lib/server/acciones/adestramentos";
import styles from "./Adestramentos.module.css";
const FECHA = new Intl.DateTimeFormat("es-ES", {
  weekday: "short",
  day: "numeric",
  month: "numeric",
  year: "numeric",
});
const cantidad = (n: number, singular: string, plural = `${singular}s`) =>
  `${n} ${n === 1 ? singular : plural}`;

type Carga = Extract<Awaited<ReturnType<typeof cargarAdestramentos>>, { ok: true }>["datos"];
export default function AdminAdestramentos({
  categoria,
  showConfirm,
}: {
  categoria: "Senior" | "Veteranos";
  showConfirm: (msg: string, fn: () => void) => void;
}) {
  const [datos, setDatos] = useState<Carga | null>(null);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [editor, setEditor] = useState(false);
  const [id, setId] = useState<string>();
  const [fecha, setFecha] = useState(hoyLocal);
  const [hora, setHora] = useState("");
  const [nota, setNota] = useState("");
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const cargar = useCallback(async () => {
    const r = await cargarAdestramentos(categoria).catch(sinConexion);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setDatos(r.datos);
    setError("");
  }, [categoria]);
  useEffect(() => {
    const t = setTimeout(() => void cargar(), 0);
    return () => clearTimeout(t);
  }, [cargar]);
  if (!datos)
    return error ? (
      <ErrorState
        title={error}
        action={<Button onClick={() => void cargar()}>Reintentar</Button>}
      />
    ) : (
      <LoadingState title="Cargando entrenamientos…" />
    );
  function abrir(e?: Carga["entrenamientos"][number]) {
    setId(e?.id);
    setFecha(e?.fecha ?? hoyLocal());
    setHora(e?.hora ?? "");
    setNota(e?.nota ?? "");
    const previas = datos!.marcas.filter((a) => a.asistencia.entrenamientoId === e?.id);
    setMarcas(
      datos!.personas
        .filter(
          (p) =>
            datos!.actuales.includes(p.clave) ||
            previas.some(
              (a) =>
                (a.asistencia.jugadorId
                  ? `jugador:${a.asistencia.jugadorId}`
                  : `staff:${a.asistencia.staffId}`) === p.clave,
            ),
        )
        .map((p) => {
          const anterior = previas.find(
            (a) =>
              (a.asistencia.jugadorId
                ? `jugador:${a.asistencia.jugadorId}`
                : `staff:${a.asistencia.staffId}`) === p.clave,
          )?.asistencia;
          return {
            personaClave: p.clave,
            estado: anterior?.estado ?? "presente",
            justificado: anterior?.justificado ?? false,
            motivo: anterior?.motivo ?? "",
          };
        }),
    );
    setEditor(true);
    setMensaje("");
  }
  function cambiar(clave: string, patch: Partial<Marca>) {
    setMarcas((prev) => prev.map((m) => (m.personaClave === clave ? { ...m, ...patch } : m)));
  }
  const nuevas = marcas.flatMap((m) => {
    const anterior = datos.marcas.find(
      (a) =>
        a.asistencia.entrenamientoId === id &&
        (a.asistencia.jugadorId
          ? `jugador:${a.asistencia.jugadorId}`
          : `staff:${a.asistencia.staffId}`) === m.personaClave,
    );
    if (
      cambioDe(
        anterior?.asistencia,
        m,
        anterior?.asistencia.multaId ? { pagadaEn: anterior.pagadaEn } : undefined,
      ) !== "crear"
    )
      return [];
    const c = datos.conceptos.find((c) => c.activo && c.clave === claveNombre(conceptoDe(m)!));
    return c ? [importeDeMulta(c, 1, m.personaClave.startsWith("staff:"))] : [];
  });
  async function guardar() {
    setOcupado(true);
    const r = await guardarAdestramento({ id, categoria, fecha, hora, nota, marcas }).catch(
      sinConexion,
    );
    if (!r.ok) setError(r.error);
    else {
      setEditor(false);
      setMensaje(["Asistencia guardada.", ...r.datos.avisos].join(" "));
      await cargar();
    }
    setOcupado(false);
  }
  async function borrar(entrenamientoId: string) {
    setOcupado(true);
    const r = await borrarAdestramento(entrenamientoId).catch(sinConexion);
    if (!r.ok) setError(r.error);
    else {
      setMensaje(["Entrenamiento borrado.", ...r.datos.avisos].join(" "));
      await cargar();
    }
    setOcupado(false);
  }
  return (
    <div className={styles.panel}>
      <header>
        <h3>Adestramentos · {categoria}</h3>
        <p>{datos.temporada.nombre} · Asistencia y multas automáticas</p>
      </header>
      {error && <p role="alert">{error}</p>}
      {mensaje && <p role="status">{mensaje}</p>}
      {!editor ? (
        <>
          <Button onClick={() => abrir()}>Crear entrenamiento</Button>
          <ul className={styles.lista} aria-label="Entrenamientos">
            {datos.entrenamientos.map((e) => {
              const filas = datos.marcas.filter((a) => a.asistencia.entrenamientoId === e.id);
              return (
                <li key={e.id} className={styles.fila}>
                  <strong>
                    {FECHA.format(new Date(`${e.fecha}T12:00:00`)).replace(",", "")}
                    {e.hora ? ` · ${e.hora}` : ""}
                  </strong>
                  <p>
                    {cantidad(
                      filas.filter((a) => a.asistencia.estado === "presente").length,
                      "presente",
                    )}{" "}
                    · {filas.filter((a) => a.asistencia.estado === "tarde").length} tarde ·{" "}
                    {cantidad(
                      filas.filter((a) => a.asistencia.estado === "ausente").length,
                      "ausente",
                    )}
                  </p>
                  <Button onClick={() => abrir(e)}>Pasar lista</Button>{" "}
                  <Button
                    disabled={ocupado}
                    onClick={() =>
                      showConfirm(
                        "¿Borrar entrenamiento y sus multas pendientes? Las pagadas se conservan.",
                        () => void borrar(e.id),
                      )
                    }
                  >
                    Borrar
                  </Button>
                </li>
              );
            })}
          </ul>
          {!datos.entrenamientos.length && <p>No hay entrenamientos todavía.</p>}
          <h3>Resumen por persona</h3>
          <p>Porcentaje de asistencia: presentes y tarde sobre entrenamientos registrados.</p>
          <ul className={styles.lista} aria-label="Resumen de asistencia">
            {datos.personas.map((p) => {
              const filas = datos.marcas.filter(
                (a) =>
                  (a.asistencia.jugadorId
                    ? `jugador:${a.asistencia.jugadorId}`
                    : `staff:${a.asistencia.staffId}`) === p.clave,
              );
              const presentes = filas.filter((a) => a.asistencia.estado === "presente").length;
              const tarde = filas.filter((a) => a.asistencia.estado === "tarde").length;
              return (
                <li className={styles.fila} key={p.clave}>
                  <strong>{p.nombre}</strong>
                  <p>
                    {cantidad(filas.length, "entrenamiento")} · {cantidad(presentes, "presente")} ·{" "}
                    {tarde} tarde · {cantidad(filas.length - presentes - tarde, "ausente")} ·{" "}
                    {filas.length ? Math.round(((presentes + tarde) * 100) / filas.length) : 0}%
                  </p>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <form
          aria-label="Pasar lista"
          onSubmit={(e) => {
            e.preventDefault();
            void guardar();
          }}
        >
          <fieldset disabled={ocupado} className={styles.formulario}>
            <Field
              label="Fecha"
              type="date"
              required
              value={fecha}
              disabled={!!id}
              onChange={(e) => setFecha(e.target.value)}
            />
            <Field
              label="Hora"
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
            />
            <Field
              label="Nota del entrenamiento"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
            />
            {marcas.map((m) => (
              <section
                key={m.personaClave}
                className={styles.fila}
                aria-label={datos.personas.find((p) => p.clave === m.personaClave)!.nombre}
              >
                <h4>{datos.personas.find((p) => p.clave === m.personaClave)!.nombre}</h4>
                <div className={styles.botones}>
                  {(
                    [
                      ["presente", "Presente"],
                      ["tarde", "Tarde"],
                      ["ausente", "Falta"],
                    ] as [Estado, string][]
                  ).map(([estado, label]) => (
                    <Button
                      key={estado}
                      type="button"
                      variant={m.estado === estado ? "primary" : "secondary"}
                      data-estado={estado}
                      aria-pressed={m.estado === estado}
                      onClick={() =>
                        m.estado !== estado &&
                        cambiar(m.personaClave, { estado, justificado: false, motivo: "" })
                      }
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                {m.estado !== "presente" && (
                  <>
                    <label className={styles.justificado}>
                      <input
                        type="checkbox"
                        checked={m.justificado}
                        onChange={(e) => cambiar(m.personaClave, { justificado: e.target.checked })}
                      />{" "}
                      Justificado
                    </label>
                    <Field
                      label="Motivo (opcional)"
                      value={m.motivo ?? ""}
                      onChange={(e) => cambiar(m.personaClave, { motivo: e.target.value })}
                    />
                    {!m.justificado &&
                      !datos.conceptos.some(
                        (c) => c.activo && c.clave === claveNombre(conceptoDe(m)!),
                      ) && <p>Concepto ausente o inactivo: se guardará sin multa.</p>}
                  </>
                )}
              </section>
            ))}
            <div className={styles.guardar}>
              <p>
                {nuevas.length} {nuevas.length === 1 ? "multa nueva" : "multas nuevas"} ·{" "}
                {euros(nuevas.reduce((a, b) => a + b, 0))}
              </p>
              <Button type="submit">{ocupado ? "Guardando…" : "Guardar asistencia"}</Button>
              <Button type="button" variant="secondary" onClick={() => setEditor(false)}>
                Cancelar
              </Button>
            </div>
          </fieldset>
        </form>
      )}
    </div>
  );
}
