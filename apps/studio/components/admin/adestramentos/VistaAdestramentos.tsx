"use client";
import { Fragment, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/foundation/Button";
import { Tabs } from "@/components/ui/foundation/Tabs";
import {
  cuadrante,
  descripcion,
  fechaCorta,
  letra,
  textoTabla,
  textoWhatsapp,
  type Periodo,
  type Orden,
} from "@/lib/adestramentos/asistencia";
import { hoyLocal } from "@/lib/jornada/semana";
import { euros } from "@/lib/multas/modelo";
import type { cargarAdestramentos } from "@/lib/server/acciones/adestramentos";
import styles from "./Adestramentos.module.css";
type Carga = Extract<Awaited<ReturnType<typeof cargarAdestramentos>>, { ok: true }>["datos"];
type Entreno = Carga["entrenamientos"][number];
const FECHA = new Intl.DateTimeFormat("es-ES", {
  weekday: "short",
  day: "numeric",
  month: "numeric",
  year: "numeric",
});
const fechaLocal = (fecha: string) => FECHA.format(new Date(`${fecha}T12:00:00`)).replace(",", "");
function Copiar({ texto, children = "Copiar" }: { texto: string; children?: React.ReactNode }) {
  const [estado, setEstado] = useState<"" | "copiado" | "manual">("");
  async function copiar() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Sin portapapeles");
      await navigator.clipboard.writeText(texto);
      setEstado("copiado");
    } catch {
      setEstado("manual");
    }
  }
  return (
    <div className={styles.copiar}>
      <Button variant="secondary" size="sm" onClick={() => void copiar()}>
        {children}
      </Button>
      {estado === "copiado" && <span role="status">Copiado.</span>}
      {estado === "manual" && (
        <label>
          Copia el texto seleccionado
          <textarea
            aria-label="Texto para copiar"
            readOnly
            value={texto}
            onFocus={(e) => e.currentTarget.select()}
            ref={(e) => {
              if (e) {
                e.focus();
                e.select();
              }
            }}
          />
        </label>
      )}
    </div>
  );
}
export default function VistaAdestramentos({
  datos,
  categoria,
  detalleId,
  onDetalle,
  onCrear,
  onEditar,
  onBorrar,
  ocupado,
}: {
  datos: Carga;
  categoria: string;
  detalleId: string | null;
  onDetalle: (id: string | null) => void;
  onCrear: () => void;
  onEditar: (e: Entreno) => void;
  onBorrar: (id: string) => void;
  ocupado: boolean;
}) {
  const params = useSearchParams();
  const vista = params.get("vista") === "asistencia" ? "asistencia" : "entrenos";
  const [periodo, setPeriodo] = useState<Periodo>("temporada");
  const [orden, setOrden] = useState<Orden>("asistencia");
  const [abierta, setAbierta] = useState<string | null>(null);
  const registros = useMemo(
    () =>
      datos.marcas.map(({ asistencia: a }) => ({
        ...a,
        personaClave: a.jugadorId ? `jugador:${a.jugadorId}` : `staff:${a.staffId}`,
      })),
    [datos.marcas],
  );
  const tabla = useMemo(
    () => cuadrante(datos.entrenamientos, datos.personas, registros, periodo, orden, hoyLocal()),
    [datos, registros, periodo, orden],
  );
  const detalle = datos.entrenamientos.find((e) => e.id === detalleId);
  const nombre = (clave: string) => datos.personas.find((p) => p.clave === clave)?.nombre ?? clave;
  function cambiarVista(value: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("vista", value);
    window.history.replaceState(null, "", url);
  }
  const listado = (
    <>
      <Button onClick={onCrear}>Crear entrenamiento</Button>
      <ul className={styles.lista} aria-label="Entrenamientos">
        {datos.entrenamientos.map((e) => {
          const marcas = datos.marcas.filter((a) => a.asistencia.entrenamientoId === e.id);
          return (
            <li key={e.id} className={styles.entreno}>
              <button className={styles.abrirEntreno} onClick={() => onDetalle(e.id)}>
                <strong>
                  {fechaLocal(e.fecha)}
                  {e.hora ? ` · ${e.hora}` : ""}
                </strong>
                <span>
                  {marcas.filter((a) => a.asistencia.estado === "presente").length} ✓ ·{" "}
                  {marcas.filter((a) => a.asistencia.estado === "tarde").length} T ·{" "}
                  {marcas.filter((a) => a.asistencia.estado === "ausente").length} F ·{" "}
                  {euros(marcas.reduce((s, a) => s + (a.importeCentimos ?? 0), 0))}
                </span>
              </button>
              <Copiar texto={textoWhatsapp(e, categoria, datos.personas, registros)} />
              <span className={styles.chevron} aria-hidden="true">
                ›
              </span>
            </li>
          );
        })}
      </ul>
      {!datos.entrenamientos.length && <p>No hay entrenamientos todavía.</p>}
    </>
  );
  const contenidoDetalle = detalle && (
    <section aria-label="Detalle del entrenamiento" className={styles.detalle}>
      <a
        className={styles.volver}
        href={`?${params.toString()}`}
        onClick={(e) => {
          e.preventDefault();
          onDetalle(null);
        }}
      >
        <span aria-hidden="true">← </span>Volver a entrenos
      </a>
      <h3>
        {fechaLocal(detalle.fecha)} · {categoria}
      </h3>
      {detalle.hora && <p>{detalle.hora}</p>}
      {detalle.nota && <p>{detalle.nota}</p>}
      <div className={styles.controles}>
        <Button variant="secondary" onClick={() => onEditar(detalle)}>
          Editar lista
        </Button>
        <Copiar texto={textoWhatsapp(detalle, categoria, datos.personas, registros)} />
      </div>
      {(
        [
          ["presente", "Presentes"],
          ["tarde", "Tarde"],
          ["ausente", "Faltas"],
        ] as const
      ).map(([estado, titulo]) => {
        const grupo = registros.filter(
          (m) => m.entrenamientoId === detalle.id && m.estado === estado,
        );
        return (
          grupo.length > 0 && (
            <section key={estado}>
              <h4>
                {titulo} ({grupo.length})
              </h4>
              <ul className={styles.lista}>
                {grupo.map((m) => {
                  const a = datos.marcas.find((a) => a.asistencia.id === m.id)!;
                  return (
                    <li key={m.personaClave}>
                      {nombre(m.personaClave)} · {descripcion(m)}
                      {a.importeCentimos !== null ? (
                        <p>
                          {a.multaConcepto} · {euros(a.importeCentimos)} ·{" "}
                          {a.pagadaEn ? "Pagada" : "Pendiente"}
                        </p>
                      ) : (
                        m.estado !== "presente" &&
                        !m.justificado && (
                          <p>Sin multa vinculada · Quitada en Multas o no generada</p>
                        )
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )
        );
      })}
      <div className={styles.peligro}>
        <Button variant="danger" disabled={ocupado} onClick={() => onBorrar(detalle.id)}>
          Borrar
        </Button>
      </div>
    </section>
  );
  const asistencia = (
    <>
      <h3>Cuadrante de asistencia</h3>
      <div className={styles.controles}>
        <label>
          Periodo
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)}>
            <option value="mes">Último mes</option>
            <option value="diez">Últimos 10</option>
            <option value="temporada">Temporada</option>
          </select>
        </label>
        <label>
          Orden
          <select value={orden} onChange={(e) => setOrden(e.target.value as Orden)}>
            <option value="asistencia">Asistencia: de menos a más</option>
            <option value="nombre">Nombre</option>
          </select>
        </label>
        <Copiar texto={textoTabla(tabla)}>Copiar tabla</Copiar>
      </div>
      <div
        className={styles.cuadrante}
        role="region"
        aria-label="Cuadrante desplazable"
        tabIndex={0}
      >
        <table aria-label="Cuadrante de asistencia">
          <thead>
            <tr>
              <th scope="col">Persona</th>
              {tabla.columnas.map((e, i) => (
                <th scope="col" key={e.id} title={e.fecha}>
                  {fechaCorta(e.fecha)}
                  <small>
                    {tabla.totales[i].presentes}/{tabla.totales[i].total}
                  </small>
                </th>
              ))}
              <th scope="col" title="Presentes y tardes sobre entrenamientos en los que figura">
                Asistencia
              </th>
              <th scope="col" title="Tardes y faltas sin justificar">
                Sin just.
              </th>
            </tr>
          </thead>
          <tbody>
            {tabla.filas.map((f) => (
              <Fragment key={f.clave}>
                <tr onClick={() => setAbierta(abierta === f.clave ? null : f.clave)}>
                  <th scope="row">
                    <button
                      title={f.nombre}
                      aria-expanded={abierta === f.clave}
                      onClick={(e) => {
                        e.stopPropagation();
                        setAbierta(abierta === f.clave ? null : f.clave);
                      }}
                    >
                      <span className={styles.nombrePersona}>{f.nombre}</span>
                    </button>
                  </th>
                  {f.celdas.map((m, i) => (
                    <td key={tabla.columnas[i].id}>
                      <span
                        className={styles.marca}
                        data-estado={m?.estado}
                        data-justificado={m?.justificado}
                        title={descripcion(m)}
                        aria-label={descripcion(m)}
                      >
                        {m?.estado === "presente" ? "✓" : letra(m).toUpperCase()}
                      </span>
                    </td>
                  ))}
                  <td>{f.porcentaje === null ? "—" : `${f.porcentaje}%`}</td>
                  <td>
                    {f.tardes} T / {f.faltas} F
                  </td>
                </tr>
                {abierta === f.clave && (
                  <tr>
                    <td colSpan={tabla.columnas.length + 3}>
                      <ul className={styles.motivos}>
                        {f.celdas.flatMap((m, i) =>
                          m?.motivo
                            ? [
                                <li key={tabla.columnas[i].id}>
                                  {fechaCorta(tabla.columnas[i].fecha)} · {descripcion(m)}
                                </li>,
                              ]
                            : [],
                        )}
                      </ul>
                      {!f.celdas.some((m) => m?.motivo) && "Sin motivos registrados."}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p
        className={styles.leyenda}
        title="✓ Presente · T Tarde · F Falta · · Sin marca. Borde punteado: justificado."
      >
        ✓ Pres. · T Tarde · F Falta · · Sin marca · ◌ Just.
      </p>
    </>
  );
  return (
    <Tabs
      label="Vista de entrenamientos"
      variant="segmentado"
      value={vista}
      onValueChange={cambiarVista}
      items={[
        { value: "entrenos", label: "Entrenos", content: detalle ? contenidoDetalle : listado },
        { value: "asistencia", label: "Asistencia", content: asistencia },
      ]}
    />
  );
}
