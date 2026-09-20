import { getDocumentProxy } from "unpdf";

/** Coordenadas normalizadas [0,1], origen en esquina superior izquierda. */
export interface FragmentoCalendario {
  texto: string;
  x: number;
  y: number;
}

export interface EquipoCalendario {
  nombre: string;
  codigoFederativo: string;
}

export interface JornadaCalendario {
  numero: number;
  /** Fecha nominal de jornada. NO representa la fecha/hora exacta de cada partido. */
  fechaNominal: string;
  partidos: { local: EquipoCalendario; visitante: EquipoCalendario }[];
}

export interface Calendario {
  competicion: string;
  temporada: string;
  equipos: EquipoCalendario[];
  jornadas: JornadaCalendario[];
}

type Pagina = readonly FragmentoCalendario[];
const MAX_PAGINAS = 20;
const TOLERANCIA_FILA = 0.001;
const limpiar = (texto: string) => texto.normalize("NFC").replace(/\s+/gu, " ").trim();
// Saltos tras un guion no añaden espacios al nombre; nunca dividimos por '-'.
const clave = (texto: string) => limpiar(texto).replace(/\s/gu, "");

function comprobarPagina(pagina: Pagina): FragmentoCalendario[] {
  if (pagina.length > 20_000) throw new Error("Demasiados fragmentos en el calendario");
  for (const f of pagina) {
    if (
      !Number.isFinite(f.x) ||
      !Number.isFinite(f.y) ||
      f.x < 0 ||
      f.x > 1 ||
      f.y < 0 ||
      f.y > 1
    ) {
      throw new Error("Coordenadas del calendario inválidas");
    }
  }
  // La plantilla reserva el 5% inferior para competición/paginación.
  return pagina.filter((f) => f.y < 0.95 && limpiar(f.texto));
}

function lineas(fragmentos: Pagina): FragmentoCalendario[] {
  const filas: FragmentoCalendario[][] = [];
  for (const f of [...fragmentos].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const ultima = filas.at(-1);
    if (ultima && Math.abs(ultima[0]!.y - f.y) <= TOLERANCIA_FILA) ultima.push(f);
    else filas.push([f]);
  }
  return filas.map((fila) => {
    fila.sort((a, b) => a.x - b.x);
    return { x: fila[0]!.x, y: fila[0]!.y, texto: limpiar(fila.map((f) => f.texto).join(" ")) };
  });
}

function identificacion(filas: Pagina): Pick<Calendario, "competicion" | "temporada"> {
  const temporadas = filas.filter((f) => /Temporada\b/u.test(f.texto));
  const datos =
    temporadas.length === 1
      ? temporadas[0]!.texto.match(/^(.+?)\s+Temporada\s+(\d{4})-(\d{4})$/u)
      : null;
  if (!datos || Number(datos[3]) !== Number(datos[2]) + 1) {
    throw new Error("Competición o temporada ausente o incoherente");
  }
  return { competicion: datos[1]!, temporada: `${datos[2]}-${datos[3]}` };
}

function cabecera(pagina: Pagina): Omit<Calendario, "jornadas"> {
  const filas = lineas(comprobarPagina(pagina));
  if (!filas.some((f) => f.texto === "Calendario de Competiciones")) {
    throw new Error("No se reconoce Calendario de Competiciones");
  }
  const datos = identificacion(filas);
  const inicio = filas.findIndex((f) => f.texto === "Equipos Participantes");
  const primerEquipo = filas.findIndex((f, i) => i > inicio && /^\d+\.-/u.test(f.texto));
  if (inicio < 0 || primerEquipo < 0) throw new Error("Catálogo de equipos ausente");
  const equipos: EquipoCalendario[] = [];
  const nombres = new Set<string>();
  const codigos = new Set<string>();
  for (const fila of filas.slice(primerEquipo)) {
    const m = fila.texto.match(/^(\d+)\.-\s*(.+?)\s+\((\d+)\)$/u);
    if (!m || Number(m[1]) !== equipos.length + 1)
      throw new Error("Catálogo de equipos incompleto");
    const nombre = m[2]!,
      codigoFederativo = m[3]!;
    if (nombres.has(clave(nombre)) || codigos.has(codigoFederativo)) {
      throw new Error("Catálogo de equipos ambiguo o duplicado");
    }
    nombres.add(clave(nombre));
    codigos.add(codigoFederativo);
    equipos.push({ nombre, codigoFederativo });
  }
  if (equipos.length < 2 || equipos.length > 40 || equipos.length % 2 !== 0) {
    throw new Error("Número de equipos no soportado (liga par de 2 a 40)");
  }
  return { ...datos, equipos };
}

function fechaNominal(texto: string, temporada: string): string {
  const [dia, mes, anio] = texto.split("-").map(Number) as [number, number, number];
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  if (
    fecha.getUTCFullYear() !== anio ||
    fecha.getUTCMonth() !== mes - 1 ||
    fecha.getUTCDate() !== dia ||
    !temporada.split("-").includes(String(anio))
  ) {
    throw new Error("Fecha nominal inválida o fuera de temporada");
  }
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function partidos(fragmentos: Pagina, equipos: EquipoCalendario[]): JornadaCalendario["partidos"] {
  const cantidad = equipos.length / 2;
  // El separador de partidos ocupa una misma abscisa. Un guion dentro del
  // nombre no sirve de delimitador, aunque PDF.js lo extraiga por separado.
  const guiones = fragmentos.filter((f) => /^-(?:\s|$)/u.test(limpiar(f.texto)));
  const columnas: FragmentoCalendario[][] = [];
  for (const guion of guiones) {
    const grupo = columnas.find((g) => Math.abs(g[0]!.x - guion.x) <= TOLERANCIA_FILA);
    if (grupo) grupo.push(guion);
    else columnas.push([guion]);
  }
  const candidatas = columnas.filter((g) => g.length === cantidad);
  if (candidatas.length !== 1) throw new Error("Cantidad o separación de partidos inconsistente");
  const separadores = candidatas[0]!.sort((a, b) => a.y - b.y);
  // PDF.js también puede fusionar "- Visitante" en un único fragmento.
  // Solo extraemos ese primer guion tras identificar la columna separadora;
  // el resto del nombre se resuelve íntegro contra el catálogo.
  const contenido = [...fragmentos];
  for (const separador of separadores) {
    const resto = limpiar(separador.texto).slice(1).trim();
    if (resto) contenido.push({ ...separador, texto: resto, x: separador.x + TOLERANCIA_FILA / 2 });
  }
  const catalogo = new Map(equipos.map((e) => [clave(e.nombre), e]));
  const usados = new Set<string>();
  return separadores.map((separador, i) => {
    if (i > 0 && separador.y - separadores[i - 1]!.y <= TOLERANCIA_FILA) {
      throw new Error("Partidos superpuestos o duplicados");
    }
    const desde = i === 0 ? -Infinity : (separadores[i - 1]!.y + separador.y) / 2;
    const hasta = i === cantidad - 1 ? Infinity : (separador.y + separadores[i + 1]!.y) / 2;
    const fila = contenido.filter((f) => f !== separador && f.y > desde && f.y <= hasta);
    const izquierda = fila.filter((f) => f.x < separador.x);
    const derecha = fila.filter((f) => f.x > separador.x);
    if (izquierda.length + derecha.length !== fila.length) throw new Error("Partido ambiguo");
    const resolver = (lado: Pagina) =>
      catalogo.get(
        clave(
          lineas(lado)
            .map((f) => f.texto)
            .join(" "),
        ),
      );
    const local = resolver(izquierda),
      visitante = resolver(derecha);
    if (!local || !visitante) throw new Error("Partido incompleto o equipo desconocido");
    if (
      local === visitante ||
      usados.has(local.codigoFederativo) ||
      usados.has(visitante.codigoFederativo)
    ) {
      throw new Error("Equipo duplicado en jornada");
    }
    usados.add(local.codigoFederativo);
    usados.add(visitante.codigoFederativo);
    return { local, visitante };
  });
}

function leerJornadas(pagina: Pagina, calendario: Calendario): void {
  const contenido = comprobarPagina(pagina);
  if (contenido.some((f) => /Calendario de Competiciones|Temporada/u.test(f.texto))) {
    const datos = identificacion(lineas(contenido));
    if (datos.competicion !== calendario.competicion || datos.temporada !== calendario.temporada) {
      throw new Error("Competición o temporada distinta entre páginas");
    }
  }
  let leidas = 0;
  for (const derecha of [false, true]) {
    const columna = contenido.filter((f) => f.x >= 0.5 === derecha);
    const filas = lineas(columna);
    const cabeceras = filas.filter((f) => /^Jornada\b/u.test(f.texto));
    for (const [i, encabezado] of cabeceras.entries()) {
      const m = encabezado.texto.match(/^Jornada\s+(\d+)\s+\((\d{2}-\d{2}-\d{4})\)$/u);
      if (!m) throw new Error("Cabecera de jornada inválida");
      const numero = Number(m[1]);
      const vuelta = calendario.equipos.length - 1;
      if (
        numero < 1 ||
        numero > vuelta * 2 ||
        numero > vuelta !== derecha ||
        calendario.jornadas.some((j) => j.numero === numero)
      ) {
        throw new Error("Jornadas duplicadas o inconsistentes con las vueltas");
      }
      const fin = cabeceras[i + 1]?.y ?? 0.95;
      const fragmentos = columna.filter(
        (f) => f.y > encabezado.y + TOLERANCIA_FILA && f.y < fin - TOLERANCIA_FILA,
      );
      calendario.jornadas.push({
        numero,
        fechaNominal: fechaNominal(m[2]!, calendario.temporada),
        partidos: partidos(fragmentos, calendario.equipos),
      });
      leidas++;
    }
  }
  if (!leidas) throw new Error("Calendario incompleto: página sin jornadas");
}

function validar(calendario: Calendario): Calendario {
  const vuelta = calendario.equipos.length - 1;
  if (calendario.jornadas.length !== vuelta * 2)
    throw new Error("Calendario incompleto: faltan jornadas");
  calendario.jornadas.sort((a, b) => a.numero - b.numero);
  const orientados = new Set<string>();
  const paresPorVuelta = [new Set<string>(), new Set<string>()];
  for (const [i, jornada] of calendario.jornadas.entries()) {
    if (jornada.numero !== i + 1) throw new Error("Jornadas no consecutivas");
    if (i > 0 && jornada.fechaNominal < calendario.jornadas[i - 1]!.fechaNominal) {
      throw new Error("Fechas nominales de jornadas desordenadas");
    }
    for (const p of jornada.partidos) {
      const codigos = [p.local.codigoFederativo, p.visitante.codigoFederativo];
      const ordenado = codigos.join(":");
      const par = codigos.sort().join(":");
      const pares = paresPorVuelta[i < vuelta ? 0 : 1]!;
      if (orientados.has(ordenado) || pares.has(par))
        throw new Error("Cruce duplicado o vuelta sin invertir localía");
      orientados.add(ordenado);
      pares.add(par);
    }
  }
  // Con n/2 partidos, n equipos distintos por jornada y n-1 jornadas por
  // vuelta, la unicidad de pares garantiza todos los cruces y sus inversos.
  return calendario;
}

/** Parser puro de la plantilla de dos columnas. Ignora anexos posteriores al calendario completo. */
export function parsearCalendario(paginas: readonly Pagina[]): Calendario {
  if (paginas.length < 2 || paginas.length > MAX_PAGINAS)
    throw new Error("Número de páginas no soportado (2 a 20)");
  const calendario: Calendario = { ...cabecera(paginas[0]!), jornadas: [] };
  const total = (calendario.equipos.length - 1) * 2;
  for (const pagina of paginas.slice(1)) {
    if (calendario.jornadas.length === total) break;
    leerJornadas(pagina, calendario);
  }
  return validar(calendario);
}

/** Lee solo catálogo y jornadas; no extrae ni devuelve los anexos de contactos. */
export async function parsearCalendarioPdf(bytes: Uint8Array): Promise<Calendario> {
  if (!bytes.byteLength) throw new Error("El PDF está vacío");
  if (bytes.byteLength > 15 * 1024 * 1024) throw new Error("El PDF supera 15 MiB");
  // PDF.js puede transferir el buffer: conservar el del llamante.
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  try {
    if (pdf.numPages < 2 || pdf.numPages > MAX_PAGINAS)
      throw new Error("Número de páginas no soportado (2 a 20)");
    const extraer = async (numero: number): Promise<FragmentoCalendario[]> => {
      const pagina = await pdf.getPage(numero);
      const vista = pagina.getViewport({ scale: 1 });
      if (vista.rotation !== 0) throw new Error("Plantilla girada no soportada");
      const contenido = await pagina.getTextContent();
      return contenido.items.flatMap((item) => {
        if (!("str" in item) || !item.str.trim()) return [];
        const x = item.transform[4],
          y = item.transform[5];
        if (x === undefined || y === undefined) throw new Error("Coordenadas PDF incompletas");
        const [vx, vy] = vista.convertToViewportPoint(x, y);
        if (vx === undefined || vy === undefined) throw new Error("Coordenadas PDF incompletas");
        return [{ texto: item.str, x: vx / vista.width, y: vy / vista.height }];
      });
    };
    const calendario: Calendario = { ...cabecera(await extraer(1)), jornadas: [] };
    const total = (calendario.equipos.length - 1) * 2;
    for (let n = 2; n <= pdf.numPages && calendario.jornadas.length < total; n++) {
      leerJornadas(await extraer(n), calendario);
    }
    return validar(calendario);
  } finally {
    await pdf.loadingTask.destroy();
  }
}
