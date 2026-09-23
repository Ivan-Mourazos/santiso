"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/foundation/Button";
import { ErrorState, LoadingState } from "@/components/ui/foundation/States";
import type { AjustesCartelDto } from "@/lib/dto";
import { LOGOS_EN_CARTEL } from "@/lib/patrocinadores/modelo";
import { cargarAjustesCartel, guardarOrdenLogos } from "@/lib/server/acciones/ajustes-cartel";
import ImagenAjuste from "./ImagenAjuste";
import styles from "./Ajustes.module.css";

interface Props {
  showToast: (msg: string, type?: "success" | "error") => void;
}

const ORDENES = [
  { valor: "xunta_izquierda", etiqueta: "Xunta a la izquierda" },
  { valor: "rfgf_izquierda", etiqueta: "RFGF a la izquierda" },
] as const;

/**
 * Las imágenes fijas de los carteles: escudo del club, los dos logos de la cabecera y su orden,
 * y la barra de patrocinadores, que aquí solo se enseña: se gestiona en su catálogo.
 *
 * Una sola carga para todo. Antes eran dos componentes que pedían lo mismo por separado.
 */
export default function AjustesGraficos({ showToast }: Props) {
  const [ajustes, setAjustes] = useState<AjustesCartelDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cambiandoOrden, setCambiandoOrden] = useState(false);
  const generacion = useRef(0);

  const cargar = useCallback(async () => {
    const esta = ++generacion.current;
    try {
      const resultado = await cargarAjustesCartel();
      if (esta !== generacion.current) return;
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      setAjustes(resultado.datos);
      setError(null);
    } catch (e) {
      console.error(e);
      if (esta === generacion.current) setError("No se pudieron cargar los ajustes gráficos.");
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void cargar(), 0);
    const solicitudes = generacion;
    return () => {
      window.clearTimeout(id);
      solicitudes.current++;
    };
  }, [cargar]);

  async function cambiarOrden(orden: string) {
    if (!ajustes || orden === ajustes.ordenLogos || cambiandoOrden) return;
    setCambiandoOrden(true);
    try {
      const resultado = await guardarOrdenLogos(orden);
      if (!resultado.ok) {
        showToast(resultado.error, "error");
        return;
      }
      setAjustes({ ...ajustes, ordenLogos: orden });
      showToast("Orden de la cabecera guardado");
    } catch (e) {
      console.error(e);
      showToast("No se pudo guardar el orden. Comprueba la conexión.", "error");
    } finally {
      setCambiandoOrden(false);
    }
  }

  const guardada =
    (campo: "escudoClub" | "logoXunta" | "logoRfgf", titulo: string) => (url: string) => {
      setAjustes((actual) => (actual ? { ...actual, [campo]: url } : actual));
      showToast(`${titulo} guardado`);
    };
  const fallo = (mensaje: string) => showToast(mensaje, "error");

  if (error) {
    return (
      <div className={styles.panel}>
        <ErrorState
          title="No se pudieron cargar los ajustes gráficos"
          detail={error}
          action={<Button onClick={() => void cargar()}>Reintentar</Button>}
        />
      </div>
    );
  }
  if (!ajustes) {
    return (
      <div className={styles.panel}>
        <LoadingState title="Cargando ajustes gráficos…" />
      </div>
    );
  }

  const barra = ajustes.patrocinadores.slice(0, LOGOS_EN_CARTEL);
  const sobran = ajustes.patrocinadores.length - barra.length;

  return (
    <div className={styles.panel}>
      <div className={styles.cabecera}>
        <h3>Ajustes gráficos</h3>
        <p>
          Las imágenes fijas de los carteles. Lo que cambies aquí sale en los carteles que generes a
          partir de ahora; los ya descargados no cambian.
        </p>
      </div>

      <section className={styles.bloque} aria-labelledby="ajustes-club">
        <h4 id="ajustes-club" className={styles.titulo}>
          Club
        </h4>
        <ImagenAjuste
          clave="club.escudo"
          titulo="Escudo del club"
          descripcion="Sale en los carteles, en el lado del Santiso."
          actual={ajustes.escudoClub}
          onGuardada={guardada("escudoClub", "Escudo del club")}
          onError={fallo}
        />
      </section>

      <section className={styles.bloque} aria-labelledby="ajustes-cabecera">
        <h4 id="ajustes-cabecera" className={styles.titulo}>
          Cabecera del cartel
        </h4>
        <div className={styles.pareja}>
          <ImagenAjuste
            clave="cartel.logo_xunta"
            titulo="Xunta de Galicia"
            descripcion="Esquina superior del cartel."
            actual={ajustes.logoXunta}
            onGuardada={guardada("logoXunta", "Logo de la Xunta")}
            onError={fallo}
          />
          <ImagenAjuste
            clave="cartel.logo_rfgf"
            titulo="RFGF"
            descripcion="Esquina superior del cartel."
            actual={ajustes.logoRfgf}
            onGuardada={guardada("logoRfgf", "Logo de la RFGF")}
            onError={fallo}
          />
        </div>
        <div className={styles.orden} role="group" aria-label="Qué logo va a la izquierda">
          <span className={styles.etiqueta}>Qué logo va a la izquierda</span>
          <div className={styles.interruptores}>
            {ORDENES.map((o) => {
              const activo =
                o.valor === "rfgf_izquierda"
                  ? ajustes.ordenLogos === "rfgf_izquierda"
                  : ajustes.ordenLogos !== "rfgf_izquierda";
              return (
                <Button
                  key={o.valor}
                  variant={activo ? "primary" : "secondary"}
                  aria-pressed={activo}
                  disabled={cambiandoOrden}
                  onClick={() => void cambiarOrden(o.valor)}
                >
                  {o.etiqueta}
                </Button>
              );
            })}
          </div>
        </div>
      </section>

      <section className={styles.bloque} aria-labelledby="ajustes-barra">
        <h4 id="ajustes-barra" className={styles.titulo}>
          Barra de patrocinadores
        </h4>
        <p className={styles.nota}>
          Se eligen y se ordenan en <Link href="/admin/patrocinadores">Patrocinadores y logos</Link>
          . Aquí se ve cómo queda: caben {LOGOS_EN_CARTEL}.
        </p>
        {barra.length === 0 ? (
          <p className={styles.nota}>Ningún logo activado todavía.</p>
        ) : (
          <ol className={styles.barra} aria-label="Logos de la barra, en orden">
            {barra.map((p) => (
              <li key={p.id}>
                {p.logo_url && (
                  // eslint-disable-next-line @next/next/no-img-element -- media local servida por el route handler
                  <img src={p.logo_url} alt="" />
                )}
                <span>{p.nombre}</span>
              </li>
            ))}
          </ol>
        )}
        {sobran > 0 && (
          <p role="status" className={styles.aviso}>
            {sobran === 1
              ? "Hay 1 logo activado de más: no cabe en el cartel."
              : `Hay ${sobran} logos activados de más: no caben en el cartel.`}
          </p>
        )}
      </section>
    </div>
  );
}
