/** Fallos seguidos que se toleran antes de hacer esperar. */
export const MAX_FALLOS = 5;
/** Lo que hay que esperar después, y la ventana en la que cuentan los fallos. */
export const ESPERA_MS = 15 * 60_000;

interface Registro {
  fallos: number;
  ultimo: number;
}

/**
 * Freno a quien prueba contraseñas: tras `MAX_FALLOS` fallos seguidos con un usuario, ese
 * usuario no puede intentarlo durante `ESPERA_MS`. Vive en memoria: reiniciar el servidor lo
 * borra, que para una herramienta de dos personas es suficiente.
 */
export function crearFreno() {
  const registros = new Map<string, Registro>();
  const vigente = (clave: string, ahora: number) => {
    const registro = registros.get(clave);
    if (registro && ahora - registro.ultimo >= ESPERA_MS) {
      registros.delete(clave);
      return undefined;
    }
    return registro;
  };
  return {
    /** Milisegundos que faltan para poder intentarlo; 0 si se puede ya. */
    espera(clave: string, ahora = Date.now()): number {
      const registro = vigente(clave, ahora);
      if (!registro || registro.fallos < MAX_FALLOS) return 0;
      return ESPERA_MS - (ahora - registro.ultimo);
    },
    fallo(clave: string, ahora = Date.now()): void {
      const registro = vigente(clave, ahora);
      registros.set(clave, { fallos: (registro?.fallos ?? 0) + 1, ultimo: ahora });
    },
    acierto(clave: string): void {
      registros.delete(clave);
    },
  };
}
