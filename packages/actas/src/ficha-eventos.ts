import type {
  CambioFicha,
  EquipoFicha,
  Fragmento,
  JugadorFicha,
  Lado,
  TarjetaFicha,
} from "./ficha-tipos";
import type { MarcaFicha } from "./iconos";
import { agruparFilas, ancla, exigir, seccion } from "./ficha-geometria";

function nombre(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase().replace(/\s+/g, " ").trim();
}
function plantilla(e: EquipoFicha) {
  return [...e.titulares, ...e.suplentes];
}
export function equipoDeAutor(
  autor: string,
  local: EquipoFicha,
  visitante: EquipoFicha,
): Lado | null {
  const izq = plantilla(local).filter((j) => nombre(j.nombre) === nombre(autor));
  const der = plantilla(visitante).filter((j) => nombre(j.nombre) === nombre(autor));
  if (izq.length === 1 && der.length === 0) return "local";
  if (der.length === 1 && izq.length === 0) return "visitante";
  return null;
}
export function evento(linea: string): { autor: string; minuto: string } {
  const m = exigir(
    /^(.+?)\s*\((\d{1,3})(?:['’]?\+(\d{1,2}))?['’]?\)$/u.exec(linea),
    "Evento no reconocido",
  );
  return {
    autor: exigir(m[1], "Autor vacío"),
    minuto: exigir(m[2], "Minuto vacío") + (m[3] ? `+${m[3]}` : ""),
  };
}
function marcasDeFila(fila: Fragmento, marcas: readonly MarcaFicha[], lado: Lado) {
  return marcas.filter(
    (m) => (lado === "local" ? m.x < 0.5 : m.x >= 0.5) && Math.abs(m.y - fila.y) < 0.0045,
  );
}
export function leerTarjetas(
  items: readonly Fragmento[],
  lado: Lado,
  equipo: EquipoFicha,
  marcas: readonly MarcaFicha[],
): TarjetaFicha[] {
  const inicio = ancla(items, "TARJETAS");
  const tecnicos = seccion(items, "CUERPO TÉCNICO", "SUSTITUCIONES").map(nombre);
  const filas = agruparFilas(items.filter((i) => i.y > inicio.y + 0.0025));
  const candidatas = marcas.filter(
    (m) =>
      (lado === "local" ? m.x < 0.5 : m.x >= 0.5) &&
      m.y > inicio.y &&
      m.tipo !== "entra" &&
      m.tipo !== "sale",
  );
  for (const marca of candidatas) {
    if (filas.filter((f) => Math.abs(marca.y - f.y) < 0.0045).length !== 1)
      throw new Error("Icono de tarjeta sin texto asociado o con asociación ambigua");
  }
  return filas.map((fila) => {
    const datos = evento(fila.texto);
    const iconos = marcasDeFila(fila, marcas, lado).filter(
      (m) => m.tipo === "amarilla" || m.tipo === "roja" || m.tipo === "desconocida",
    );
    let tipo: TarjetaFicha["tipo"] = "desconocido";
    if (iconos.length === 1 && (iconos[0]?.tipo === "amarilla" || iconos[0]?.tipo === "roja"))
      tipo = iconos[0].tipo;
    if (
      iconos.length === 2 &&
      iconos.some((m) => m.tipo === "amarilla") &&
      iconos.some((m) => m.tipo === "roja")
    )
      tipo = "doble_amarilla";
    const esJugador =
      plantilla(equipo).filter((j) => nombre(j.nombre) === nombre(datos.autor)).length === 1;
    const esTecnico = tecnicos.includes(nombre(datos.autor));
    return {
      ...datos,
      equipo: lado,
      tipo,
      destinatario:
        esJugador && !esTecnico ? "jugador" : esTecnico && !esJugador ? "tecnico" : "desconocido",
    };
  });
}
function jugador(linea: string, equipo: EquipoFicha): JugadorFicha {
  const m = exigir(/^(\d{1,3})\s+(.+)$/.exec(linea), "Jugador de sustitución no reconocido");
  const encontrados = plantilla(equipo).filter(
    (j) => j.dorsal === Number(m[1]) && nombre(j.nombre) === nombre(exigir(m[2], "Nombre vacío")),
  );
  if (encontrados.length !== 1) throw new Error("Sustitución no coincide con la convocatoria");
  return exigir(encontrados[0], "Jugador no encontrado");
}
export function leerCambios(
  items: readonly Fragmento[],
  lado: Lado,
  equipo: EquipoFicha,
  marcas: readonly MarcaFicha[],
): CambioFicha[] {
  const ini = ancla(items, "SUSTITUCIONES").y,
    fin = ancla(items, "TARJETAS").y;
  const filas = agruparFilas(items.filter((i) => i.y > ini + 0.0025 && i.y < fin - 0.0025));
  if (filas.length % 2) throw new Error("Sustitución incompleta");
  const cambios: CambioFicha[] = [];
  for (let i = 0; i < filas.length; i += 2) {
    const entrada = exigir(filas[i], "Entrada ausente"),
      salida = exigir(filas[i + 1], "Salida ausente");
    const datos = evento(salida.texto);
    const entra = jugador(entrada.texto, equipo),
      sale = jugador(datos.autor, equipo);
    if (entra.dorsal === sale.dorsal) throw new Error("Sustitución del mismo jugador");
    const flechasEntrada = marcasDeFila(entrada, marcas, lado).filter(
      (m) => m.tipo === "entra" || m.tipo === "sale",
    );
    const flechasSalida = marcasDeFila(salida, marcas, lado).filter(
      (m) => m.tipo === "entra" || m.tipo === "sale",
    );
    if (
      flechasEntrada.some((m) => m.tipo !== "entra") ||
      flechasSalida.some((m) => m.tipo !== "sale")
    )
      throw new Error("Dirección de sustitución inconsistente");
    cambios.push({ equipo: lado, minuto: datos.minuto, entra, sale });
  }
  return cambios;
}
