"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { LARGO_MINIMO_CLAVE } from "@/lib/acceso/largo";
import {
  cargarUsuarios,
  crearUsuarioNuevo,
  darAcceso,
  ponerClave,
} from "@/lib/server/acciones/acceso";
import type { UsuarioDto } from "@/lib/server/acceso/usuarios";
import { useUnsavedChanges } from "@/components/studio/StudioContext";
import { Button } from "@/components/ui/foundation/Button";
import { Dialog } from "@/components/ui/foundation/Dialog";
import { Field, Select } from "@/components/ui/foundation/Fields";
import { ErrorState, LoadingState } from "@/components/ui/foundation/States";
import styles from "./Acceso.module.css";

interface Props {
  showToast: (msg: string, type?: "success" | "error") => void;
  showConfirm: (msg: string, onConfirm: () => void | Promise<void>) => void;
}

const ROLES = { admin: "Administrador", tecnico: "Cuerpo técnico" } as const;
const VACIO = { nombre: "", usuario: "", clave: "", rol: "tecnico" as keyof typeof ROLES };

/** Quién puede entrar al Studio. Solo la ve el administrador. */
export default function AdminUsuarios({ showToast, showConfirm }: Props) {
  const [usuarios, setUsuarios] = useState<UsuarioDto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState(VACIO);
  const [errorAlta, setErrorAlta] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [conClave, setConClave] = useState<UsuarioDto | null>(null);
  const [claveNueva, setClaveNueva] = useState("");
  const [errorClave, setErrorClave] = useState<string | null>(null);
  const enCurso = useRef(false);
  useUnsavedChanges(nuevo.nombre !== "" || nuevo.usuario !== "" || nuevo.clave !== "");

  const cargar = useCallback(async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      const resultado = await cargarUsuarios();
      if (resultado.ok) setUsuarios(resultado.datos);
      else setErrorCarga(resultado.error);
    } catch {
      setErrorCarga("No se pudieron cargar los usuarios.");
    } finally {
      setCargando(false);
    }
  }, []);
  useEffect(() => {
    void cargar();
  }, [cargar]);

  /** Una operación cada vez; devuelve `false` si falló. */
  async function hacer(
    marca: string,
    operacion: () => Promise<{ ok: true } | { ok: false; error: string }>,
    alFallar: (mensaje: string) => void,
  ): Promise<boolean> {
    if (enCurso.current) return false;
    enCurso.current = true;
    setOcupado(marca);
    try {
      const resultado = await operacion();
      if (!resultado.ok) alFallar(resultado.error);
      return resultado.ok;
    } catch {
      alFallar("No se pudo guardar. Vuelve a intentarlo.");
      return false;
    } finally {
      enCurso.current = false;
      setOcupado(null);
    }
  }

  async function crear(evento: FormEvent) {
    evento.preventDefault();
    setErrorAlta(null);
    const hecho = await hacer("alta", () => crearUsuarioNuevo(nuevo), setErrorAlta);
    if (!hecho) return;
    setNuevo(VACIO);
    showToast("Usuario creado");
    await cargar();
  }

  async function cambiarAcceso(usuario: UsuarioDto, activo: boolean) {
    const hecho = await hacer(
      usuario.id,
      () => darAcceso(usuario.id, activo),
      (mensaje) => showToast(mensaje, "error"),
    );
    if (!hecho) return;
    showToast(activo ? "Acceso devuelto" : "Acceso quitado");
    await cargar();
  }

  async function guardarClave(evento: FormEvent) {
    evento.preventDefault();
    if (!conClave) return;
    setErrorClave(null);
    const hecho = await hacer("clave", () => ponerClave(conClave.id, claveNueva), setErrorClave);
    if (!hecho) return;
    setConClave(null);
    setClaveNueva("");
    showToast("Contraseña cambiada");
  }

  return (
    <div className={styles.layout}>
      <section aria-labelledby="usuarios-listado">
        <h2 id="usuarios-listado">Quién puede entrar</h2>
        <p className={styles.detalle}>
          El cuerpo técnico usa el día a día (convocatoria, alineación, multas, actas, carteles).
          Temporadas, competiciones, ajustes y usuarios quedan para el administrador.
        </p>
        {cargando ? (
          <LoadingState title="Cargando usuarios…" />
        ) : errorCarga ? (
          <ErrorState
            title={errorCarga}
            action={
              <Button variant="secondary" onClick={() => void cargar()}>
                Reintentar
              </Button>
            }
          />
        ) : (
          <ul className={styles.lista}>
            {usuarios.map((usuario) => (
              <li key={usuario.id} className={styles.fila} data-inactivo={!usuario.activo}>
                <div className={styles.quien}>
                  <strong>{usuario.nombre}</strong>
                  <span>
                    {usuario.usuario} · {ROLES[usuario.rol]}
                    {!usuario.activo && " · sin acceso"}
                  </span>
                </div>
                <div className={styles.acciones}>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={ocupado !== null}
                    aria-label={`Cambiar la contraseña de ${usuario.nombre}`}
                    onClick={() => {
                      setErrorClave(null);
                      setClaveNueva("");
                      setConClave(usuario);
                    }}
                  >
                    Contraseña
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={ocupado !== null}
                    pending={ocupado === usuario.id}
                    aria-label={`${usuario.activo ? "Quitar" : "Devolver"} el acceso a ${usuario.nombre}`}
                    onClick={() =>
                      usuario.activo
                        ? showConfirm(
                            `${usuario.nombre} dejará de poder entrar y se cerrará su sesión. Sus datos no se borran y puedes devolverle el acceso cuando quieras.`,
                            () => cambiarAcceso(usuario, false),
                          )
                        : void cambiarAcceso(usuario, true)
                    }
                  >
                    {usuario.activo ? "Quitar acceso" : "Devolver acceso"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className={styles.tarjeta} aria-labelledby="usuarios-alta">
        <h2 id="usuarios-alta">Nuevo usuario</h2>
        <form onSubmit={crear} className={styles.formulario}>
          <Field
            label="Nombre"
            value={nuevo.nombre}
            onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
            disabled={ocupado !== null}
            required
          />
          <Field
            label="Usuario"
            hint="En minúsculas y sin espacios. Por ejemplo: dani"
            value={nuevo.usuario}
            onChange={(e) => setNuevo({ ...nuevo, usuario: e.target.value })}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="off"
            disabled={ocupado !== null}
            required
          />
          <Field
            label="Contraseña inicial"
            hint={`Al menos ${LARGO_MINIMO_CLAVE} caracteres. Pásasela tú; luego puede cambiarla en «Mi cuenta».`}
            value={nuevo.clave}
            onChange={(e) => setNuevo({ ...nuevo, clave: e.target.value })}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            minLength={LARGO_MINIMO_CLAVE}
            disabled={ocupado !== null}
            required
          />
          <Select
            label="Tipo"
            value={nuevo.rol}
            onChange={(e) => setNuevo({ ...nuevo, rol: e.target.value as keyof typeof ROLES })}
            disabled={ocupado !== null}
          >
            <option value="tecnico">{ROLES.tecnico}</option>
            <option value="admin">{ROLES.admin}</option>
          </Select>
          {errorAlta && (
            <p role="alert" className={styles.error}>
              {errorAlta}
            </p>
          )}
          <Button type="submit" pending={ocupado === "alta"} pendingLabel="Creando…">
            Crear usuario
          </Button>
        </form>
      </section>
      <Dialog
        open={conClave !== null}
        onClose={() => setConClave(null)}
        title={`Contraseña de ${conClave?.nombre ?? ""}`}
        mobilePresentation="sheet"
      >
        <form onSubmit={guardarClave} className={styles.formulario}>
          <Field
            label="Contraseña nueva"
            hint={`Al menos ${LARGO_MINIMO_CLAVE} caracteres. Se cerrarán sus sesiones abiertas.`}
            value={claveNueva}
            onChange={(e) => setClaveNueva(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            minLength={LARGO_MINIMO_CLAVE}
            required
          />
          {errorClave && (
            <p role="alert" className={styles.error}>
              {errorClave}
            </p>
          )}
          <Button type="submit" pending={ocupado === "clave"}>
            Guardar contraseña
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
