"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type CSSProperties, type ReactNode } from "react";
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
import { Select } from "@/components/ui/foundation/Fields";
import { useStudio } from "./StudioContext";
import styles from "./StudioShell.module.css";
/** Lo del día de partido, a un toque en el móvil; el resto del menú queda en «Más». */
const INICIO = {
  id: "inicio",
  label: "Inicio",
  icono: "M4 11l8-7 8 7M6 10v9a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-9",
} as const;
const PESTANAS = [
  INICIO,
  {
    id: "jornada",
    label: "Jornada",
    icono: "M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z",
  },
  {
    id: "carteles",
    label: "Carteles",
    icono: "M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1ZM4 16l4.5-4.5 3.5 3.5 3-3 5 5M9 9h.01",
  },
  // Resultados y actas llegan solos de la federación: «Importar» ya no es de todos los días
  // y queda en «Más». Las multas sí lo son.
  {
    id: "multas",
    label: "Multas",
    icono: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM15 9.5a3.5 3.5 0 1 0 0 5M8 11h5M8 13.5h5",
  },
] as const;

/**
 * Las del cuerpo técnico: su día a día es convocar, hacer el once y poner multas. Los carteles
 * los lleva el delegado; a él le quedan en «Más».
 */
const PESTANAS_TECNICO = [
  INICIO,
  PESTANAS[1],
  {
    id: "convocatoria",
    label: "Convocar",
    icono: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 19a6 6 0 0 1 12 0M17 8v6M14 11h6",
  },
  {
    id: "alineacion",
    label: "Once",
    icono: "M4 5h16v14H4ZM12 5v14M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM4 9h2.5v6H4M20 9h-2.5v6H20",
  },
  PESTANAS[3],
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
  const category = categoriaDe(params);
  const categories = ["Senior", "Veteranos"];
  const showCategory = [
    "calendario",
    "clasificacion",
    "liga",
    "estadisticas",
    "jugadores",
    "tecnicos",
    "equipos",
  ].some((id) => id === section?.id);
  function navigation() {
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
                  else navigate(rutaSeccion("inicio", new URLSearchParams()));
                }}
              >
                <Icono trazo="M15 5l-7 7 7 7" />
              </button>
            )}
            <div>
              <p className={styles.eyebrow}>{section?.grupo ?? "Studio"}</p>
              <h1>{section?.label ?? "Panel"}</h1>
            </div>
          </div>
          {showCategory && (
            <div role="group" aria-label="Categoría deportiva" className={styles.categories}>
              {categories.map((value) => (
                <Button
                  key={value}
                  size="sm"
                  variant={category === value ? "primary" : "secondary"}
                  aria-pressed={category === value}
                  onClick={() => setParams({ categoria: value })}
                >
                  {value}
                </Button>
              ))}
            </div>
          )}
          {section?.id === "carteles" && (
            <div className={styles.template}>
              <Select
                label="Plantilla de cartel"
                value={
                  TEMPLATES.some((t) => t.id === params.get("plantilla"))
                    ? (params.get("plantilla") ?? "partido")
                    : "partido"
                }
                onChange={(e) => setParams({ plantilla: e.target.value })}
              >
                {TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </header>
        <main id="contenido" tabIndex={-1} className={styles.content}>
          {sinPermiso ? (
            <p role="status" className={styles.aviso}>
              Esta sección es solo para el administrador.
            </p>
          ) : (
            children
          )}
        </main>
        <nav
          aria-label="Accesos rápidos"
          className={styles.tabs}
          style={{ "--pestanas": pestanas.length } as CSSProperties}
        >
          {pestanas.map((pestana) => (
            <Link
              key={pestana.id}
              href={rutaSeccion(pestana.id, params)}
              aria-current={pestana.id === section?.id ? "page" : undefined}
              className={styles.tab}
              onNavigate={(event) => {
                event.preventDefault();
                if (pestana.id !== section?.id) navigate(rutaSeccion(pestana.id, params));
              }}
            >
              <Icono trazo={pestana.icono} />
              {pestana.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
