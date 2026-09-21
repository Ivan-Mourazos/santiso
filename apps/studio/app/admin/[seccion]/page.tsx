import { notFound } from "next/navigation";
import { esSeccion, SECCIONES } from "@/lib/navigation/contexto";
import { StudioSection } from "@/components/studio/StudioSection";
export default async function SectionPage({ params }: { params: Promise<{ seccion: string }> }) {
  const { seccion } = await params;
  if (!esSeccion(seccion)) notFound();
  return <StudioSection section={seccion} />;
}

export const dynamicParams = false;
export function generateStaticParams() {
  return SECCIONES.map((item) => ({ seccion: item.id }));
}
