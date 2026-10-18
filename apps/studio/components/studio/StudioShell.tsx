"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import {
  SECCIONES,
  categoriaDe,
  reservada,
  rutaSeccion,
  seccionesDelMenu,
  type AccesoPanel,
} from "@/lib/navigation/contexto";
import { cerrarSesionYSalir } from "@/components/acceso/salir";
import { TEMPLATES } from "@/components/admin/cartel/types";
import { Button } from "@/components/ui/foundation/Button";
import { Dialog } from "@/components/ui/foundation/Dialog";
import { useStudio } from "./StudioContext";
import styles from "./StudioShell.module.css";
/** Lo del día de partido, a un toque en el móvil; el resto del menú queda en «Más». */
const INICIO = {
  id: "inicio",
  label: "Inicio",
  icono: "M4 11l8-7 8 7M6 10v9a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-9",
} as const;
/** Todo lo de la competición vive bajo «Liga»: partidos, tabla, goleadores y estadísticas. */
const LIGA = {
  id: "partidos",
  label: "Liga",
  icono: "M8 4h8v5a4 4 0 0 1-8 0V4ZM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8",
} as const;
const CARTELES = {
  id: "carteles",
  label: "Carteles",
  icono: "M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1ZM4 16l4.5-4.5 3.5 3.5 3-3 5 5M9 9h.01",
} as const;
const MULTAS = {
  id: "multas",
  label: "Multas",
  icono: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM15 9.5a3.5 3.5 0 1 0 0 5M8 11h5M8 13.5h5",
} as const;
const PESTANAS = [INICIO, LIGA, CARTELES, MULTAS] as const;
/**
 * Las del cuerpo técnico: su día a día es el once y las multas (la convocatoria se abre desde el
 * partido, en Inicio). Los carteles los lleva el delegado; a ellos les quedan en «Más».
 */
const PESTANAS_TECNICO = [
  INICIO,
  LIGA,
  {
    id: "alineacion",
    label: "Once",
    icono: "M4 5h16v14H4ZM12 5v14M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM4 9h2.5v6H4M20 9h-2.5v6H20",
  },
  MULTAS,
] as const;
const TITULO_TEMA: Record<string, string> = {
  fichaje: "Fichaje",
  formal: "Comunicado",
  medico: "Parte médico",
  celebracion: "Celebración",
  despedida: "Despedida",
};
const ICONO_MAS = "M5 12h.01M12 12h.01M19 12h.01";
/** Las pantallas de la competición: con ellas encendida la pestaña «Liga» y su subnavegación. */
const SECCIONES_LIGA: readonly string[] = [
  "partidos",
  "jornada",
  "calendario",
  "clasificacion",
  "liga",
  "estadisticas",
  "federacion",
];
const SUBNAV_LIGA = [
  { id: "partidos", label: "Partidos" },
  { id: "clasificacion", label: "Clasificación" },
  { id: "liga", label: "Goleadores" },
  { id: "estadisticas", label: "Estadísticas" },
] as const;

/** Marca de sesión: la app ya arrancó en esta pestaña. */
const ARRANQUE = "santiso_arrancada";

function Icono({ trazo }: { trazo: string }) {
  return (
    <svg
      aria-hidden="true"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={trazo} />
    </svg>
  );
}

export function StudioShell({
  children,
  acceso = null,
}: {
  children: ReactNode;
  acceso?: AccesoPanel;
}) {
  const pathname = usePathname();
  const { params, navigate, setParams } = useStudio();
  const section = SECCIONES.find((item) => pathname === `/admin/${item.id}`);
  // Un icono instalado antes de existir «Inicio» guardó «Jornada» como entrada y el teléfono no
  // la actualiza: si la app arranca desde el icono y cae ahí, se lleva a la portada. Solo en el
  // arranque (una vez por sesión), no al ir a Jornada a propósito.
  const seccionActual = section?.id;
  useEffect(() => {
    let arrancada = true;
    try {
      arrancada = sessionStorage.getItem(ARRANQUE) === "1";
      sessionStorage.setItem(ARRANQUE, "1");
    } catch {
      // Sin almacenamiento de sesión no se puede saber si es el arranque: no se redirige.
    }
    const instalada =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (!arrancada && instalada && seccionActual === "jornada" && !window.location.search) {
      window.location.replace("/admin/inicio");
    }
    // Solo al montar: después, ir a Jornada es una decisión de quien usa la app.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const secciones = seccionesDelMenu(acceso);
  const sinPermiso = !!section && reservada(section.id, acceso);
  const pestanas = acceso?.rol === "tecnico" ? PESTANAS_TECNICO : PESTANAS;
  const [mas, setMas] = useState(false);
  // La pestaña encendida: la propia sección o, en la competición, «Liga».
  const pestanaActiva = SECCIONES_LIGA.includes(section?.id ?? "")
    ? LIGA.id
    : pestanas.some((p) => p.id === section?.id)
      ? section?.id
      : "mas";
  const subnavLiga = SUBNAV_LIGA.some((item) => item.id === section?.id);
  const plantilla =
    section?.id === "carteles"
      ? (TEMPLATES.find((t) => t.id === params.get("plantilla")) ?? null)
      : null;
  // El anuncio abierto desde el catálogo se titula por lo que es, no «Anuncio».
  const tituloCartel =
    plantilla?.id === "multiusos"
      ? (TITULO_TEMA[params.get("tema") ?? ""] ?? plantilla.label)
      : plantilla?.label;
  const category = categoriaDe(params);
  const categories = ["Senior", "Veteranos"];
  const showCategory = [
    "partidos",
    "calendario",
    "clasificacion",
    "liga",
    "estadisticas",
    "jugadores",
    "tecnicos",
    "equipos",
    "federacion",
  ].some((id) => id === section?.id);
  function navigation(alElegir?: () => void) {
    return (
      <nav aria-label="Navegación principal" className={styles.nav}>
        {[...new Set(secciones.map((item) => item.grupo))].map((group) => (
          <section key={group}>
            <h2 className={styles.group}>{group}</h2>
            {secciones.filter((item) => item.grupo === group).map((item) => (
              <Link
                key={item.id}
                href={rutaSeccion(item.id, params)}
                aria-current={item.id === section?.id ? "page" : undefined}
                className={styles.link}
                onNavigate={(event) => {
                  event.preventDefault();
                  alElegir?.();
                  if (item.id !== section?.id) navigate(rutaSeccion(item.id, params));
                }}
              >
                {item.label}
              </Link>
            ))}
          </section>
        ))}
      </nav>
    );
  }
  return (
    <div className={styles.shell}>
      <a className={styles.skip} href="#contenido">
        Saltar al contenido
      </a>
      <aside className={styles.sidebar}>
        <Link
          className={styles.brand}
          href={rutaSeccion("inicio", params)}
          onNavigate={(e) => {
            e.preventDefault();
            if (section?.id !== "inicio") navigate(rutaSeccion("inicio", params));
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- icono estático de /public */}
          <img className={styles.logo} src="/logos/app-192.png" alt="" width={40} height={40} />
          <span>UD SANTISO</span>
          <strong>Studio</strong>
        </Link>
        {navigation()}
        {acceso && (
          <div className={styles.cuenta}>
            <span>{acceso.nombre}</span>
            <button type="button" onClick={() => void cerrarSesionYSalir()}>
              Salir
            </button>
          </div>
        )}
      </aside>
      <div className={styles.main}>
        <header className={styles.header}>
          <div className={styles.heading}>
            {section?.id !== "inicio" && (
              <button
                type="button"
                className={styles.atras}
                aria-label="Atrás"
                onClick={() => {
                  if (window.history.length > 1) window.history.back();
                  else navigate(rutaSeccion("inicio", new URLSearchParams()), "nav-back");
                }}
              >
                <Icono trazo="M15 5l-7 7 7 7" />
              </button>
            )}
            <div>
              <p className={styles.eyebrow}>{section?.grupo ?? "Studio"}</p>
              {/* En Carteles, el nombre del cartel abierto; el catálogo es «Carteles». */}
              <h1>{tituloCartel ?? section?.label ?? "Panel"}</h1>
            </div>
          </div>
          {showCategory && (
            <div role="group" aria-label="Categoría deportiva" className={styles.categories}>
              {categories.map((value) => (
                <Button
                  key={value}
                  size="sm"
                  variant="ghost"
                  aria-pressed={category === value}
                  onClick={() => setParams({ categoria: value })}
                >
                  {value}
                </Button>
              ))}
            </div>
          )}
        </header>
        <main id="contenido" tabIndex={-1} className={styles.content}>
          {sinPermiso ? (
            <p role="status" className={styles.aviso}>
              Esta sección es solo para el administrador.
            </p>
          ) : (
            <>
              {subnavLiga && (
                <nav aria-label="Liga" className={styles.subnav}>
                  {SUBNAV_LIGA.map((item) => (
                    <Link
                      key={item.id}
                      href={rutaSeccion(item.id, params)}
                      aria-current={item.id === section?.id ? "page" : undefined}
                      onNavigate={(event) => {
                        event.preventDefault();
                        if (item.id !== section?.id)
                          navigate(rutaSeccion(item.id, params), "nav-tab");
                      }}
                    >
                      {item.label}
                    </Link>
                  ))}
                </nav>
              )}
              {children}
            </>
          )}
        </main>
        <nav
          aria-label="Accesos rápidos"
          className={styles.tabs}
          style={{ "--pestanas": pestanas.length + 1 } as CSSProperties}
        >
          {pestanas.map((pestana) => (
            <Link
              key={pestana.id}
              href={rutaSeccion(pestana.id, params)}
              aria-current={pestana.id === section?.id ? "page" : undefined}
              data-activa={pestana.id === pestanaActiva}
              className={styles.tab}
              onNavigate={(event) => {
                event.preventDefault();
                if (pestana.id !== section?.id) navigate(rutaSeccion(pestana.id, params), "nav-tab");
              }}
            >
              <Icono trazo={pestana.icono} />
              {pestana.label}
            </Link>
          ))}
          <button
            type="button"
            className={styles.tab}
            data-activa={pestanaActiva === "mas"}
            aria-haspopup="dialog"
            onClick={() => setMas(true)}
          >
            <Icono trazo={ICONO_MAS} />
            Más
          </button>
        </nav>
        <Dialog
          open={mas}
          onClose={() => setMas(false)}
          title="Todo el Studio"
          closeLabel="Cerrar menú"
          mobilePresentation="sheet"
        >
          {/* Solo montado mientras está abierta: si no, el menú y el nombre salen dos veces. */}
          {mas && (
          <div className={styles.menuMas}>
            {navigation(() => setMas(false))}
            {acceso && (
              <div className={styles.cuenta}>
                <span>{acceso.nombre}</span>
                <button type="button" onClick={() => void cerrarSesionYSalir()}>
                  Salir
                </button>
              </div>
            )}
          </div>
          )}
        </Dialog>
      </div>
    </div>
  );
}
