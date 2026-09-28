/** Balón pequeño para listas de goles (SVG: no depende de fuentes de emoji). */
export function Balon({ tamano = 26 }: { tamano?: number }) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="11" fill="#fff" stroke="#0b0b0c" strokeWidth="1.5" />
      <path d="M12 6.8l4.2 3-1.6 4.9H9.4L7.8 9.8z" fill="#0b0b0c" />
      <path
        d="M12 6.8V1.5M16.2 9.8l5-1.6M14.6 14.7l3.1 4.3M9.4 14.7l-3.1 4.3M7.8 9.8l-5-1.6"
        stroke="#0b0b0c"
        strokeWidth="1.3"
      />
    </svg>
  );
}
