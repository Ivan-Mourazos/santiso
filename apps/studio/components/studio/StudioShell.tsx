"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState, type ReactNode } from "react";
import { SECCIONES, categoriaDe, rutaSeccion } from "@/lib/navigation/contexto";
import { TEMPLATES } from "@/components/admin/cartel/types";
import { Button } from "@/components/ui/foundation/Button";
import { Dialog } from "@/components/ui/foundation/Dialog";
import { Select } from "@/components/ui/foundation/Fields";
import { useStudio } from "./StudioContext";
import styles from "./StudioShell.module.css";
/** Lo del día de partido, a un toque en el móvil; el resto del menú queda en «Más». */
const PESTANAS = [
  {
    id: "jornada",
    label: "Jornada",
    icono: "M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z",
  },
  {
    id: "actas",
    label: "Actas",
    icono: "M9 4h6v3H9zM8 5H6a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2M9 12h6M9 16h4",
  },
  {
    id: "carteles",
    label: "Carteles",
    icono: "M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1ZM4 16l4.5-4.5 3.5 3.5 3-3 5 5M9 9h.01",
  },
] as const;

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

export function StudioShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { params, navigate, setParams } = useStudio();
  const [menu, setMenu] = useState(false);
  const menuId = useId();
  const section = SECCIONES.find((item) => pathname === `/admin/${item.id}`);
  // Solo el calendario en PDF sigue reservado a escritorio; la captura de jornada vale en móvil.
  const desktopOnly =
    section?.id === "importar-jornada" && params.get("origen") === "calendario";
  const category = categoriaDe(params);
  const categories = ["Senior", "Veteranos"];
  const showCategory = [
    "calendario",
    "clasificacion",
    "estadisticas",
    "jugadores",
    "tecnicos",
    "equipos",
    "alineacion",
    "convocatoria",
  ].some((id) => id === section?.id);
  function navigation() {
    return (
      <nav aria-label="Navegación principal" className={styles.nav}>
        {[...new Set(SECCIONES.map((item) => item.grupo))].map((group) => (
          <section key={group}>
            <h2 className={styles.group}>{group}</h2>
            {SECCIONES.filter((item) => item.grupo === group).map((item) => (
              <Link
                key={item.id}
                href={rutaSeccion(item.id, params)}
                aria-current={item.id === section?.id ? "page" : undefined}
                className={styles.link}
                onNavigate={(event) => {
                  event.preventDefault();
                  if (item.id === section?.id) {
                    setMenu(false);
                    return;
                  }
                  if (navigate(rutaSeccion(item.id, params))) setMenu(false);
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
          href={rutaSeccion("jornada", params)}
          onNavigate={(e) => {
            e.preventDefault();
            if (section?.id !== "jornada") navigate(rutaSeccion("jornada", params));
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- icono estático de /public */}
          <img className={styles.logo} src="/logos/app-192.png" alt="" width={40} height={40} />
          <span>UD SANTISO</span>
          <strong>Studio</strong>
        </Link>
        {navigation()}
      </aside>
      <div className={styles.main}>
        <header className={styles.header}>
          <div className={styles.heading}>
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
          {desktopOnly ? (
            <>
              <p role="status" className={styles.desktopNotice}>
                El calendario en PDF se importa solo en escritorio (desde 1280 × 720).{" "}
                <Link href="/admin/importar-jornada?origen=foto">
                  Importar una captura de jornada
                </Link>
              </p>
              <div className={styles.desktopOnly}>{children}</div>
            </>
          ) : (
            children
          )}
        </main>
        <nav aria-label="Accesos rápidos" className={styles.tabs}>
          {PESTANAS.map((pestana) => (
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
          <button
            type="button"
            className={styles.tab}
            data-activa={!PESTANAS.some((pestana) => pestana.id === section?.id)}
            aria-expanded={menu}
            aria-controls={menuId}
            aria-haspopup="dialog"
            onClick={(event) => {
              // Safari no enfoca los botones al tocarlos: conserva el destino de retorno.
              event.currentTarget.focus();
              setMenu(true);
            }}
          >
            <Icono trazo="M4 7h16M4 12h16M4 17h16" />
            Más
          </button>
        </nav>
      </div>
      <Dialog
        id={menuId}
        open={menu}
        onClose={() => setMenu(false)}
        title="Menú de Studio"
        mobilePresentation="sheet"
      >
        {navigation()}
      </Dialog>
    </div>
  );
}
