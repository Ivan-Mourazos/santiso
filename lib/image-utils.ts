import { v4 as uuidv4 } from "uuid";

type ImageProcessStage =
  | "starting"
  | "converting_heic"
  | "trimming"
  | "compressing"
  | "done";

type ProgressCallback = (percent: number, stage: ImageProcessStage) => void;

export async function processAndUploadImage(file: File, onProgress?: ProgressCallback): Promise<File | null> {
  // Prevent SSR execution
  if (typeof window === "undefined") return null;
  
  try {
    onProgress?.(5, "starting");
    const heic2any = (await import("heic2any")).default;
    let currentFile = file;

    // 1. Manejar HEIC (iPhone)
    if (file.type === "image/heic" || file.name.toLowerCase().endsWith(".heic")) {
      onProgress?.(15, "converting_heic");
      const convertedBlob = await heic2any({
        blob: file,
        toType: "image/jpeg",
        quality: 0.8,
      });
      
      const blobArray = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
      currentFile = new File([blobArray], file.name.replace(/\.[^/.]+$/, ".jpg"), {
        type: "image/jpeg",
      });
    }

    // 2. Recorte inteligente 1:1
    onProgress?.(35, "trimming");
    currentFile = await trimImageTransparency(currentFile);

    // 3. Compresión (lib pesada cargada bajo demanda, fuera del bundle inicial)
    onProgress?.(60, "compressing");
    const imageCompression = (await import("browser-image-compression")).default;
    const options = {
      maxSizeMB: 0.8, // Menos de 1MB
      maxWidthOrHeight: 1200,
      useWebWorker: true,
      fileType: "image/webp",
    };

    const compressedBlob = await imageCompression(currentFile, options);
    
    // Convertir Blob a File para que Supabase lo acepte bien
    const finalFile = new File([compressedBlob], `${uuidv4()}.webp`, {
      type: "image/webp",
    });

    onProgress?.(100, "done");
    return finalFile;
  } catch (error) {
    console.error("Error procesando imagen:", error);
    return null;
  }
}

/**
 * Detecta bordes de transparencia, recorta el logo y lo centra en un 1:1
 */
async function trimImageTransparency(file: File): Promise<File> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(file);

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;

        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            const alpha = data[(y * canvas.width + x) * 4 + 3];
            if (alpha > 15) { // Tolerancia
              if (x < minX) minX = x;
              if (y < minY) minY = y;
              if (x > maxX) maxX = x;
              if (y > maxY) maxY = y;
            }
          }
        }

        if (maxX <= minX || maxY <= minY) return resolve(file);

        const trimWidth = maxX - minX + 1;
        const trimHeight = maxY - minY + 1;
        // Margen de seguridad (padding) del 5%
        const padding = Math.floor(Math.max(trimWidth, trimHeight) * 0.05);
        const size = Math.max(trimWidth, trimHeight) + (padding * 2);

        const finalCanvas = document.createElement("canvas");
        finalCanvas.width = size;
        finalCanvas.height = size;
        const finalCtx = finalCanvas.getContext("2d");
        if (!finalCtx) return resolve(file);

        // Centrado dinámico
        const offsetX = (size - trimWidth) / 2;
        const offsetY = (size - trimHeight) / 2;

        finalCtx.drawImage(
          img, 
          minX, minY, trimWidth, trimHeight, 
          offsetX, offsetY, trimWidth, trimHeight
        );

        finalCanvas.toBlob((blob) => {
          if (blob) {
            resolve(new File([blob], file.name, { type: "image/webp" }));
          } else {
            resolve(file);
          }
        }, "image/webp", 0.9);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}
