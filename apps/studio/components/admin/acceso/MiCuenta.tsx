"use client";

import { useState, type FormEvent } from "react";
import { LARGO_MINIMO_CLAVE } from "@/lib/acceso/largo";
import { cambiarMiClave } from "@/lib/server/acciones/acceso";
import { cerrarSesionYSalir } from "@/components/acceso/salir";
import { useUnsavedChanges } from "@/components/studio/StudioContext";
import { Button } from "@/components/ui/foundation/Button";
import { Field } from "@/components/ui/foundation/Fields";
import styles from "./Acceso.module.css";

/** La contraseña propia y el cierre de sesión. */
export default function MiCuenta({
  showToast,
}: {
  showToast: (msg: string, type?: "success" | "error") => void;
}) {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  useUnsavedChanges(actual !== "" || nueva !== "" || repetida !== "");

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    if (guardando) return;
    if (nueva !== repetida) {
      setError("Las dos contraseñas nuevas no coinciden.");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const resultado = await cambiarMiClave(actual, nueva);
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      setActual("");
      setNueva("");
      setRepetida("");
      showToast("Contraseña cambiada");
    } catch {
      setError("No se pudo cambiar la contraseña. Vuelve a intentarlo.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className={styles.layout}>
      <section className={styles.tarjeta} aria-labelledby="cuenta-clave">
        <h2 id="cuenta-clave">Cambiar mi contraseña</h2>
        <form onSubmit={guardar} className={styles.formulario}>
          <Field
            label="Contraseña actual"
            type="password"
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            autoComplete="current-password"
            disabled={guardando}
            required
          />
          <Field
            label="Contraseña nueva"
            type="password"
            hint={`Al menos ${LARGO_MINIMO_CLAVE} caracteres.`}
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            autoComplete="new-password"
            minLength={LARGO_MINIMO_CLAVE}
            disabled={guardando}
            required
          />
          <Field
            label="Repite la contraseña nueva"
            type="password"
            value={repetida}
            onChange={(e) => setRepetida(e.target.value)}
            autoComplete="new-password"
            disabled={guardando}
            required
          />
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
          <Button type="submit" pending={guardando}>
            Guardar contraseña
          </Button>
        </form>
      </section>
      <section className={styles.tarjeta} aria-labelledby="cuenta-salir">
        <h2 id="cuenta-salir">Cerrar sesión</h2>
        <p className={styles.detalle}>
          En este dispositivo. Para volver a entrar harán falta el usuario y la contraseña.
        </p>
        <Button
          variant="secondary"
          pending={saliendo}
          pendingLabel="Saliendo…"
          onClick={() => {
            setSaliendo(true);
            void cerrarSesionYSalir();
          }}
        >
          Salir
        </Button>
      </section>
    </div>
  );
}
