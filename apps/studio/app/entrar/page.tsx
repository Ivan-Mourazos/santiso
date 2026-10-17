import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Entrar } from "@/components/acceso/Entrar";
import { accesoActivo } from "@/lib/acceso/config";
import { usuarioActual } from "@/lib/server/acceso/sesion";
import { hayUsuarios } from "@/lib/server/acceso/usuarios";
import { obtenerDbSinControl } from "@/lib/server/db";
import { barlowUi, nunito } from "@/styles/fonts";
import theme from "@/styles/tokens.module.css";

export const metadata: Metadata = { title: "Entrar · UD Santiso Studio" };
// Depende de la cookie y de si ya hay usuarios: nunca se sirve una copia guardada.
export const dynamic = "force-dynamic";

export default async function PaginaEntrar() {
  if (!accesoActivo() || (await usuarioActual())) redirect("/admin");
  const { db } = await obtenerDbSinControl();
  const primerUso = !(await hayUsuarios(db));
  return (
    <div className={`${theme.theme} ${barlowUi.variable} ${nunito.variable}`}>
      <Entrar primerUso={primerUso} />
    </div>
  );
}
