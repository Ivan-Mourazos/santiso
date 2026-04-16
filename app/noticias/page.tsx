"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function NoticiasPage() {
  const [noticias, setNoticias] = useState<any[]>([]);

  useEffect(() => {
    async function fetchNoticias() {
      const { data } = await supabase.from("noticias").select("*").order("fecha", { ascending: false });
      if (data) setNoticias(data);
    }
    fetchNoticias();
  }, []);

  return (
    <main className="page-container">
      <div className="container">
        <h1>Últimas <span className="text-primary">Noticias</span></h1>
        
        <div className="news-grid">
          {noticias.length > 0 ? noticias.map((n) => (
            <article key={n.id} className="news-card">
              <div className="news-meta">
                {new Date(n.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
              <h2>{n.titulo}</h2>
              <p>{n.contenido}</p>
            </article>
          )) : (
            <p>Cargando noticias de la federación...</p>
          )}
        </div>
      </div>

      <style jsx>{`
        .page-container { padding: 4rem 0; min-height: 100vh; }
        h1 { font-size: 3.5rem; margin-bottom: 3rem; text-align: center; }
        .news-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 2rem; }
        .news-card { background: var(--secondary); padding: 2rem; border-radius: 1rem; border: 1px solid var(--border); transition: transform 0.2s ease; }
        .news-card:hover { transform: translateY(-5px); border-color: var(--primary); }
        .news-meta { color: var(--primary); font-weight: 700; font-size: 0.8rem; text-transform: uppercase; margin-bottom: 1rem; }
        .news-card h2 { font-size: 1.5rem; margin-bottom: 1rem; }
        .news-card p { color: #a3a3a3; line-height: 1.6; }
      `}</style>
    </main>
  );
}
