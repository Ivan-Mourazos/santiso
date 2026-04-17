"use client";
import { useState } from "react";
import Link from "next/link";
import AdminShield from "@/components/admin/AdminShield";
import AdminEquipos from "@/components/admin/AdminEquipos";
import AdminSponsors from "@/components/admin/AdminSponsors";
import AdminLeague from "@/components/admin/AdminLeague";
import AdminPlayers from "@/components/admin/AdminPlayers";
import AdminMatches from "@/components/admin/AdminMatches";

export default function AdminPage() {
  const [activeSection, setActiveSection] = useState<string | null>("identidad");
  const [categoria, setCategoria] = useState("Senior");
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const toggleSection = (id: string) => {
    setActiveSection(activeSection === id ? null : id);
  };

  const AccordionItem = ({ id, title, icon, children }: { id: string, title: string, icon: React.ReactNode, children: React.ReactNode }) => {
    const isOpen = activeSection === id;
    
    return (
      <div className={`ud-accordion-item ${isOpen ? 'active' : ''}`}>
        <button className="ud-accordion-header" onClick={() => toggleSection(id)}>
          <div className="ud-accordion-title-wrap">
            <span className="ud-accordion-icon">{icon}</span>
            <span className="ud-accordion-title">{title}</span>
          </div>
          <svg className="ud-chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div className="ud-accordion-content-wrap" style={{ display: isOpen ? 'block' : 'none' }}>
          <div className="ud-accordion-content">
            {children}
          </div>
        </div>
      </div>
    );
  };

  return (
    <main className="admin-container">
      <div className="container">
        <header className="admin-header">
          <div>
            <Link href="/" className="btn-back">← Volver a la Web</Link>
            <h1 className="hero-title" style={{ fontSize: '3rem', margin: '0.5rem 0' }}>Panel de <span className="text-primary">Control</span></h1>
            <p className="admin-subtitle">Gestiona la identidad, plantilla y calendario del UD Santiso.</p>
          </div>

          <div className="admin-nav">
            <div className="category-tabs">
              <button className={categoria === "Senior" ? "active" : ""} onClick={() => setCategoria("Senior")}>Senior</button>
              <button className={categoria === "Femenino" ? "active" : ""} onClick={() => setCategoria("Femenino")}>Femenino</button>
              <button className={categoria === "Veteranos" ? "active" : ""} onClick={() => setCategoria("Veteranos")}>Veteranos</button>
            </div>
          </div>
        </header>

        <section className="admin-content">
          <div className="ud-accordion-list">
            <AccordionItem 
              id="identidad" 
              title="Identidad del Club" 
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>}
            >
              <AdminShield showToast={showToast} />
            </AccordionItem>

            <AccordionItem 
              id="patrocinadores" 
              title="Patrocinadores" 
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>}
            >
              <AdminSponsors showToast={showToast} />
            </AccordionItem>

            <AccordionItem 
              id="competicion" 
              title="Librería de Equipos y Liga" 
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>}
            >
              <AdminLeague showToast={showToast} />
              <AdminEquipos showToast={showToast} />
            </AccordionItem>

            <AccordionItem 
              id="deportiva" 
              title="Plantilla y Calendario" 
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
            >
              <div className="lists-grid">
                <AdminPlayers showToast={showToast} categoria={categoria} />
                <AdminMatches showToast={showToast} categoria={categoria} />
              </div>
            </AccordionItem>
          </div>
        </section>
      </div>

      {/* Notificaciones Toast */}
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
        .admin-container { padding: 4rem 0; min-height: 100vh; background: #000; }
        .admin-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 3rem; flex-wrap: wrap; gap: 1rem; }
        .admin-subtitle { color: #a3a3a3; font-size: 0.9rem; margin-top: 0.25rem; }
        .admin-nav { display: flex; align-items: center; gap: 2rem; }
        .category-tabs { display: flex; background: var(--secondary); padding: 0.25rem; border-radius: 0.5rem; border: 1px solid var(--border); }
        .category-tabs button { background: transparent; border: none; color: white; padding: 0.5rem 1rem; border-radius: 0.4rem; cursor: pointer; font-weight: 700; font-family: inherit; transition: all 0.2s; }
        .category-tabs button.active { background: var(--primary); color: black; }
        .lists-grid { display: flex; flex-direction: column; gap: 4rem; align-items: stretch; width: 100%; }
        @media (max-width: 1024px) { .lists-grid { gap: 3rem; } }
        
        /* Toast Styles */
        .toast-container {
          position: fixed; bottom: 2rem; right: 2rem; z-index: 9999;
          padding: 1rem 1.5rem; border-radius: 1rem; min-width: 280px;
          animation: slideIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        .toast-content { display: flex; align-items: center; gap: 1rem; font-weight: 700; color: white; }
        .success { border: 1px solid var(--primary); background: rgba(250, 204, 21, 0.1); box-shadow: 0 10px 30px rgba(0,0,0,0.5), 0 0 15px rgba(250, 204, 21, 0.2); }
        .error { border: 1px solid #ef4444; background: rgba(239, 68, 68, 0.1); box-shadow: 0 10px 30px rgba(0,0,0,0.5), 0 0 15px rgba(239, 68, 68, 0.2); }
        
        @keyframes slideIn {
          from { transform: translateX(100%) scale(0.9); opacity: 0; }
          to { transform: translateX(0) scale(1); opacity: 1; }
        }

        .btn-back { color: var(--primary); font-weight: bold; text-decoration: none; }
      `}</style>
    </main>
  );
}
