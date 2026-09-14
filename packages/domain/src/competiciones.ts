import { z } from "zod";

/** Zona de la clasificación (ascenso, descenso, copa…) con su color en carteles. */
export const reglaClasificacionSchema = z.object({
  id: z.string().min(1),
  nombre: z.string().trim().min(1),
  puestos: z.array(z.number().int().positive()).min(1),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
});

export const reglasClasificacionSchema = z.array(reglaClasificacionSchema);

export type ReglaClasificacion = z.infer<typeof reglaClasificacionSchema>;
