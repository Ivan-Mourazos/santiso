"use client";

/* eslint-disable @next/next/no-img-element -- media local servida por el route handler */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/foundation/Button";
import { Dialog } from "@/components/ui/foundation/Dialog";
import type { FotoPartidoDto } from "@/lib/dto";
import {
  cambiarFocoFoto,
  listarFotosPartido,
  quitarFotoPartido,
  subirFotosPartido,
} from "@/lib/server/acciones/fotos-partido";
import styles from "./GaleriaPartido.module.css";

interface Props {
  partidoId: string;
  /** «U.D. Santiso F.C. – S.D. Touro»: para el título del diálogo. */
  partido: string;
  onCerrar: () => void;
  showToast: (msg: string, type?: "success" | "error") => void;
  /** Con esto el diálogo sirve para elegir la foto de un cartel. */
  onElegir?: (foto: FotoPartidoDto) => void;
}

/**
 * Galería de fotos de un partido: subir varias de golpe, marcar el foco de cada una (un clic
 * sobre la foto; el cartel recorta alrededor de ese punto) y quitarlas. Desde Carteles sirve
 * además para elegir la foto de fondo.
 */
export default function GaleriaPartido({
  partidoId,
  partido,
  onCerrar,
  showToast,
  onElegir,
}: Props) {
  const [fotos, setFotos] = useState<FotoPartidoDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [enfocando, setEnfocando] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const ocupada = subiendo || guardando;

  useEffect(() => {
    let vigente = true;
    void listarFotosPartido(partidoId).then((r) => {
      if (!vigente) return;
      if (r.ok) setFotos(r.datos);
      else setError(r.error);
    });
    return () => {
      vigente = false;
    };
  }, [partidoId]);

  async function subir(ficheros: FileList | null) {
    if (!ficheros || ficheros.length === 0) return;
    const formulario = new FormData();
    for (const fichero of Array.from(ficheros)) formulario.append("fotos", fichero);
    setSubiendo(true);
    try {
      const r = await subirFotosPartido(partidoId, formulario);
      if (!r.ok) return showToast(r.error, "error");
      setError(null);
      setFotos((antes) => [...(antes ?? []), ...r.datos.fotos]);
      const n = r.datos.fotos.length;
      showToast(
        `${n} ${n === 1 ? "foto subida" : "fotos subidas"}` +
          (r.datos.descartadas ? ` · ${r.datos.descartadas} no eran imágenes válidas` : ""),
      );
    } catch {
      showToast("No se pudieron subir las fotos. Revisa el tamaño (15 MB como mucho).", "error");
    } finally {
      setSubiendo(false);
    }
  }

  async function enfocar(foto: FotoPartidoDto, evento: React.MouseEvent<HTMLButtonElement>) {
    const caja = evento.currentTarget.getBoundingClientRect();
    // El clic sintetizado por un toque trae coordenadas; Enter/Espacio marca el centro.
    const x =
      evento.detail === 0
        ? 0.5
        : Math.min(1, Math.max(0, (evento.clientX - caja.left) / caja.width));
    const y =
      evento.detail === 0
        ? 0.5
        : Math.min(1, Math.max(0, (evento.clientY - caja.top) / caja.height));
    setGuardando(true);
    try {
      const r = await cambiarFocoFoto(foto.id, x, y);
      if (!r.ok) return showToast(r.error, "error");
      setFotos((antes) =>
        (antes ?? []).map((f) => (f.id === foto.id ? { ...f, foco_x: x, foco_y: y } : f)),
      );
      setEnfocando(null);
    } catch {
      showToast("No se pudo guardar el encuadre. Vuelve a intentarlo.", "error");
    } finally {
      setGuardando(false);
    }
  }

  async function quitar(foto: FotoPartidoDto) {
    const r = await quitarFotoPartido(foto.id);
    if (!r.ok) return showToast(r.error, "error");
    setFotos((antes) => (antes ?? []).filter((f) => f.id !== foto.id));
  }

  return (
    <Dialog
      open
      onClose={onCerrar}
      title="Fotos del partido"
      description={partido}
      closeLabel="Cerrar"
    >
      <div className={styles.galeria}>
        <div className={styles.barra}>
          <label className={styles.subir} aria-disabled={ocupada}>
            {subiendo ? "Subiendo…" : "Subir fotos"}
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={ocupada}
              onChange={(e) => {
                void subir(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          <label className={`${styles.subir} ${styles.camara}`} aria-disabled={ocupada}>
            Tomar foto
            <input
              type="file"
              accept="image/*"
              capture="environment"
              disabled={ocupada}
              onChange={(e) => {
                void subir(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          <p className={styles.nota}>
            Originales, no las de WhatsApp. Para cambiar el encuadre pulsa «Encuadre» y haz clic en
            lo importante de la foto. En móvil, toca ese punto.
          </p>
        </div>

        {error ? (
          <p className={styles.nota}>{error}</p>
        ) : fotos === null ? (
          <p className={styles.nota}>Cargando fotos…</p>
        ) : fotos.length === 0 ? (
          <p className={styles.nota}>Este partido todavía no tiene fotos.</p>
        ) : (
          <ul className={styles.rejilla} aria-label="Fotos del partido">
            {fotos.map((foto, i) => (
              <li key={foto.id} className={styles.foto} data-enfocando={enfocando === foto.id}>
                <div className={styles.marco}>
                  <img src={`${foto.url}?ancho=480`} alt={`Foto ${i + 1}`} />
                  {enfocando === foto.id && (
                    <button
                      type="button"
                      className={styles.marcar}
                      aria-label={`Marcar encuadre de foto ${i + 1}`}
                      disabled={guardando}
                      aria-busy={guardando || undefined}
                      onClick={(e) => void enfocar(foto, e)}
                    />
                  )}
                  <span
                    className={styles.foco}
                    data-foco
                    style={{ left: `${foto.foco_x * 100}%`, top: `${foto.foco_y * 100}%` }}
                    aria-hidden
                  />
                </div>
                <div className={styles.acciones}>
                  {onElegir && (
                    <Button size="sm" disabled={ocupada} onClick={() => onElegir(foto)}>
                      Usar en el cartel
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    aria-pressed={enfocando === foto.id}
                    disabled={ocupada}
                    onClick={() => setEnfocando(enfocando === foto.id ? null : foto.id)}
                  >
                    {enfocando === foto.id ? "Haz clic en la foto" : "Encuadre"}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    aria-label={`Quitar foto ${i + 1}`}
                    disabled={ocupada}
                    onClick={() => void quitar(foto)}
                  >
                    Quitar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  );
}
