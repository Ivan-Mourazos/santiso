"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import AdminShield from "@/components/admin/AdminShield";
import { TEMPLATES } from "@/components/admin/cartel/types";
import { LoadingState } from "@/components/ui/AdminUI";

const panelLoading = () => (
  <LoadingState
    title="Cargando panel"
    detail="Preparando datos e ferramentas desta sección."
  />
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
const AdminJornadaImporter = dynamic(
  () => import("@/components/admin/AdminJornadaImporter"),
  { loading: panelLoading },
);

export default function AdminPage() {
  const [activeView, setActiveView] = useState<string>("jornadas");
  const [categoria, setCategoria] = useState("Senior");
  const [tipoCartel, setTipoCartel] = useState<string>(TEMPLATES[0].id);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string, onConfirm: () => void } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const showConfirm = (message: string, onConfirm: () => void) => {
    setConfirmDialog({ message, onConfirm });
  };

  return (
    <main className="admin-container">
      <div className="container">
        
        {/* HEADER REDISEÑADO */}
        <header className="admin-top-bar">
          <div className="admin-brand">
             <AdminShield showToast={showToast} showConfirm={showConfirm} compact />
             <div className="admin-title-group">
                <h1 className="admin-title">Panel <span className="text-primary">Admin</span></h1>
             </div>
          </div>

          <nav className="admin-main-nav">
            <button title="Calendario" className={`nav-tab ${activeView === 'jornadas' ? 'active' : ''}`} onClick={() => setActiveView('jornadas')}>
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
               <span className="nav-label">Calendario</span>
            </button>
            <button title="Plantilla / Staff" className={`nav-tab ${activeView === 'plantilla' ? 'active' : ''}`} onClick={() => setActiveView('plantilla')}>
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
               <span className="nav-label">Plantilla</span>
            </button>
            <button title="Equipos" className={`nav-tab ${activeView === 'equipos' ? 'active' : ''}`} onClick={() => setActiveView('equipos')}>
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
               <span className="nav-label">Equipos</span>
            </button>
            <button title="Carteles" className={`nav-tab ${activeView === 'carteles' ? 'active' : ''}`} onClick={() => setActiveView('carteles')}>
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
               <span className="nav-label">Carteles</span>
            </button>
            <button title="Importar acta" className={`nav-tab ${activeView === 'actas' ? 'active' : ''}`} onClick={() => setActiveView('actas')}>
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h6"/></svg>
               <span className="nav-label">Importar acta</span>
            </button>
            <button title="Importar jornada" className={`nav-tab ${activeView === 'jornada-img' ? 'active' : ''}`} onClick={() => setActiveView('jornada-img')}>
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
               <span className="nav-label">Importar jornada</span>
            </button>
            <button title="Patrocinadores" className={`nav-tab ${activeView === 'sponsors' ? 'active' : ''}`} onClick={() => setActiveView('sponsors')}>
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>
               <span className="nav-label">Sponsors</span>
            </button>
          </nav>
        </header>

        {/* FILTROS DE CATEGORÍA O SELECTOR DE CARTELES */}
        <div className="admin-filters-bar">
          {activeView === 'carteles' ? (
             <div className="category-tabs-premium carteles">
               {TEMPLATES.map(t => (
                 <button 
                   key={t.id} 
                   className={tipoCartel === t.id ? "active" : ""} 
                   onClick={() => setTipoCartel(t.id)}
                   style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                 >
                   <span style={{ fontSize: '1.1rem' }}>{t.emoji}</span>
                   {t.label}
                 </button>
               ))}
             </div>
          ) : (activeView === 'jornadas' || activeView === 'plantilla' || activeView === 'equipos') ? (
             <div className="category-tabs-premium">
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

        {/* CONTENIDO DINÁMICO */}
        <section className="admin-view-content scale-in">
           {activeView === 'jornadas' && <AdminJornadas showToast={showToast} showConfirm={showConfirm} categoria={categoria} />}
           {activeView === 'plantilla' && (
             categoria === "Directiva" ? (
               <AdminStaff showToast={showToast} showConfirm={showConfirm} tipo="Directiva" />
             ) : (categoria === "Cuerpo Técnico" || categoria.includes("Staff")) ? (
               <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                 <div className="category-tabs-premium" style={{ alignSelf: 'center', marginBottom: '1rem', background: 'rgba(255,255,255,0.02)' }}>
                    <button className={categoria === "SeniorStaff" ? "active" : ""} onClick={() => setCategoria("SeniorStaff")} style={{ fontSize: '0.7rem' }}>Senior</button>
                    <button className={categoria === "FemeninoStaff" ? "active" : ""} onClick={() => setCategoria("FemeninoStaff")} style={{ fontSize: '0.7rem' }}>Femenino</button>
                    <button className={categoria === "VeteranosStaff" ? "active" : ""} onClick={() => setCategoria("VeteranosStaff")} style={{ fontSize: '0.7rem' }}>Veteranos</button>
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
           {activeView === 'carteles' && <GeneradorCartel templateId={tipoCartel} onTemplateChange={setTipoCartel} hideLayout />}
           {activeView === 'actas' && <AdminActaImporter showToast={showToast} showConfirm={showConfirm} />}
           {activeView === 'jornada-img' && <AdminJornadaImporter showToast={showToast} showConfirm={showConfirm} />}
           {activeView === 'sponsors' && <AdminSponsors showToast={showToast} showConfirm={showConfirm} />}
        </section>

      </div>

      {/* MODALES Y TOASTS */}
      {confirmDialog && (
        <div className="confirm-overlay">
          <div className="confirm-modal glass scale-in">
            <div className="confirm-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#facc15" strokeWidth="2">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
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
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      <style jsx>{`
        .admin-container { padding: 1.5rem 0 5rem; min-height: 100vh; background: #000; }
        
        .admin-top-bar { 
          display: flex; justify-content: space-between; align-items: center; 
          margin-bottom: 2rem; padding: 1rem; background: rgba(255,255,255,0.02);
          border-radius: 1.2rem; border: 1px solid rgba(255,255,255,0.05);
          flex-wrap: wrap; gap: 1.5rem;
        }
        
        .admin-brand { display: flex; align-items: center; gap: 1.5rem; }
        .admin-title { font-size: 1.8rem; font-weight: 900; letter-spacing: -1px; margin: 0; }
        
        .admin-main-nav { display: flex; gap: 0.8rem; }
        .nav-tab { 
          display: flex; align-items: center; gap: 0.6rem;
          padding: 0.8rem 1.4rem; border-radius: 1rem; border: 1px solid rgba(255,255,255,0.05);
          background: rgba(255,255,255,0.02); color: #888; font-weight: 800; font-size: 0.85rem;
          cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); text-decoration: none;
        }
        .nav-tab:hover { background: rgba(255,255,255,0.06); color: white; transform: translateY(-1px); }
        .nav-tab.active { 
          background: rgba(250, 204, 21, 0.1); color: var(--primary); 
          border-color: rgba(250, 204, 21, 0.3);
          box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        }

        @media (max-width: 1200px) {
          .nav-label { display: none; }
          .nav-tab { padding: 0.8rem; }
        }

        .admin-filters-bar { margin-bottom: 3rem; display: flex; justify-content: center; }
        .category-tabs-premium { 
          display: flex; background: rgba(255,255,255,0.03); padding: 0.3rem; 
          border-radius: 100px; border: 1px solid rgba(255,255,255,0.05);
        }
        .category-tabs-premium button { 
          background: transparent; border: none; color: #666; padding: 0.6rem 2rem; 
          border-radius: 100px; cursor: pointer; font-weight: 800; font-size: 0.8rem;
          transition: all 0.3s; text-transform: uppercase; letter-spacing: 1px;
        }
        .category-tabs-premium button.active { background: var(--primary); color: black; box-shadow: 0 4px 15px rgba(250, 204, 21, 0.3); }

        .admin-view-content { min-height: 50vh; }

        .toast-container { position: fixed; bottom: 2rem; right: 2rem; z-index: 9999; padding: 1rem 1.5rem; border-radius: 1rem; min-width: 280px; }
        .toast-content { display: flex; align-items: center; gap: 1rem; font-weight: 700; color: white; }
        .success { border: 1px solid var(--primary); background: rgba(250, 204, 21, 0.1); }
        .error { border: 1px solid #ef4444; background: rgba(239, 68, 68, 0.1); }
        .confirm-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 2rem; }
        .confirm-modal { max-width: 400px; width: 100%; border: 1px solid rgba(250, 204, 21, 0.2); padding: 2.5rem; border-radius: 1.5rem; text-align: center; }
        .confirm-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .btn-cancel { background: rgba(255,255,255,0.05); border: 1px solid var(--border); color: white; padding: 0.8rem; border-radius: 0.8rem; font-weight: 700; cursor: pointer; transition: all 0.2s; }
        .btn-confirm { background: var(--primary); border: none; color: black; padding: 0.8rem; border-radius: 0.8rem; font-weight: 800; cursor: pointer; transition: all 0.2s; }
        
        .scale-in { animation: scaleIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        @keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }

        @media (max-width: 768px) {
          .admin-top-bar { flex-direction: column; align-items: stretch; }
          .admin-main-nav { flex-direction: column; }
          .category-tabs-premium button { padding: 0.6rem 1rem; font-size: 0.7rem; }
        }
      `}</style>
    </main>
  );
}
