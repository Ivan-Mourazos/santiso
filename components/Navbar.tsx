"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function Navbar() {
  const [escudo, setEscudo] = useState<string | null>(null);

  useEffect(() => {
    const { data } = supabase.storage.from("fotos").getPublicUrl(`escudo_club.webp?t=${Date.now()}`);
    if (data) setEscudo(data.publicUrl);
  }, []);

  return (
    <nav className="navbar-wrapper">
      <div className="navbar container">
        <Link href="/" className="logo-text" style={{ display: 'flex', alignItems: 'center', gap: '15px', textDecoration: 'none' }}>
          {escudo && escudo !== "" && <img src={escudo} alt="Escudo UD Santiso" style={{ width: '60px', height: '60px', minWidth: '60px', objectFit: 'contain' }} />}
          <span style={{ fontSize: '1.5rem', fontWeight: 900 }}>UD <span className="text-primary">SANTISO</span></span>
        </Link>
        <div className="nav-links">
          <Link href="/">Inicio</Link>
          <Link href="/partidos">Partidos</Link>
          <Link href="/clasificacion">Clasificación</Link>
          <Link href="/plantilla">Plantilla</Link>
          <Link href="/admin" className="nav-admin">Admin</Link>
        </div>
      </div>

      <style jsx>{`
        .navbar-wrapper { position: sticky; top: 0; z-index: 1000; background: rgba(0,0,0,0.8); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border-bottom: 1px solid var(--border); }
        .navbar { height: 80px; display: flex; align-items: center; justify-content: space-between; }
        .logo-text { font-size: 1.5rem; font-weight: 900; letter-spacing: -1px; text-decoration: none; color: white; }
        .nav-links { display: flex; gap: 2.5rem; font-weight: 700; text-transform: uppercase; font-size: 0.85rem; align-items: center; }
        .nav-links :global(a) { color: white; text-decoration: none; transition: color 0.2s; }
        .nav-links :global(a:hover) { color: var(--primary); }
        .nav-admin { font-size: 0.7rem; border: 1px solid var(--primary); padding: 0.3rem 0.7rem; border-radius: 4px; color: var(--primary) !important; }
      `}</style>
    </nav>
  );
}
