"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { SECCIONES, categoriaDe, rutaSeccion } from "@/lib/navigation/contexto";
import { TEMPLATES } from "@/components/admin/cartel/types";
import { Button } from "@/components/ui/foundation/Button";
import { Dialog } from "@/components/ui/foundation/Dialog";
import { Select } from "@/components/ui/foundation/Fields";
import { useStudio } from "./StudioContext";
import styles from "./StudioShell.module.css";
export function StudioShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { params, navigate, setParams } = useStudio();
  const [menu, setMenu] = useState(false);
  const section = SECCIONES.find((item) => pathname === `/admin/${item.id}`);
  const category = categoriaDe(params);
  const showCategory = ["calendario", "clasificacion", "jugadores", "tecnicos", "equipos"].some(
    (id) => id === section?.id,
  );
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
          href={rutaSeccion("calendario", params)}
          onNavigate={(e) => {
            e.preventDefault();
            if (section?.id !== "calendario") navigate(rutaSeccion("calendario", params));
          }}
        >
          <span>UD SANTISO</span>
          <strong>Studio</strong>
        </Link>
        {navigation()}
        <p className={styles.local}>Herramienta local · Carteles y equipo</p>
      </aside>
      <div className={styles.main}>
        <header className={styles.header}>
          <div className={styles.heading}>
            <div className={styles.mobileButton}>
              <Button variant="secondary" aria-expanded={menu} onClick={() => setMenu(true)}>
                Menú
              </Button>
            </div>
            <div>
              <p className={styles.eyebrow}>{section?.grupo ?? "Studio"}</p>
              <h1>{section?.label ?? "Panel"}</h1>
            </div>
          </div>
          {showCategory && (
            <div role="group" aria-label="Categoría deportiva" className={styles.categories}>
              {["Senior", "Veteranos"].map((value) => (
                <Button
                  key={value}
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
          {children}
        </main>
      </div>
      <Dialog open={menu} onClose={() => setMenu(false)} title="Menú de Studio">
        {navigation()}
      </Dialog>
    </div>
  );
}
