"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/foundation/Button";
import { Dialog } from "@/components/ui/foundation/Dialog";
import type { PatrocinadorDto } from "@/lib/dto";
import { borrarPatrocinador } from "@/lib/server/acciones/patrocinadores";
import styles from "./Patrocinadores.module.css";

interface Props {
  registro: PatrocinadorDto;
  onCerrar: () => void;
  onBorrado: (registro: PatrocinadorDto) => void;
  /** Desactivar en vez de borrar, cuando solo se quiere quitar del cartel. */
  onDesactivar: (registro: PatrocinadorDto) => void;
}

/** Borrado del catálogo, con su alcance dicho antes de confirmar. */
export default function EliminarPatrocinador({
  registro,
  onCerrar,
  onBorrado,
  onDesactivar,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState(false);
  const borrando = useRef(false);

  async function confirmar() {
    if (borrando.current) return;
    borrando.current = true;
    setPendiente(true);
    setError(null);
    try {
      const resultado = await borrarPatrocinador(registro.id);
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      onBorrado(registro);
    } catch (e) {
      console.error(e);
      setError("No se pudo borrar. Comprueba la conexión e inténtalo de nuevo.");
    } finally {
      borrando.current = false;
      setPendiente(false);
    }
  }

  return (
    <Dialog
      open
      onClose={() => !pendiente && onCerrar()}
      pending={pendiente}
      title={`Eliminar «${registro.nombre}»`}
      footer={
        <>
          <Button variant="secondary" onClick={onCerrar} disabled={pendiente}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={() => void confirmar()}
            pending={pendiente}
            pendingLabel="Eliminando…"
          >
            Eliminar del catálogo
          </Button>
        </>
      }
    >
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <p>
        Se borra la ficha entera: nombre, web y logo. No se puede deshacer.
        {registro.en_carteles &&
          " Está activado para carteles, así que dejará de salir en los que generes a partir de ahora; los que ya has exportado no cambian."}
      </p>
      {registro.en_carteles && (
        <p className={styles.alcance}>
          Si solo quieres que deje de salir en los carteles, desactívalo y la ficha se queda.{" "}
          <Button variant="secondary" disabled={pendiente} onClick={() => onDesactivar(registro)}>
            Quitar del cartel sin borrar
          </Button>
        </p>
      )}
    </Dialog>
  );
}
