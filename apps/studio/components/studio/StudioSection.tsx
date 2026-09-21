"use client";
import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";
import type { Seccion } from "@/lib/navigation/contexto";
import { categoriaDe } from "@/lib/navigation/contexto";
import { TEMPLATES } from "@/components/admin/cartel/types";
import { LoadingState } from "@/components/ui/foundation/States";
import { Select } from "@/components/ui/foundation/Fields";
import { useStudio } from "./StudioContext";
import styles from "./StudioShell.module.css";
const loading = () => <LoadingState title="Cargando sección…" />;
const Calendar = dynamic(() => import("@/components/admin/AdminJornadas"), { loading });
const League = dynamic(() => import("@/components/admin/AdminLeague"), { loading });
const Players = dynamic(() => import("@/components/admin/AdminPlayers"), { loading });
const Staff = dynamic(() => import("@/components/admin/AdminStaff"), { loading });
const Teams = dynamic(() => import("@/components/admin/AdminEquipos"), { loading });
const Sponsors = dynamic(() => import("@/components/admin/AdminSponsors"), { loading });
const Seasons = dynamic(() => import("@/components/admin/AdminTemporadas"), { loading });
const Posters = dynamic(() => import("@/components/admin/GeneradorCartel"), { loading });
const Acta = dynamic(() => import("@/components/admin/AdminActaImporter"), { loading });
const Batch = dynamic(() => import("@/components/admin/AdminActaBatch"), { loading });
const Matchday = dynamic(() => import("@/components/admin/AdminJornadaImporter"), { loading });
const CalendarPdf = dynamic(() => import("@/components/admin/AdminCalendarioPdf"), { loading });
const Assets = dynamic(() => import("@/components/admin/AdminCartelAssets"), { loading });
const Shield = dynamic(() => import("@/components/admin/AdminShield"), { loading });
const subscribeHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export function StudioSection({ section }: { section: Seccion }) {
  const { params, setParams, showToast, showConfirm } = useStudio();
  const hydrated = useSyncExternalStore(subscribeHydration, clientReady, serverReady);
  const category = categoriaDe(params);
  const feedback = { showToast, showConfirm };
  const contextual =
    section === "calendario" || section === "clasificacion" || section === "equipos";
  const key = contextual
    ? `${section}:${category}:${params.get("temporada") ?? ""}:${params.get("competicion") ?? ""}`
    : `${section}:${category}`;
  const template = TEMPLATES.find((t) => t.id === params.get("plantilla"))?.id ?? "partido";
  if (!hydrated) return <LoadingState title="Preparando sección…" />;
  return (
    <div key={key} className={styles.panel}>
      {section === "calendario" && <Calendar {...feedback} categoria={category} />}
      {section === "clasificacion" && <League {...feedback} categoria={category} />}
      {section === "jugadores" && <Players {...feedback} categoria={category} />}
      {section === "tecnicos" && <Staff {...feedback} tipo="Tecnico" categoria={category} />}
      {section === "directiva" && <Staff {...feedback} tipo="Directiva" />}
      {section === "equipos" && <Teams {...feedback} categoria={category} />}
      {section === "patrocinadores" && <Sponsors {...feedback} />}
      {section === "temporadas" && <Seasons {...feedback} />}
      {section === "carteles" && (
        <Posters
          templateId={template}
          onTemplateChange={(value) => setParams({ plantilla: value })}
          hideLayout
        />
      )}
      {section === "actas" && (
        <>
          <div className={styles.modes}>
            <Select
              label="Modo de importación de actas"
              value={params.get("modoActas") === "lote" ? "lote" : "individual"}
              onChange={(e) => setParams({ modoActas: e.target.value })}
            >
              <option value="individual">Individual</option>
              <option value="lote">Lote</option>
            </Select>
          </div>
          {params.get("modoActas") === "lote" ? (
            <Batch showToast={showToast} />
          ) : (
            <Acta {...feedback} />
          )}
        </>
      )}
      {section === "importar-jornada" && (
        <>
          <div className={styles.modes}>
            <Select
              label="Origen de la jornada"
              value={params.get("origen") === "calendario" ? "calendario" : "foto"}
              onChange={(e) => setParams({ origen: e.target.value })}
            >
              <option value="foto">Foto de jornada</option>
              <option value="calendario">Calendario PDF</option>
            </Select>
          </div>
          {params.get("origen") === "calendario" ? (
            <CalendarPdf {...feedback} />
          ) : (
            <Matchday {...feedback} />
          )}
        </>
      )}
      {section === "ajustes-graficos" && (
        <>
          <Shield {...feedback} />
          <Assets {...feedback} />
        </>
      )}
    </div>
  );
}
