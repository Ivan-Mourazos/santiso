import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { StudioProvider } from "@/components/studio/StudioContext";
import { StudioShell } from "@/components/studio/StudioShell";
import { LoadingState } from "@/components/ui/foundation/States";
import { accesoActivo } from "@/lib/acceso/config";
import type { AccesoPanel } from "@/lib/navigation/contexto";
import { usuarioActual } from "@/lib/server/acceso/sesion";
import { manrope, marcador } from "@/styles/fonts";
import theme from "@/styles/tokens.module.css";

/** Quién entra al panel. Con el acceso apagado, nadie en concreto. */
async function accesoDelPanel(): Promise<AccesoPanel> {
  if (!accesoActivo()) return null;
  const usuario = await usuarioActual();
  // Cookie caducada o usuario sin acceso: `proxy.ts` solo mira que la cookie exista.
  if (!usuario) redirect("/entrar");
  return { nombre: usuario.nombre, rol: usuario.rol };
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const acceso = await accesoDelPanel();
  return (
    <div className={`${theme.theme} ${marcador.variable} ${manrope.variable}`}>
      <Suspense fallback={<LoadingState title="Abriendo Studio…" />}>
        <StudioProvider acceso={acceso}>
          <StudioShell acceso={acceso}>{children}</StudioShell>
        </StudioProvider>
      </Suspense>
    </div>
  );
}
