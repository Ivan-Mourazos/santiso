"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/foundation/Button";
import { Dialog } from "@/components/ui/foundation/Dialog";
import { Field, Select, Textarea } from "@/components/ui/foundation/Fields";
import { useUnsavedChanges } from "@/components/studio/StudioContext";
import type { JugadorDto } from "@/lib/dto";
import { prepararImagen } from "@/lib/imagen-cliente";
import {
  borradorDeJugador,
  erroresJugador,
  ETIQUETAS_POSICION,
  formularioDeJugador,
  hayCambios,
  POSICIONES,
  type BorradorJugador,
} from "@/lib/plantilla/modelo";
import { buscarJugadoresParecidos, guardarJugador } from "@/lib/server/acciones/jugadores";
import type { ParecidoJugador } from "@/lib/server/consultas/jugadores";
import FotoFormulario from "./FotoFormulario";
import styles from "./Plantilla.module.css";

interface Props {
  /** `null` = alta de una persona nueva. */
  jugador: JugadorDto | null;
  destino: { temporadaId: string; temporadaNombre: string; categoria: string };
  /** Dorsales ya ocupados en esta plantilla, para avisar (no impedir) de un repetido. */
  dorsalesOcupados: Map<number, string>;
  onCerrar: () => void;
  onGuardado: (jugador: JugadorDto, alta: boolean) => void;
}

type Errores = Partial<Record<keyof BorradorJugador, string>>;

/**
 * Alta y edición de un jugador en un solo formulario. Se monta con `key` desde el padre: cada
 * apertura empieza de cero, sin efectos que reinicien el estado a destiempo.
 */
export default function EditorJugador({
  jugador,
  destino,
  dorsalesOcupados,
  onCerrar,
  onGuardado,
}: Props) {
  const alta = jugador === null;
  const [inicial] = useState(() => borradorDeJugador(jugador));
  const [borrador, setBorrador] = useState(inicial);
  const [foto, setFoto] = useState<File | null>(null);
  const [errores, setErrores] = useState<Errores>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState(false);
  const [parecidos, setParecidos] = useState<ParecidoJugador[] | null>(null);
  const guardando = useRef(false);
  const nombreRef = useRef<HTMLInputElement>(null);
  const dorsalRef = useRef<HTMLInputElement>(null);

  const sucio = hayCambios(inicial, borrador, foto !== null);
  useUnsavedChanges(sucio);

  const campo =
    <K extends keyof BorradorJugador>(clave: K) =>
    (e: { target: { value: string } }) => {
      setBorrador((b) => ({ ...b, [clave]: e.target.value }));
      setErrores((actuales) => ({ ...actuales, [clave]: undefined }));
      // Cambiar el nombre invalida el aviso de parecidos: hay que volver a buscar.
      if (clave === "nombre") setParecidos(null);
    };

  const dorsalNumero = /^\d+$/.test(borrador.dorsal.trim()) ? Number(borrador.dorsal) : null;
  const ocupadoPor = dorsalNumero !== null ? dorsalesOcupados.get(dorsalNumero) : undefined;
  const avisoDorsal =
    ocupadoPor && ocupadoPor !== jugador?.nombre
      ? `El ${dorsalNumero} ya lo lleva ${ocupadoPor}. Se puede guardar igual.`
      : undefined;

  function cerrar() {
    if (guardando.current) return;
    if (sucio && !window.confirm("Hay cambios sin guardar. ¿Descartarlos?")) return;
    onCerrar();
  }

  async function guardar(aceptandoParecidos = false) {
    if (guardando.current) return;
    const locales = erroresJugador(borrador);
    if (Object.keys(locales).length > 0) {
      setErrores(locales);
      (locales.nombre ? nombreRef : dorsalRef).current?.focus();
      return;
    }

    guardando.current = true;
    setPendiente(true);
    setErrorGeneral(null);
    try {
      // Antes de crear una ficha nueva, comprobar que la persona no existe ya: duplicarla
      // partiría sus goles de cada año entre dos fichas.
      if (alta && !aceptandoParecidos) {
        const encontrados = await buscarJugadoresParecidos(borrador.nombre);
        if (encontrados.length > 0) {
          setParecidos(encontrados);
          return;
        }
      }
      const archivo = foto ? await prepararImagen(foto) : null;
      const resultado = await guardarJugador(formularioDeJugador(borrador, destino, archivo));
      if (!resultado.ok) {
        setErrorGeneral(resultado.error);
        const delServidor: Errores = {};
        for (const clave of ["nombre", "dorsal", "posicion"] as const) {
          if (resultado.campos?.[clave]) delServidor[clave] = resultado.campos[clave];
        }
        setErrores(delServidor);
        return;
      }
      onGuardado(resultado.datos, alta);
    } catch (error) {
      console.error(error);
      setErrorGeneral("No se pudo guardar. Comprueba la conexión; lo que has escrito sigue aquí.");
    } finally {
      guardando.current = false;
      setPendiente(false);
    }
  }

  return (
    <Dialog
      open
      onClose={cerrar}
      pending={pendiente}
      initialFocusRef={nombreRef}
      title={
        alta
          ? `Nuevo jugador · ${destino.categoria} ${destino.temporadaNombre}`
          : `Editar a ${inicial.nombre}`
      }
      footer={
        <>
          <Button variant="secondary" onClick={cerrar} disabled={pendiente}>
            Cancelar
          </Button>
          <Button type="submit" form="editor-jugador" pending={pendiente} pendingLabel="Guardando…">
            {alta ? "Añadir jugador" : "Guardar cambios"}
          </Button>
        </>
      }
    >
      <form
        id="editor-jugador"
        className={styles.editor}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void guardar();
        }}
      >
        {errorGeneral && (
          <p role="alert" className={styles.error}>
            {errorGeneral}
          </p>
        )}

        {parecidos && (
          <div role="alert" className={styles.aviso}>
            <p style={{ margin: 0 }}>
              Ya existe{" "}
              {parecidos
                .map((p) => `«${p.nombre}»${p.ultimaTemporada ? ` (${p.ultimaTemporada})` : ""}`)
                .join(", ")}
              . Si es la misma persona, cancela y tráela con «Añadir de la temporada anterior»: así
              sus goles de todos los años quedan juntos.
            </p>
            <p style={{ margin: "0.75rem 0 0" }}>
              <Button variant="secondary" onClick={() => void guardar(true)} disabled={pendiente}>
                Es otra persona: crear ficha nueva
              </Button>
            </p>
          </div>
        )}

        <fieldset className={styles.grupo} disabled={pendiente}>
          <legend>Persona</legend>
          {!alta && (
            <p className={styles.alcance}>
              Estos datos son los mismos en todas las temporadas en las que haya jugado.
            </p>
          )}
          <Field
            ref={nombreRef}
            label="Nombre completo"
            value={borrador.nombre}
            onChange={campo("nombre")}
            error={errores.nombre}
            autoComplete="off"
            required
          />
          <div className={styles.dosColumnas}>
            <Field
              label="Apodo"
              value={borrador.apodo}
              onChange={campo("apodo")}
              autoComplete="off"
            />
            <Field
              label="Fecha de nacimiento"
              type="date"
              value={borrador.fechaNacimiento}
              onChange={campo("fechaNacimiento")}
            />
          </div>
          <Textarea
            label="Historial deportivo"
            hint="Una línea por temporada, por ejemplo «2022/23: Deportivo B»."
            value={borrador.historial}
            onChange={campo("historial")}
          />
        </fieldset>

        <fieldset className={styles.grupo} disabled={pendiente}>
          <legend>
            {destino.categoria} {destino.temporadaNombre}
          </legend>
          <p className={styles.alcance}>
            Solo cambian en esta temporada; las anteriores no se tocan.
          </p>
          <div className={styles.dosColumnas}>
            <Field
              ref={dorsalRef}
              label="Dorsal"
              inputMode="numeric"
              value={borrador.dorsal}
              onChange={campo("dorsal")}
              error={errores.dorsal}
              hint={errores.dorsal ? undefined : avisoDorsal}
              autoComplete="off"
            />
            <Select
              label="Posición"
              value={borrador.posicion}
              onChange={campo("posicion")}
              error={errores.posicion}
            >
              <option value="">Sin posición</option>
              {POSICIONES.map((p) => (
                <option key={p} value={p}>
                  {p} · {ETIQUETAS_POSICION[p]}
                </option>
              ))}
            </Select>
          </div>
          <FotoFormulario
            actual={jugador?.foto_url ?? null}
            archivo={foto}
            onCambiar={setFoto}
            etiqueta={`Foto de ${destino.temporadaNombre}`}
            deshabilitado={pendiente}
          />
        </fieldset>
      </form>
    </Dialog>
  );
}
