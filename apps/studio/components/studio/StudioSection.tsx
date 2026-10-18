"use client";
import dynamic from "next/dynamic";
import { useSyncExternalStore, ViewTransition, type ReactNode } from "react";
import type { Seccion } from "@/lib/navigation/contexto";
import { categoriaDe } from "@/lib/navigation/contexto";
import { TEMPLATES } from "@/components/admin/cartel/types";
import { LoadingState } from "@/components/ui/foundation/States";
import { Select } from "@/components/ui/foundation/Fields";
import { useStudio } from "./StudioContext";
import styles from "./StudioShell.module.css";
const loading = () => <LoadingState title="Cargando sección…" />;
const Home = dynamic(() => import("@/components/admin/inicio/AdminInicio"), { loading });
const Week = dynamic(() => import("@/components/admin/jornada/AdminJornada"), { loading });
const Matches = dynamic(() => import("@/components/admin/liga/AdminPartidos"), { loading });
const Calendar = dynamic(() => import("@/components/admin/calendario/AdminCalendario"), {
  loading,
});
const League = dynamic(() => import("@/components/admin/clasificacion/AdminClasificacion"), {
  loading,
});
const Players = dynamic(() => import("@/components/admin/AdminPlayers"), { loading });
const Staff = dynamic(() => import("@/components/admin/AdminStaff"), { loading });
const Teams = dynamic(() => import("@/components/admin/AdminEquipos"), { loading });
const Sponsors = dynamic(() => import("@/components/admin/AdminSponsors"), { loading });
const Seasons = dynamic(() => import("@/components/admin/AdminTemporadas"), { loading });
const Lineup = dynamic(() => import("@/components/admin/alineacion/AdminAlineacion"), {
  loading,
});
const Callup = dynamic(() => import("@/components/admin/convocatoria/AdminConvocatoria"), {
  loading,
});
const Fines = dynamic(() => import("@/components/admin/multas/AdminMultas"), { loading });
const Federation = dynamic(() => import("@/components/admin/federacion/AdminFederacion"), {
  loading,
});
const Posters = dynamic(() => import("@/components/admin/GeneradorCartel"), { loading });
const PosterCatalog = dynamic(() => import("@/components/admin/cartel/CatalogoCarteles"), {
  loading,
});
const Acta = dynamic(() => import("@/components/admin/AdminActaImporter"), { loading });
const Batch = dynamic(() => import("@/components/admin/AdminActaBatch"), { loading });
const Import = dynamic(() => import("@/components/admin/importar/Importar"), { loading });
const Matchday = dynamic(() => import("@/components/admin/importar/ImportarFoto"), { loading });
const CalendarPdf = dynamic(() => import("@/components/admin/importar/ImportarCalendarioPdf"), {
  loading,
});
const Graphics = dynamic(() => import("@/components/admin/ajustes/AjustesGraficos"), { loading });
const Stats = dynamic(() => import("@/components/admin/estadisticas/AdminEstadisticas"), {
  loading,
});
const LeagueTables = dynamic(() => import("@/components/admin/liga/AdminLiga"), { loading });
const Users = dynamic(() => import("@/components/admin/acceso/AdminUsuarios"), { loading });
const Account = dynamic(() => import("@/components/admin/acceso/MiCuenta"), { loading });
const subscribeHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export function StudioSection({ section }: { section: Seccion }) {
  const { params, setParams, showToast, showConfirm } = useStudio();
  const hydrated = useSyncExternalStore(subscribeHydration, clientReady, serverReady);
  const category = categoriaDe(params);
  const feedback = { showToast, showConfirm };
  // Partidos tampoco: sigue la competición elegida por su cuenta, y remontarla al fijarse la
  // competición en la URL la cargaba dos veces al entrar.
  // Equipos no entra: carga el catálogo una vez y filtra en memoria por la competición elegida.
  // Remontarla al cambiar de competición no aporta nada y abre una carrera: un diálogo abierto
  // justo después de cambiar se montaba en la instancia vieja y desaparecía con ella.
  const contextual =
    section === "calendario" ||
    section === "clasificacion" ||
    section === "liga";
  // Plantilla y staff son por temporada: cambiar de temporada tiene que volver a montarlos.
  const squad = section === "jugadores" || section === "tecnicos" || section === "directiva";
  const key = contextual
    ? `${section}:${category}:${params.get("temporada") ?? ""}:${params.get("competicion") ?? ""}`
    : squad
      ? `${section}:${category}:${params.get("temporada") ?? ""}`
      : `${section}:${category}`;
  // Sin plantilla elegida, Carteles enseña el catálogo.
  const template = TEMPLATES.find((t) => t.id === params.get("plantilla"))?.id ?? null;
  if (!hydrated) return <LoadingState title="Preparando sección…" />;
  return (
    <div key={key} className={styles.panel}>
      {section === "inicio" && <Home />}
      {section === "jornada" && <Week />}
      {section === "partidos" && <Matches categoria={category} />}
      {section === "calendario" && <Calendar {...feedback} categoria={category} />}
      {section === "clasificacion" && <League categoria={category} />}
      {section === "liga" && <LeagueTables showToast={showToast} categoria={category} />}
      {section === "estadisticas" && <Stats showToast={showToast} categoria={category} />}
      {section === "jugadores" && <Players {...feedback} categoria={category} />}
      {section === "tecnicos" && <Staff {...feedback} tipo="Tecnico" categoria={category} />}
      {section === "directiva" && <Staff {...feedback} tipo="Directiva" />}
      {section === "equipos" && <Teams {...feedback} categoria={category} />}
      {section === "patrocinadores" && <Sponsors {...feedback} />}
      {section === "temporadas" && <Seasons {...feedback} />}
      {/* Solo el Senior convoca y alinea: Veteranos no prepara el partido así. */}
      {section === "convocatoria" && (
        <Callup categoria="Senior" partidoInicial={params.get("partido")} showToast={showToast} />
      )}
      {section === "alineacion" && (
        <Lineup categoria="Senior" partidoInicial={params.get("partido")} showToast={showToast} />
      )}
      {section === "multas" && <Fines {...feedback} />}
      {section === "federacion" && <Federation showToast={showToast} categoria={category} />}
      {section === "carteles" && !template && (
        <PantallaDentro>
          <PosterCatalog />
        </PantallaDentro>
      )}
      {section === "carteles" && template && (
        <PantallaDentro>
          <Posters
            templateId={template}
            temaInicial={params.get("tema")}
            partidoInicial={params.get("partido")}
            rellenarProximos={params.get("rellenar") === "1"}
            showToast={showToast}
          />
        </PantallaDentro>
      )}
      {section === "importar" && (
        <Import
          {...feedback}
          inicial={{ categoria: params.get("categoria"), competicionId: params.get("competicion") }}
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
            <Acta
              {...feedback}
              inicial={{
                categoria: params.get("categoria"),
                competicionId: params.get("competicion"),
                partidoId: params.get("partido"),
              }}
            />
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
            <Matchday
              {...feedback}
              inicial={{
                categoria: params.get("categoria"),
                competicionId: params.get("competicion"),
                jornadaId: params.get("jornada"),
              }}
            />
          )}
        </>
      )}
      {section === "ajustes-graficos" && <Graphics showToast={showToast} />}
      {section === "usuarios" && <Users {...feedback} />}
      {section === "cuenta" && <Account showToast={showToast} />}
    </div>
  );
}

const TIPOS_PANTALLA = {
  "nav-forward": "nav-forward",
  "nav-back": "nav-back",
  "nav-tab": "nav-tab",
  default: "none",
};

/**
 * Pantalla que cambia sin cambiar de ruta (del catálogo de carteles a un cartel): se desliza
 * como las demás al entrar y al volver.
 */
function PantallaDentro({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter={TIPOS_PANTALLA} exit={TIPOS_PANTALLA} default="none">
      {children}
    </ViewTransition>
  );
}
