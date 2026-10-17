import { ViewTransition } from "react";
import { notFound } from "next/navigation";
import { esSeccion, SECCIONES } from "@/lib/navigation/contexto";
import { StudioSection } from "@/components/studio/StudioSection";
export default async function SectionPage({ params }: { params: Promise<{ seccion: string }> }) {
  const { seccion } = await params;
  if (!esSeccion(seccion)) notFound();
  // Entrar en una pantalla desliza hacia la izquierda; volver, al revés; cambiar de pestaña
  // funde. Sin tipo (recargar, datos que llegan) no se anima nada.
  return (
    <ViewTransition
      enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", "nav-tab": "nav-tab", default: "none" }}
      exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", "nav-tab": "nav-tab", default: "none" }}
      default="none"
    >
      <StudioSection section={seccion} />
    </ViewTransition>
  );
}

export const dynamicParams = false;
export function generateStaticParams() {
  return SECCIONES.map((item) => ({ seccion: item.id }));
}
