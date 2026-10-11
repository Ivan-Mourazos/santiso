"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/foundation/Button";
import { Field } from "@/components/ui/foundation/Fields";
import { LoadingState } from "@/components/ui/foundation/States";
import { MAX_CAPTURAS, elegirArchivosDeActa } from "@/lib/actas/capturas";
import { tipoDeCapturas, type DeteccionCapturas, type TipoImportacion } from "@/lib/importar/tipo";
import styles from "./Importar.module.css";

const cargando = () => <LoadingState title="Cargando…" />;
const Acta = dynamic(() => import("@/components/admin/AdminActaImporter"), { loading: cargando });
const Jornada = dynamic(() => import("./ImportarFoto"), { loading: cargando });

interface Props {
  showToast: (msg: string, type?: "success" | "error") => void;
  showConfirm: (msg: string, onConfirm: () => void) => void;
  inicial: { categoria?: string | null; competicionId?: string | null };
}

const NOMBRE: Record<TipoImportacion, string> = {
  acta: "el acta de un partido",
  jornada: "los partidos de una jornada",
};

/**
 * Una sola entrada para meter datos desde capturas. Se suben y la app decide si son el acta
 * de un partido o la lista de una jornada; si se equivoca, se corrige con un toque.
 */
export default function Importar({ showToast, showConfirm, inicial }: Props) {
  const [archivos, setArchivos] = useState<File[]>([]);
  const [tipo, setTipo] = useState<TipoImportacion | null>(null);
  const [deteccion, setDeteccion] = useState<DeteccionCapturas | null>(null);
  /** No se pudo decidir: se pregunta. */
  const [duda, setDuda] = useState(false);
  const [ocupada, setOcupada] = useState(false);

  async function elegir(elegidos: File[]) {
    const { archivos: validos, aviso } = elegirArchivosDeActa(elegidos);
    if (aviso) showToast(aviso, "error");
    if (validos.length === 0) return;
    setArchivos(validos);
    setDeteccion(null);
    setDuda(false);
    // La ficha federativa en PDF siempre es un acta y se lee en local: no hace falta preguntar.
    if (validos[0]?.type === "application/pdf") return setTipo("acta");
    setOcupada(true);
    try {
      const cuerpo = new FormData();
      for (const archivo of validos) cuerpo.append("image", archivo);
      const respuesta = await fetch("/api/admin/acta-detect", { method: "POST", body: cuerpo });
      const leido = respuesta.ok ? ((await respuesta.json()) as DeteccionCapturas) : null;
      const decidido = leido ? tipoDeCapturas(leido) : null;
      if (decidido) {
        setDeteccion(leido);
        setTipo(decidido);
      } else {
        setDuda(true);
      }
    } catch {
      setDuda(true);
    } finally {
      setOcupada(false);
    }
  }

  function empezarDeNuevo() {
    setArchivos([]);
    setTipo(null);
    setDeteccion(null);
    setDuda(false);
  }

  if (tipo) {
    const otro: TipoImportacion = tipo === "acta" ? "jornada" : "acta";
    return (
      <div className={styles.unificado}>
        <div className={styles.decision} role="status">
          <span>
            {archivos.length > 0 ? "Leído como " : "Vas a meter "}
            <strong>{NOMBRE[tipo]}</strong>.
          </span>
          <div className={styles.accion}>
            {archivos.length > 0 && (
              <Button size="sm" variant="secondary" onClick={() => setTipo(otro)}>
                No, es {NOMBRE[otro]}
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={empezarDeNuevo}>
              Empezar de nuevo
            </Button>
          </div>
        </div>
        {tipo === "acta" ? (
          <Acta
            key={`acta-${archivos.length}`}
            showToast={showToast}
            showConfirm={showConfirm}
            inicial={{ categoria: inicial.categoria, competicionId: inicial.competicionId }}
            archivosIniciales={archivos}
            deteccionInicial={deteccion}
          />
        ) : (
          <Jornada
            key={`jornada-${archivos.length}`}
            showToast={showToast}
            showConfirm={showConfirm}
            inicial={{ categoria: inicial.categoria, competicionId: inicial.competicionId }}
            archivosIniciales={archivos}
          />
        )}
      </div>
    );
  }

  return (
    <div className={`${styles.panel} ${styles.unificado}`}>
      <div
        className={styles.dropzone}
        data-con-archivo={archivos.length > 0}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void elegir(Array.from(e.dataTransfer.files ?? []));
        }}
      >
        <Field
          id="importar-file-input"
          label="Capturas para importar"
          hint={`El acta de un partido o la lista de una jornada, en hasta ${MAX_CAPTURAS} capturas. También vale la ficha en PDF.`}
          type="file"
          multiple
          accept="image/*,application/pdf"
          onChange={(e) => void elegir(Array.from(e.target.files ?? []))}
          disabled={ocupada}
        />
      </div>

      {ocupada && <LoadingState title="Mirando qué son las capturas…" />}

      {duda && (
        <div className={styles.decision} role="alert">
          <span>No he sabido decidir qué son. ¿Qué has subido?</span>
          <div className={styles.accion}>
            <Button onClick={() => setTipo("acta")}>El acta de un partido</Button>
            <Button onClick={() => setTipo("jornada")}>Los partidos de una jornada</Button>
          </div>
        </div>
      )}

      <div className={styles.otros}>
        <p className={styles.titulo}>Sin capturas</p>
        <div className={styles.accion}>
          <Button variant="secondary" onClick={() => setTipo("acta")}>
            Acta a mano o corregir una guardada
          </Button>
        </div>
        <p className={`${styles.nota} ${styles.soloEscritorio}`}>
          En el ordenador: <Link href="/admin/actas?modoActas=lote">varias actas de una vez</Link> ·{" "}
          <Link href="/admin/importar-jornada?origen=calendario">calendario completo en PDF</Link>
        </p>
      </div>
    </div>
  );
}
