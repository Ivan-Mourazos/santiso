"use client";

import { useState, type FormEvent } from "react";
import { LARGO_MINIMO_CLAVE } from "@/lib/acceso/largo";
import { crearPrimerAdministrador, entrar } from "@/lib/server/acciones/acceso";
import { Button } from "@/components/ui/foundation/Button";
import { Field } from "@/components/ui/foundation/Fields";
import styles from "./Entrar.module.css";

/** Pantalla de entrada. La primera vez, sin usuarios todavía, crea el administrador. */
export function Entrar({ primerUso }: { primerUso: boolean }) {
  const [usuario, setUsuario] = useState("");
  const [nombre, setNombre] = useState("");
  const [clave, setClave] = useState("");
  const [repetida, setRepetida] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (enviando) return;
    if (primerUso && clave !== repetida) {
      setError("Las dos contraseñas no coinciden.");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const resultado = primerUso
        ? await crearPrimerAdministrador({ usuario, nombre, clave })
        : await entrar(usuario, clave);
      if (!resultado.ok) {
        setError(resultado.error);
        setEnviando(false);
        return;
      }
      // Carga completa a propósito: el panel se monta ya con el usuario dentro.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/admin");
    } catch {
      setError("No se pudo entrar. Comprueba la conexión y vuelve a intentarlo.");
      setEnviando(false);
    }
  }

  return (
    <main className={styles.pagina}>
      <form className={styles.tarjeta} onSubmit={enviar}>
        {/* eslint-disable-next-line @next/next/no-img-element -- icono estático de /public */}
        <img className={styles.logo} src="/logos/app-192.png" alt="" width={72} height={72} />
        <h1>{primerUso ? "Crea el administrador" : "UD Santiso Studio"}</h1>
        <p className={styles.detalle}>
          {primerUso
            ? "Es la primera vez que se entra. Esta cuenta podrá crear las demás."
            : "Entra con tu usuario y tu contraseña."}
        </p>
        {primerUso && (
          <Field
            label="Tu nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            autoComplete="name"
            disabled={enviando}
            required
          />
        )}
        <Field
          label="Usuario"
          hint={primerUso ? "En minúsculas y sin espacios. Por ejemplo: mou" : undefined}
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          disabled={enviando}
          required
        />
        <Field
          label="Contraseña"
          type="password"
          hint={primerUso ? `Al menos ${LARGO_MINIMO_CLAVE} caracteres.` : undefined}
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          autoComplete={primerUso ? "new-password" : "current-password"}
          minLength={primerUso ? LARGO_MINIMO_CLAVE : undefined}
          disabled={enviando}
          required
        />
        {primerUso && (
          <Field
            label="Repite la contraseña"
            type="password"
            value={repetida}
            onChange={(e) => setRepetida(e.target.value)}
            autoComplete="new-password"
            disabled={enviando}
            required
          />
        )}
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <Button type="submit" pending={enviando} pendingLabel="Entrando…">
          {primerUso ? "Crear y entrar" : "Entrar"}
        </Button>
      </form>
    </main>
  );
}
