"use client";

export default function ClasificacionPage() {
  // Datos de ejemplo basándonos en una liga típica de la zona
  const equipos = [
    { pos: 1, nombre: "SD Compostela B", pj: 10, pts: 25 },
    { pos: 2, nombre: "Santiso Club", pj: 10, pts: 22 },
    { pos: 3, nombre: "Arzúa CF", pj: 10, pts: 19 },
    { pos: 4, nombre: "Melide CF", pj: 10, pts: 18 },
    { pos: 5, nombre: "Dumbría", pj: 10, pts: 15 },
    { pos: 6, nombre: "Soneira", pj: 10, pts: 12 },
  ];

  return (
    <main className="page-container">
      <div className="container">
        <h1>Clasificación <span className="text-primary">Liga</span></h1>
        
        <div className="table-wrapper">
          <table className="league-table">
            <thead>
              <tr>
                <th>Pos</th>
                <th className="text-left">Equipo</th>
                <th>PJ</th>
                <th>Pts</th>
              </tr>
            </thead>
            <tbody>
              {equipos.map((e) => (
                <tr key={e.pos} className={e.nombre === "Santiso Club" ? "highlight" : ""}>
                  <td className="pos">{e.pos}</td>
                  <td className="text-left font-bold">{e.nombre}</td>
                  <td>{e.pj}</td>
                  <td className="font-bold">{e.pts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="hint">Próximamente: Sincronización automática con Futgal.</p>
      </div>

      <style jsx>{`
        .page-container { padding: 4rem 0; min-height: 100vh; }
        h1 { font-size: 3.5rem; margin-bottom: 3rem; text-align: center; }
        .table-wrapper { background: var(--secondary); border-radius: 1rem; border: 1px solid var(--border); overflow: hidden; }
        .league-table { width: 100%; border-collapse: collapse; text-align: center; }
        .league-table th { background: #000; padding: 1.5rem; text-transform: uppercase; font-size: 0.8rem; letter-spacing: 1px; }
        .league-table td { padding: 1.5rem; border-bottom: 1px solid var(--border); }
        .text-left { text-align: left; }
        .font-bold { font-weight: 900; }
        .pos { color: #525252; font-weight: 700; }
        .highlight { background: rgba(250, 204, 21, 0.1); }
        .highlight td { border-bottom: 1px solid var(--primary); }
        .highlight .font-bold { color: var(--primary); }
        .hint { text-align: center; color: #525252; margin-top: 2rem; font-size: 0.9rem; }
        
        @media (max-width: 600px) {
          .league-table th, .league-table td { padding: 1rem 0.5rem; font-size: 0.9rem; }
        }
      `}</style>
    </main>
  );
}
