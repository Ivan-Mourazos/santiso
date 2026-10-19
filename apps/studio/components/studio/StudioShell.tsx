"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  SECCIONES,
  cambiarParametros,
  categoriaDe,
  reservada,
  rutaSeccion,
  seccionesDelMenu,
  type AccesoPanel,
  type Seccion,
} from "@/lib/navigation/contexto";
import {
  gruposVisibles,
  MENU,
  pestanaDe,
  pestanasVisibles,
  type EntradaMenu,
  type IdPestana,
} from "@/lib/navigation/menu";
import { cerrarSesionYSalir } from "@/components/acceso/salir";
import { TEMPLATES } from "@/components/admin/cartel/types";
import { Button } from "@/components/ui/foundation/Button";
import { Dialog } from "@/components/ui/foundation/Dialog";
import { useStudio } from "./StudioContext";
import { TarjetasMenu } from "./TarjetasMenu";
import styles from "./StudioShell.module.css";
const TITULO_TEMA: Record<string, string> = {
  fichaje: "Fichaje",
  formal: "Comunicado",
  medico: "Parte médico",
  celebracion: "Celebración",
  despedida: "Despedida",
};
/** Las pantallas de la competición con la subnavegación de «Liga» encima. */
const SUBNAV_LIGA = [
  { id: "partidos", label: "Partidos" },
  { id: "clasificacion", label: "Clasificación" },
  { id: "liga", label: "Goleadores" },
  { id: "estadisticas", label: "Estadísticas" },
  { id: "archivo", label: "Archivo" },
] as const;
/** Lo que la barra de Liga lleva de una pantalla a otra: el contexto, no lo propio de cada una. */
const CONTEXTO_LIGA = ["categoria", "temporada", "competicion"];

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
  const visibles = new Set<Seccion>(seccionesDelMenu(acceso).map((item) => item.id));
  const tecnico = acceso?.rol === "tecnico";
  const pestanas = pestanasVisibles(visibles, tecnico);
  const sinPermiso = !!section && reservada(section.id, acceso);
  // La hoja abierta: la de la pestaña tocada, o ninguna.
  const [hoja, setHoja] = useState<IdPestana | null>(null);
  const pestanaActiva = pestanaDe(section?.id);
  // Solo en sus propias pantallas: en una ficha no quedaría ninguna marcada.
  const subnavLiga = SUBNAV_LIGA.some((item) => item.id === section?.id);
  const contextoLiga = new URLSearchParams(
    [...params].filter(([clave]) => CONTEXTO_LIGA.includes(clave)),
  );
  // A 360 px la pestaña marcada puede quedar fuera: se desplaza hasta verla.
  const subnavRef = useRef<HTMLElement>(null);
  useEffect(() => {
    subnavRef.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [section?.id]);
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
    "archivo",
  ].some((id) => id === section?.id);
  /** Dirección de una entrada: conserva la categoría y cambia solo lo suyo (la plantilla). */
  function rutaEntrada(entrada: EntradaMenu) {
    return rutaSeccion(
      entrada.seccion,
      cambiarParametros(params, {
        plantilla: entrada.extra?.plantilla ?? null,
        tema: entrada.extra?.tema ?? null,
        partido: null,
      }),
    );
  }
  function esActual(entrada: EntradaMenu) {
    if (entrada.seccion !== section?.id) return false;
    return !entrada.extra?.plantilla || entrada.extra.plantilla === params.get("plantilla");
  }
  function ir(entrada: EntradaMenu, alElegir?: () => void) {
    alElegir?.();
    if (!esActual(entrada)) navigate(rutaEntrada(entrada), "nav-tab");
  }
  /** Lateral de escritorio: las mismas pestañas y entradas que la barra del móvil. */
  function navigation() {
    return (
      <nav aria-label="Navegación principal" className={styles.nav}>
        <Link
          href={rutaSeccion("inicio", params)}
          aria-current={section?.id === "inicio" ? "page" : undefined}
          className={styles.link}
          onNavigate={(event) => {
            event.preventDefault();
            if (section?.id !== "inicio") navigate(rutaSeccion("inicio", params));
          }}
        >
          Inicio
        </Link>
        {pestanas
          .filter((p) => p.grupos)
          .map((pestana) => (
            <section key={pestana.id}>
              <h2 className={styles.group}>{pestana.label}</h2>
              {gruposVisibles(pestana, visibles, tecnico).flatMap((g) =>
                g.entradas.map((entrada) => (
                  <Link
                    key={`${entrada.seccion}-${entrada.label}`}
                    href={rutaEntrada(entrada)}
                    aria-current={esActual(entrada) ? "page" : undefined}
                    className={styles.link}
                    onNavigate={(event) => {
                      event.preventDefault();
                      ir(entrada);
                    }}
                  >
                    {entrada.label}
                  </Link>
                )),
              )}
            </section>
          ))}
      </nav>
    );
  }
  const abierta = pestanas.find((p) => p.id === hoja);
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
              {/* El antetítulo es la pestaña del menú donde vive la pantalla; en Inicio no se
                  repite el título encima del título. */}
              {(() => {
                const pestana = MENU.find((p) => p.id === pestanaActiva)?.label;
                return pestana && pestana !== section?.label ? (
                  <p className={styles.eyebrow}>{pestana}</p>
                ) : null;
              })()}
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
                <nav aria-label="Liga" className={styles.subnav} ref={subnavRef}>
                  {SUBNAV_LIGA.map((item) => (
                    <Link
                      key={item.id}
                      href={rutaSeccion(item.id, contextoLiga)}
                      aria-current={item.id === section?.id ? "page" : undefined}
                      onNavigate={(event) => {
                        event.preventDefault();
                        if (item.id !== section?.id)
                          navigate(rutaSeccion(item.id, contextoLiga), "nav-tab");
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
          style={{ "--pestanas": pestanas.length } as CSSProperties}
        >
          {pestanas.map((pestana) =>
            pestana.grupos ? (
              <button
                key={pestana.id}
                type="button"
                className={styles.tab}
                data-activa={pestana.id === pestanaActiva}
                aria-haspopup="dialog"
                onClick={() => setHoja(pestana.id)}
              >
                <Icono trazo={pestana.icono} />
                {pestana.label}
              </button>
            ) : (
              <Link
                key={pestana.id}
                href={rutaSeccion("inicio", params)}
                aria-current={section?.id === "inicio" ? "page" : undefined}
                data-activa={pestana.id === pestanaActiva}
                className={styles.tab}
                onNavigate={(event) => {
                  event.preventDefault();
                  if (section?.id !== "inicio") navigate(rutaSeccion("inicio", params), "nav-tab");
                }}
              >
                <Icono trazo={pestana.icono} />
                {pestana.label}
              </Link>
            ),
          )}
        </nav>
        <Dialog
          open={!!abierta}
          onClose={() => setHoja(null)}
          title={abierta?.label ?? ""}
          closeLabel="Cerrar menú"
          mobilePresentation="sheet"
        >
          {/* Solo montada mientras está abierta: si no, las entradas salen dos veces. */}
          {abierta && (
            <>
              <TarjetasMenu
                grupos={gruposVisibles(abierta, visibles, tecnico)}
                alElegir={() => setHoja(null)}
              />
              {abierta.id === "mas" && acceso && (
                <div className={`${styles.cuenta} ${styles.cuentaHoja}`}>
                  <span>{acceso.nombre}</span>
                  <button type="button" onClick={() => void cerrarSesionYSalir()}>
                    Salir
                  </button>
                </div>
              )}
            </>
          )}
        </Dialog>
      </div>
    </div>
  );
}
