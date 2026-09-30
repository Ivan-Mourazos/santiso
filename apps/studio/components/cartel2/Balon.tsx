/** Vértices de un pentágono regular con una punta arriba, centrado en (cx, cy). */
function pentagono(cx: number, cy: number, radio: number, giro = -90) {
  return Array.from({ length: 5 }, (_, i) => {
    const angulo = ((giro + i * 72) * Math.PI) / 180;
    return `${(cx + radio * Math.cos(angulo)).toFixed(2)},${(cy + radio * Math.sin(angulo)).toFixed(2)}`;
  }).join(" ");
}

/** Centro de cada parche del borde: en la dirección de cada punta del pentágono central. */
const BORDE = Array.from({ length: 5 }, (_, i) => {
  const angulo = ((-90 + i * 72) * Math.PI) / 180;
  return { x: 12 + 11.2 * Math.cos(angulo), y: 12 + 11.2 * Math.sin(angulo), giro: 90 + i * 72 };
});

/**
 * Balón de fútbol clásico para listas de goles (SVG: no depende de fuentes de emoji). Pentágono
 * negro grande en el centro y cinco parches cortados por el borde: a 26 px se reconoce como
 * balón, no como un círculo blanco.
 */
export function Balon({ tamano = 26 }: { tamano?: number }) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 24 24" aria-hidden>
      <defs>
        <clipPath id="balon-borde">
          <circle cx="12" cy="12" r="11" />
        </clipPath>
      </defs>
      <circle cx="12" cy="12" r="11" fill="#fff" />
      <g clipPath="url(#balon-borde)" fill="#0b0b0c" stroke="#0b0b0c" strokeWidth="1.2">
        <polygon points={pentagono(12, 12, 4.6)} />
        {BORDE.map((p, i) => (
          <polygon key={i} points={pentagono(p.x, p.y, 4.4, p.giro)} />
        ))}
        {BORDE.map((p, i) => {
          const angulo = ((-90 + i * 72) * Math.PI) / 180;
          return (
            <line
              key={`l${i}`}
              x1={12 + 4.6 * Math.cos(angulo)}
              y1={12 + 4.6 * Math.sin(angulo)}
              x2={p.x}
              y2={p.y}
              fill="none"
            />
          );
        })}
      </g>
      <circle cx="12" cy="12" r="11" fill="none" stroke="#0b0b0c" strokeWidth="1.4" />
    </svg>
  );
}
