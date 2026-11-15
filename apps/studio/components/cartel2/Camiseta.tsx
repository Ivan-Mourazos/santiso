import { useId } from "react";

/** Silueta de la camiseta, en un lienzo de 120 × 120. */
const SILUETA =
  "M38 8 L20 15 L3 36 L18 54 L29 46 L29 113 L91 113 L91 46 L102 54 L117 36 L100 15 L82 8 Q60 24 38 8Z";
/** Rayas verticales negras de la primera equipación. */
const RAYAS = [36, 50, 64, 78];
const NEGRO = "#0b0b0c";
const AMARILLO = "#f5c518";
const ROSA = "#ec4e9c";

/**
 * Camiseta del Santiso con el dorsal: amarilla a rayas negras, tres franjas negras en los
 * hombros y cuello amarillo. La del portero es rosa con detalles negros. Senior y Veteranos
 * visten igual.
 */
export function Camiseta({
  dorsal,
  portero,
  className,
}: {
  dorsal: string;
  portero: boolean;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const franjas = [0, 1, 2].flatMap((i) => [
    `M${24 - i * 3} ${17 + i * 5} L${36 - i} ${11 + i * 5}`,
    `M${96 + i * 3} ${17 + i * 5} L${84 + i} ${11 + i * 5}`,
  ]);
  return (
    <svg className={className} viewBox="0 0 120 120" aria-hidden>
      <defs>
        <clipPath id={`${id}-silueta`}>
          <path d={SILUETA} />
        </clipPath>
        <linearGradient id={`${id}-volumen`} x1="0" x2="1">
          <stop offset="0" stopColor="#000" stopOpacity=".25" />
          <stop offset=".5" stopColor="#fff" stopOpacity=".12" />
          <stop offset="1" stopColor="#000" stopOpacity=".3" />
        </linearGradient>
      </defs>
      <g clipPath={`url(#${id}-silueta)`}>
        <rect width="120" height="120" fill={portero ? ROSA : AMARILLO} />
        {!portero &&
          RAYAS.map((x) => <rect key={x} x={x} y="0" width="7" height="120" fill={NEGRO} />)}
        <rect width="120" height="120" fill={`url(#${id}-volumen)`} />
      </g>
      {franjas.map((d) => (
        <path key={d} d={d} stroke={NEGRO} strokeWidth="2.6" />
      ))}
      <path
        d="M44 10 Q60 22 76 10"
        stroke={portero ? NEGRO : AMARILLO}
        strokeWidth="4"
        fill="none"
      />
      <path d={SILUETA} fill="none" stroke={NEGRO} strokeWidth="2.5" />
      <text
        x="60"
        y="88"
        textAnchor="middle"
        fontFamily="var(--f-display)"
        fontSize="40"
        fill={portero ? NEGRO : "#fff"}
        stroke={NEGRO}
        strokeWidth={portero ? 0 : 7}
        paintOrder="stroke"
      >
        {dorsal}
      </text>
    </svg>
  );
}
