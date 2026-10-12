"use client";
import { useRef, useState } from "react";
import type { FotoCartel } from "@/lib/cartel2/modelo";
import s from "./FotoFondoControl.module.css";

export function FotoFondoControl({
  foto,
  onChange,
}: {
  foto: FotoCartel | null;
  onChange: (foto: FotoCartel | null) => void;
}) {
  const lectura = useRef(0);
  const [error, setError] = useState("");
  return (
    <details className={s.control}>
      <summary>Foto de campo · fondo del cartel</summary>
      <label>
        Subir foto del campo
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            const actual = ++lectura.current;
            if (!file) return;
            if (!file.type.startsWith("image/") || file.size > 8_000_000) {
              setError("Elige una imagen de hasta 8 MB.");
              return;
            }
            setError("");
            const reader = new FileReader();
            reader.onload = () => {
              if (actual === lectura.current && typeof reader.result === "string")
                onChange({ url: reader.result, x: 0.5, y: 0.5, estilo: "color" });
            };
            reader.onerror = () => {
              if (actual === lectura.current) setError("No se pudo leer la foto.");
            };
            reader.readAsDataURL(file);
          }}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      {foto && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- previa de una imagen subida, sin persistencia */}
          <img src={foto.url} alt="Foto de campo para el fondo completo" />
          <label>
            Encuadre horizontal
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={foto.x}
              onChange={(e) => onChange({ ...foto, x: Number(e.target.value) })}
            />
          </label>
          <label>
            Encuadre vertical
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={foto.y}
              onChange={(e) => onChange({ ...foto, y: Number(e.target.value) })}
            />
          </label>
          <button
            type="button"
            onClick={() => {
              lectura.current++;
              onChange(null);
            }}
          >
            Quitar foto de fondo
          </button>
        </>
      )}
    </details>
  );
}
