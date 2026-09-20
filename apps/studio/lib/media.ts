/** URL pública de un fichero de `data/media` a partir de su clave relativa (`escudos/<uuid>.webp`). */
export const urlMedia = (clave: string) =>
  `/media/${clave.split("/").map(encodeURIComponent).join("/")}`;
