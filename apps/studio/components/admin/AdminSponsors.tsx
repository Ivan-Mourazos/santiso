"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/foundation/Button";
import { Field, Select } from "@/components/ui/foundation/Fields";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/foundation/States";
import type { PatrocinadorDto } from "@/lib/dto";
import {
  filtrarPatrocinadores,
  formularioDePatrocinador,
  borradorDePatrocinador,
  type FiltroPatrocinadores,
} from "@/lib/patrocinadores/modelo";
import { cargarPatrocinadores, guardarPatrocinador } from "@/lib/server/acciones/patrocinadores";
import EditorPatrocinador from "./patrocinadores/EditorPatrocinador";
import EliminarPatrocinador from "./patrocinadores/EliminarPatrocinador";
import OrdenLogos from "./patrocinadores/OrdenLogos";
import styles from "./patrocinadores/Patrocinadores.module.css";

interface AdminSponsorsProps {
  showToast: (msg: string, type?: "success" | "error") => void;
  showConfirm: (msg: string, onConfirm: () => void) => void;
}

type Dialogo =
  | { tipo: "editar"; clave: number; registro: PatrocinadorDto | null }
  | { tipo: "borrar"; registro: PatrocinadorDto }
  | null;

const FILTROS: { valor: FiltroPatrocinadores; etiqueta: string }[] = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "en-carteles", etiqueta: "En carteles" },
  { valor: "fuera-carteles", etiqueta: "Fuera de carteles" },
  { valor: "sin-logo", etiqueta: "Sin logo" },
];

/**
 * Catálogo único de patrocinadores y logos (6D). La misma lista incluye a quien tiene web y a
 * los logos institucionales que se pintan en el cartel; los separa el interruptor, no dos
 * pantallas distintas.
 */
export default function AdminSponsors({ showToast, showConfirm }: AdminSponsorsProps) {
  const [catalogo, setCatalogo] = useState<PatrocinadorDto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [filtro, setFiltro] = useState<FiltroPatrocinadores>("todos");
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const generacion = useRef(0);

  const recargar = useCallback(async () => {
    const esta = ++generacion.current;
    setCargando(true);
    try {
      const datos = await cargarPatrocinadores();
      if (esta !== generacion.current) return;
      setCatalogo(datos);
      setErrorCarga(null);
    } catch (err) {
      console.error(err);
      if (esta === generacion.current) {
        setErrorCarga("No se pudo cargar el catálogo. Comprueba la conexión e inténtalo de nuevo.");
      }
    } finally {
      if (esta === generacion.current) setCargando(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void recargar(), 0);
    const solicitudes = generacion;
    return () => {
      window.clearTimeout(id);
      solicitudes.current++;
    };
  }, [recargar]);

  const visibles = useMemo(
    () => filtrarPatrocinadores(catalogo, texto, filtro),
    [catalogo, texto, filtro],
  );

  const abrirEditor = (registro: PatrocinadorDto | null) =>
    setDialogo({ tipo: "editar", clave: Date.now(), registro });

  /** Desactivar sin abrir el editor: reenvía la ficha entera con el interruptor apagado. */
  async function desactivar(registro: PatrocinadorDto) {
    const cuerpo = formularioDePatrocinador(
      { ...borradorDePatrocinador(registro), enCarteles: false },
      null,
    );
    const resultado = await guardarPatrocinador(cuerpo);
    if (!resultado.ok) {
      showToast(resultado.error, "error");
      return;
    }
    setDialogo(null);
    showToast(`${registro.nombre} ya no sale en los carteles`);
    void recargar();
  }

  let contenido: React.ReactNode;
  if (errorCarga) {
    contenido = (
      <ErrorState
        title="No se pudo cargar el catálogo"
        detail={errorCarga}
        action={<Button onClick={() => void recargar()}>Reintentar</Button>}
      />
    );
  } else if (cargando && catalogo.length === 0) {
    contenido = <LoadingState title="Cargando patrocinadores…" />;
  } else if (catalogo.length === 0) {
    contenido = (
      <EmptyState
        title="Todavía no hay patrocinadores ni logos."
        detail="Añade aquí tanto a quien patrocina como los logos que se pintan en los carteles."
        action={<Button onClick={() => abrirEditor(null)}>Añadir patrocinador o logo</Button>}
      />
    );
  } else {
    contenido = (
      <>
        <div className={styles.herramientas} role="search" aria-label="Filtrar el catálogo">
          <Field
            label="Buscar"
            type="search"
            placeholder="Nombre"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          <Select
            label="Mostrar"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value as FiltroPatrocinadores)}
          >
            {FILTROS.map((f) => (
              <option key={f.valor} value={f.valor}>
                {f.etiqueta}
              </option>
            ))}
          </Select>
        </div>
        <p className={styles.contador} role="status">
          {visibles.length === catalogo.length
            ? `${catalogo.length} fichas`
            : `${visibles.length} de ${catalogo.length} fichas`}
        </p>

        {visibles.length === 0 ? (
          <EmptyState
            title="Ninguna ficha coincide con la búsqueda."
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setTexto("");
                  setFiltro("todos");
                }}
              >
                Quitar filtros
              </Button>
            }
          />
        ) : (
          <table className={styles.tabla} aria-label="Patrocinadores y logos">
            <thead>
              <tr>
                <th scope="col">Logo</th>
                <th scope="col">Nombre</th>
                <th scope="col">En carteles</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((p) => (
                <tr key={p.id}>
                  <td className={styles.celdaLogo}>
                    {p.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- media local servida por el route handler
                      <img className={styles.logo} src={p.logo_url} alt="" />
                    ) : (
                      <span className={styles.logo} aria-hidden="true" />
                    )}
                  </td>
                  <td className={`${styles.nombre} ${styles.celdaNombre}`}>
                    <strong>{p.nombre}</strong>
                    {p.web_url && (
                      <a href={p.web_url} target="_blank" rel="noreferrer noopener">
                        {p.web_url}
                      </a>
                    )}
                  </td>
                  <td className={styles.celdaEstado}>
                    <span
                      className={`${styles.estado} ${p.en_carteles ? styles.dentro : styles.fuera}`}
                    >
                      {p.en_carteles ? "Sí" : "No"}
                    </span>
                  </td>
                  <td className={styles.celdaAcciones}>
                    <div className={styles.filaAcciones}>
                      <Button
                        variant="secondary"
                        onClick={() => abrirEditor(p)}
                        size="sm"
                        aria-label={`Editar ${p.nombre}`}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => setDialogo({ tipo: "borrar", registro: p })}
                        size="sm"
                        aria-label={`Eliminar ${p.nombre}`}
                      >
                        Eliminar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <OrdenLogos
          catalogo={catalogo}
          onCambiado={() => void recargar()}
          onError={(mensaje) => showToast(mensaje, "error")}
        />
      </>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.cabecera}>
        <div>
          <h3>Patrocinadores y logos</h3>
          <p>
            Una sola lista: quien tiene web se muestra como patrocinador, y el interruptor decide
            quién sale en la barra del cartel.
          </p>
        </div>
        {catalogo.length > 0 && !errorCarga && (
          <Button onClick={() => abrirEditor(null)}>Añadir patrocinador o logo</Button>
        )}
      </div>

      {contenido}

      {dialogo?.tipo === "editar" && (
        <EditorPatrocinador
          key={dialogo.clave}
          registro={dialogo.registro}
          onCerrar={() => setDialogo(null)}
          onGuardado={(fila, alta) => {
            setDialogo(null);
            showToast(alta ? `${fila.nombre} añadido` : "Cambios guardados");
            void recargar();
          }}
          onAbrirExistente={(fila) => abrirEditor(fila)}
        />
      )}

      {dialogo?.tipo === "borrar" && (
        <EliminarPatrocinador
          registro={dialogo.registro}
          onCerrar={() => setDialogo(null)}
          onBorrado={(fila) => {
            setDialogo(null);
            showToast(`${fila.nombre} eliminado del catálogo`);
            void recargar();
          }}
          onDesactivar={(fila) => {
            showConfirm(`¿Quitar a ${fila.nombre} de los carteles, sin borrar su ficha?`, () =>
              desactivar(fila),
            );
          }}
        />
      )}
    </div>
  );
}
