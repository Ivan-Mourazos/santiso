import { salir } from "@/lib/server/acciones/acceso";

/** Cierra la sesión y vuelve a la pantalla de entrada. */
export async function cerrarSesionYSalir() {
  await salir().catch(() => null);
  // Carga completa a propósito: no debe quedar en memoria nada de lo que ya se había pedido.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign("/entrar");
}
