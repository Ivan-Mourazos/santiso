import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION, accesoActivo } from "@/lib/acceso/config";

/**
 * Primera barrera del acceso: quien llega sin cookie de sesión no pasa de `/entrar`.
 * Aquí solo se mira que la cookie exista. Que sea buena lo comprueban `obtenerDb` y cada
 * ruta de `app/api` y `app/media`: las acciones de servidor no son rutas aparte y un cambio de
 * `matcher` no puede dejarlas sin proteger.
 */
export function proxy(request: NextRequest) {
  if (!accesoActivo() || request.cookies.has(COOKIE_SESION)) return NextResponse.next();
  const { pathname } = request.nextUrl;
  if (pathname === "/entrar") return NextResponse.next();
  if (request.method !== "GET" || pathname.startsWith("/api/") || pathname.startsWith("/media/")) {
    return NextResponse.json(
      { error: "Hay que entrar con usuario y contraseña." },
      { status: 401 },
    );
  }
  // Por Tailscale el servidor se ve a sí mismo como 127.0.0.1: la dirección de vuelta se arma
  // con el nombre por el que llegó la petición, no con el suyo.
  const maquina = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const protocolo =
    request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.slice(0, -1);
  return NextResponse.redirect(
    maquina ? `${protocolo}://${maquina}/entrar` : new URL("/entrar", request.url),
  );
}

export const config = {
  // Fuera queda solo lo que la pantalla de entrada necesita para pintarse.
  matcher: [
    "/((?!_next/static|_next/image|logos/|icon.png|apple-icon.png|manifest.webmanifest).*)",
  ],
};
