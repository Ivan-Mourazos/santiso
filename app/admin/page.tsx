"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import AdminShield from "@/components/admin/AdminShield";
import { TEMPLATES } from "@/components/admin/cartel/types";

const panelLoading = () => (
  <div style={{ minHeight: "60vh" }} />
);

const AdminEquipos = dynamic(() => import("@/components/admin/AdminEquipos"), {
  loading: panelLoading,
});
const AdminSponsors = dynamic(() => import("@/components/admin/AdminSponsors"), {
  loading: panelLoading,
});
const AdminJornadas = dynamic(() => import("@/components/admin/AdminJornadas"), {
  loading: panelLoading,
});
const AdminPlayers = dynamic(() => import("@/components/admin/AdminPlayers"), {
  loading: panelLoading,
});
const AdminStaff = dynamic(() => import("@/components/admin/AdminStaff"), {
  loading: panelLoading,
});
const GeneradorCartel = dynamic(() => import("@/components/admin/GeneradorCartel"), {
  loading: panelLoading,
});
const AdminActaImporter = dynamic(
  () => import("@/components/admin/AdminActaImporter"),
  { loading: panelLoading },
);
const AdminActaBatch = dynamic(
  () => import("@/components/admin/AdminActaBatch"),
  { loading: panelLoading },
);
const AdminJornadaImporter = dynamic(
  () => import("@/components/admin/AdminJornadaImporter"),
  { loading: panelLoading },
);
const AdminTemporadas = dynamic(
  () => import("@/components/admin/AdminTemporadas"),
  { loading: panelLoading },
);
const AdminLeague = dynamic(() => import("@/components/admin/AdminLeague"), {
  loading: panelLoading,
});

// ── Navegación agrupada del panel ──────────────────────────────
type NavItem = { id: string; label: string; icon: React.ReactNode };
type NavGroup = { label: string; items: NavItem[] };

const ico = (paths: React.ReactNode) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{paths}</svg>
);

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Datos base",
    items: [
      { id: "temporadas", label: "Temporadas", icon: ico(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>) },
      { id: "ligas", label: "Ligas", icon: ico(<><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></>) },
      { id: "equipos", label: "Equipos", icon: ico(<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>) },
    ],
  },
  {
    label: "Plantel",
    items: [
      { id: "plantilla", label: "Plantilla", icon: ico(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>) },
      { id: "sponsors", label: "Sponsors", icon: ico(<path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />) },
    ],
  },
  {
    label: "Competición",
    items: [
      { id: "jornadas", label: "Calendario", icon: ico(<><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>) },
    ],
  },
  {
    label: "Producción",
    items: [
      { id: "carteles", label: "Carteles", icon: ico(<><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></>) },
      { id: "actas", label: "Actas", icon: ico(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M8 13h8M8 17h6" /></>) },
      { id: "jornada-img", label: "Jornada", icon: ico(<><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><path d="M8 14h.01M12 14h.01M16 14h.01" /></>) },
    ],
  },
];

const VIEW_META: Record<string, { label: string; group: string }> = {};
for (const g of NAV_GROUPS) for (const it of g.items) VIEW_META[it.id] = { label: it.label, group: g.label };

export default function AdminPage() {
  const [activeView, setActiveView] = useState<string>("jornadas");
  const [actasMode, setActasMode] = useState<"single" | "batch">("single");
  const [categoria, setCategoria] = useState("Senior");
  const [tipoCartel, setTipoCartel] = useState<string>(TEMPLATES[0].id);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string, onConfirm: () => void } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const showConfirm = (message: string, onConfirm: () => void) => {
    setConfirmDialog({ message, onConfirm });
  };

  const goTo = (view: string) => {
    setActiveView(view);
    setSidebarOpen(false);
  };

  const meta = VIEW_META[activeView];
  const showCategoryFilter = ['jornadas', 'plantilla', 'equipos', 'ligas'].includes(activeView);

  return (
    <div className="admin-shell">
      {/* ── SIDEBAR ─────────────────────────────────────────── */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <AdminShield showToast={showToast} showConfirm={showConfirm} compact />
          <div className="brand-text">
            <span className="brand-eyebrow">UD Santiso</span>
            <h1 className="brand-title">Panel <span className="text-primary">Admin</span></h1>
          </div>
          <button className="sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Cerrar menú">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV_GROUPS.map((group) => (
            <div className="nav-group" key={group.label}>
              <span className="nav-group-label">{group.label}</span>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  className={`nav-item ${activeView === item.id ? 'active' : ''}`}
                  onClick={() => goTo(item.id)}
                  title={item.label}
                >
                  <span className="nav-item-icon">{item.icon}</span>
                  <span className="nav-item-label">{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* ── MAIN ────────────────────────────────────────────── */}
      <div className="admin-main">
        <header className="main-topbar">
          <button className="hamburger" onClick={() => setSidebarOpen(true)} aria-label="Abrir menú">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
          </button>

          <div className="topbar-heading">
            <span className="topbar-eyebrow">{meta?.group}</span>
            <h2 className="topbar-title">{meta?.label}</h2>
          </div>

          <div className="topbar-filters">
            {activeView === 'carteles' ? (
              <div className="seg-tabs carteles">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    className={tipoCartel === t.id ? "active" : ""}
                    onClick={() => setTipoCartel(t.id)}
                  >
                    <span className="seg-emoji">{t.emoji}</span>
                    {t.label}
                  </button>
                ))}
              </div>
            ) : showCategoryFilter ? (
              <div className="seg-tabs">
                <button className={categoria === "Senior" ? "active" : ""} onClick={() => setCategoria("Senior")}>Senior</button>
                <button className={categoria === "Femenino" ? "active" : ""} onClick={() => setCategoria("Femenino")}>Femenino</button>
                <button className={categoria === "Veteranos" ? "active" : ""} onClick={() => setCategoria("Veteranos")}>Veteranos</button>
                {activeView === 'plantilla' && (
                  <>
                    <button
                      className={categoria === "Cuerpo Técnico" || categoria.includes("Staff") ? "active" : ""}
                      onClick={() => setCategoria("SeniorStaff")}
                    >
                      Cuerpo Técnico
                    </button>
                    <button className={categoria === "Directiva" ? "active" : ""} onClick={() => setCategoria("Directiva")}>Directiva</button>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </header>

        {/* ── CONTENIDO ─────────────────────────────────────── */}
        <section key={activeView} className="admin-view-content scale-in">
          {activeView === 'jornadas' && <AdminJornadas showToast={showToast} showConfirm={showConfirm} categoria={categoria} />}
          {activeView === 'plantilla' && (
            categoria === "Directiva" ? (
              <AdminStaff showToast={showToast} showConfirm={showConfirm} tipo="Directiva" />
            ) : (categoria === "Cuerpo Técnico" || categoria.includes("Staff")) ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <div className="seg-tabs" style={{ alignSelf: 'center' }}>
                  <button className={categoria === "SeniorStaff" ? "active" : ""} onClick={() => setCategoria("SeniorStaff")}>Senior</button>
                  <button className={categoria === "FemeninoStaff" ? "active" : ""} onClick={() => setCategoria("FemeninoStaff")}>Femenino</button>
                  <button className={categoria === "VeteranosStaff" ? "active" : ""} onClick={() => setCategoria("VeteranosStaff")}>Veteranos</button>
                </div>
                {categoria.includes("Staff") ? (
                  <AdminStaff showToast={showToast} showConfirm={showConfirm} tipo="Tecnico" categoria={categoria.replace("Staff", "")} />
                ) : (
                  <div className="card glass" style={{ textAlign: 'center', padding: '4rem' }}>
                    <p style={{ color: '#666' }}>Selecciona una categoría para gestionar su cuerpo técnico.</p>
                  </div>
                )}
              </div>
            ) : (
              <AdminPlayers showToast={showToast} showConfirm={showConfirm} categoria={categoria} />
            )
          )}
          {activeView === 'equipos' && <AdminEquipos showToast={showToast} showConfirm={showConfirm} categoria={categoria} />}
          {activeView === 'temporadas' && <AdminTemporadas showToast={showToast} showConfirm={showConfirm} />}
          {activeView === 'ligas' && <AdminLeague showToast={showToast} showConfirm={showConfirm} categoria={categoria} />}
          {activeView === 'carteles' && <GeneradorCartel templateId={tipoCartel} onTemplateChange={setTipoCartel} hideLayout />}
          {activeView === 'actas' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
                <div className="seg-tabs">
                  <button className={actasMode === 'single' ? 'active' : ''} onClick={() => setActasMode('single')}>Individual</button>
                  <button className={actasMode === 'batch' ? 'active' : ''} onClick={() => setActasMode('batch')}>Lote</button>
                </div>
              </div>
              {actasMode === 'single'
                ? <AdminActaImporter showToast={showToast} showConfirm={showConfirm} />
                : <AdminActaBatch showToast={showToast} />}
            </div>
          )}
          {activeView === 'jornada-img' && <AdminJornadaImporter showToast={showToast} showConfirm={showConfirm} />}
          {activeView === 'sponsors' && <AdminSponsors showToast={showToast} showConfirm={showConfirm} />}
        </section>
      </div>

      {/* ── MODALES Y TOASTS ────────────────────────────────── */}
      {confirmDialog && (
        <div className="confirm-overlay">
          <div className="confirm-modal glass scale-in">
            <div className="confirm-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#facc15" strokeWidth="2">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3>¿Estás seguro?</h3>
            <p>{confirmDialog.message}</p>
            <div className="confirm-actions">
              <button className="btn-cancel" onClick={() => setConfirmDialog(null)}>Cancelar</button>
              <button className="btn-confirm" onClick={() => {
                confirmDialog.onConfirm();
                setConfirmDialog(null);
              }}>Aceptar</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast-container glass ${toast.type}`}>
          <div className="toast-content">
            {toast.type === 'success' ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      <style jsx>{`
        .admin-shell {
          display: flex;
          min-height: 100vh;
          background:
            radial-gradient(900px 520px at 100% -8%, rgba(250, 204, 21, 0.10), transparent 60%),
            radial-gradient(760px 520px at -10% 110%, rgba(56, 189, 248, 0.07), transparent 55%),
            radial-gradient(1100px 700px at 50% 50%, rgba(255, 255, 255, 0.025), transparent 70%),
            #05060a;
        }

        /* ── SIDEBAR ── */
        .sidebar {
          width: 264px;
          flex-shrink: 0;
          position: sticky;
          top: 0;
          align-self: flex-start;
          height: 100vh;
          display: flex;
          flex-direction: column;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.055), rgba(255, 255, 255, 0.02));
          border-right: 1px solid var(--hairline);
          -webkit-backdrop-filter: blur(22px) saturate(180%);
          backdrop-filter: blur(22px) saturate(180%);
          z-index: 200;
        }
        .sidebar-brand {
          display: flex;
          align-items: center;
          gap: 0.9rem;
          padding: 1.4rem 1.2rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }
        .brand-text { display: flex; flex-direction: column; line-height: 1; flex: 1; min-width: 0; }
        .brand-eyebrow {
          font-size: 0.6rem; font-weight: 800; letter-spacing: 0.18em;
          text-transform: uppercase; color: #6b7280; margin-bottom: 0.35rem;
        }
        .brand-title { font-size: 1.25rem; font-weight: 900; letter-spacing: -0.03em; margin: 0; }
        .sidebar-close {
          display: none; background: transparent; border: none; color: #888;
          cursor: pointer; padding: 0.3rem; border-radius: 8px;
        }
        .sidebar-close:hover { color: #fff; background: rgba(255, 255, 255, 0.06); }

        .sidebar-nav { flex: 1; overflow-y: auto; padding: 1.2rem 0.85rem 2rem; }
        .nav-group { margin-bottom: 1.6rem; }
        .nav-group-label {
          display: block; font-size: 0.6rem; font-weight: 800; letter-spacing: 0.16em;
          text-transform: uppercase; color: #5b5f66; padding: 0 0.85rem; margin-bottom: 0.55rem;
        }
        .nav-item {
          position: relative;
          display: flex; align-items: center; gap: 0.85rem;
          width: 100%; padding: 0.7rem 0.85rem; margin-bottom: 0.15rem;
          background: transparent; border: none; border-radius: 0.7rem;
          color: #9aa0a6; font-weight: 700; font-size: 0.9rem; font-family: inherit;
          cursor: pointer; text-align: left;
          transition: background 0.18s, color 0.18s, transform 0.18s;
        }
        .nav-item-icon { display: flex; opacity: 0.85; transition: transform 0.18s; }
        .nav-item:hover { background: rgba(255, 255, 255, 0.05); color: #fff; }
        .nav-item:hover .nav-item-icon { transform: translateX(1px); }
        .nav-item.active {
          background: linear-gradient(90deg, rgba(250, 204, 21, 0.16), rgba(250, 204, 21, 0.04));
          color: var(--primary);
        }
        .nav-item.active::before {
          content: ""; position: absolute; left: 0; top: 18%; bottom: 18%;
          width: 3px; border-radius: 0 3px 3px 0; background: var(--primary);
          box-shadow: 0 0 12px rgba(250, 204, 21, 0.6);
        }
        .nav-item.active .nav-item-icon { opacity: 1; }

        .sidebar-overlay {
          position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(2px); z-index: 150; display: none;
        }

        /* ── MAIN ── */
        .admin-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .main-topbar {
          position: sticky; top: 0; z-index: 100;
          display: flex; align-items: center; gap: 1.2rem;
          padding: 1.1rem 1.8rem;
          background: rgba(8, 9, 14, 0.55);
          -webkit-backdrop-filter: blur(22px) saturate(180%);
          backdrop-filter: blur(22px) saturate(180%);
          border-bottom: 1px solid var(--hairline);
          flex-wrap: wrap;
        }
        .hamburger {
          display: none; background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 0.6rem;
          color: #fff; padding: 0.5rem; cursor: pointer;
        }
        .topbar-heading { display: flex; flex-direction: column; line-height: 1; margin-right: auto; }
        .topbar-eyebrow {
          font-size: 0.62rem; font-weight: 800; letter-spacing: 0.16em;
          text-transform: uppercase; color: var(--primary); margin-bottom: 0.4rem; opacity: 0.85;
        }
        .topbar-title { font-size: 1.4rem; font-weight: 900; letter-spacing: -0.03em; margin: 0; }

        .topbar-filters { display: flex; }

        /* Segmented tabs (filtros) */
        .seg-tabs {
          display: flex; flex-wrap: wrap; gap: 0.2rem;
          background: rgba(255, 255, 255, 0.04); padding: 0.3rem;
          border-radius: 100px; border: 1px solid rgba(255, 255, 255, 0.06);
        }
        .seg-tabs button {
          display: flex; align-items: center; gap: 0.4rem;
          background: transparent; border: none; color: #8a8f96;
          padding: 0.5rem 1.15rem; border-radius: 100px; cursor: pointer;
          font-weight: 800; font-size: 0.74rem; font-family: inherit;
          text-transform: uppercase; letter-spacing: 0.06em;
          transition: background 0.2s, color 0.2s;
          white-space: nowrap;
        }
        .seg-tabs button:hover { color: #fff; }
        .seg-tabs button.active {
          background: var(--primary); color: #000;
          box-shadow: 0 4px 14px rgba(250, 204, 21, 0.3);
        }
        .seg-emoji { font-size: 1rem; }

        .admin-view-content { min-height: 60vh; padding: 2rem 1.8rem 5rem; }

        /* Toasts / confirm */
        .toast-container { position: fixed; bottom: 2rem; right: 2rem; z-index: 9999; padding: 1rem 1.5rem; border-radius: 1rem; min-width: 280px; }
        .toast-content { display: flex; align-items: center; gap: 1rem; font-weight: 700; color: white; }
        .success { border: 1px solid var(--primary); background: rgba(250, 204, 21, 0.1); }
        .error { border: 1px solid #ef4444; background: rgba(239, 68, 68, 0.1); }
        .confirm-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 2rem; }
        .confirm-modal { max-width: 400px; width: 100%; border: 1px solid rgba(250, 204, 21, 0.2); padding: 2.5rem; border-radius: 1.5rem; text-align: center; }
        .confirm-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1.5rem; }
        .confirm-icon { margin-bottom: 0.5rem; }
        .btn-cancel { background: rgba(255,255,255,0.05); border: 1px solid var(--border); color: white; padding: 0.8rem; border-radius: 0.8rem; font-weight: 700; cursor: pointer; transition: all 0.2s; }
        .btn-cancel:hover { background: rgba(255,255,255,0.1); }
        .btn-confirm { background: var(--primary); border: none; color: black; padding: 0.8rem; border-radius: 0.8rem; font-weight: 800; cursor: pointer; transition: all 0.2s; }
        .btn-confirm:hover { filter: brightness(1.05); }

        .scale-in { animation: scaleIn 0.22s ease-out forwards; }
        @keyframes scaleIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

        /* ── RESPONSIVE ── */
        @media (max-width: 1024px) {
          .sidebar {
            position: fixed; top: 0; left: 0; height: 100vh;
            transform: translateX(-100%); transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 0 60px rgba(0, 0, 0, 0.6);
          }
          .sidebar.open { transform: translateX(0); }
          .sidebar.open ~ .sidebar-overlay { display: block; }
          .sidebar-close { display: block; }
          .hamburger { display: flex; }
        }
        @media (max-width: 680px) {
          .main-topbar { padding: 0.9rem 1.1rem; }
          .admin-view-content { padding: 1.4rem 1.1rem 4rem; }
          .topbar-filters { width: 100%; overflow-x: auto; }
          .topbar-title { font-size: 1.2rem; }
        }
      `}</style>
    </div>
  );
}
