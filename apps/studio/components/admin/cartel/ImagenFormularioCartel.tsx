import { useId, useState } from "react";
import { Button } from "@/components/ui/foundation/Button";
import styles from "./Formularios.module.css";

export function ImagenFormularioCartel({
  etiqueta,
  subir,
  cambiar = "Cambiar foto",
  url,
  nombre,
  onFile,
  onQuitar,
}: {
  etiqueta: string;
  subir: string;
  cambiar?: string;
  url: string;
  nombre?: string;
  onFile: (file: File) => void | Promise<boolean>;
  onQuitar?: () => void;
}) {
  const id = useId();
  const [errorUrl, setErrorUrl] = useState<string | null>(null);
  const [archivoElegido, setArchivoElegido] = useState("");
  const [preparando, setPreparando] = useState(false);
  const [errorArchivo, setErrorArchivo] = useState(false);
  const error = errorArchivo || Boolean(url && url === errorUrl);

  async function elegir(archivo: File) {
    setErrorArchivo(false);
    const resultado = onFile(archivo);
    if (!resultado) {
      setArchivoElegido(archivo.name);
      return;
    }
    setPreparando(true);
    try {
      setErrorArchivo(!(await resultado));
    } finally {
      setPreparando(false);
    }
  }
  return (
    <fieldset className={styles.grupoEditorial}>
      <legend>{etiqueta}</legend>
      <div className={styles.filaImagen}>
        {url && url !== errorUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- vista previa local
          <img className={styles.miniaturaImagen} src={url} alt="" onError={() => setErrorUrl(url)} />
        )}
        <label className="file-input-label">
          {url ? cambiar : subir}
          <input
            type="file"
            accept="image/*"
            aria-describedby={id}
            disabled={preparando}
            onChange={(e) => {
              const archivo = e.currentTarget.files?.[0];
              e.currentTarget.value = "";
              if (archivo) void elegir(archivo);
            }}
          />
        </label>
        {url && onQuitar && (
          <Button size="sm" variant="danger" onClick={() => {
              setArchivoElegido("");
              onQuitar();
            }} aria-label={`Quitar: ${etiqueta}`}>
            ✕
          </Button>
        )}
      </div>
      <p id={id} className={styles.estadoImagen} data-error={error} role="status">
        {preparando && "Preparando imagen…"}
        {!preparando && error && "No se pudo mostrar la imagen. Elige otro archivo."}
        {!preparando && !error && url && (nombre || archivoElegido || "Imagen seleccionada")}
      </p>
    </fieldset>
  );
}
