"use client";

import Link from "next/link";
import { useStudio } from "@/components/studio/StudioContext";
import NuestrosPartidos from "./NuestrosPartidos";
import styles from "./Inicio.module.css";

interface Destino {
  texto: string;
  href: string;
  /** Solo del administrador. */
  admin?: boolean;
  /** Solo existe con el acceso por contraseña encendido. */
  conSesion?: boolean;
}

interface Categoria {
  id: string;
  titulo: string;
  para: string;
  icono: string;
  destinos: Destino[];
}

/**
 * Debajo de nuestros partidos, la portada va por tareas: cada fila es una categoría y dentro
 * están sus pantallas. Una categoría con un solo destino entra directa.
 */
const CATEGORIAS: Categoria[] = [
  {
    id: "preparar",
    titulo: "Preparar partido",
    para: "Convocatoria y once",
    icono: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 19a6 6 0 0 1 12 0M17 8v6M14 11h6",
    destinos: [
      { texto: "Convocatoria", href: "/admin/convocatoria" },
      { texto: "Once inicial", href: "/admin/alineacion" },
    ],
  },
  {
    id: "despues",
    titulo: "Tras el partido",
    para: "Resultado y acta",
    icono: "M5 4h14v16H5ZM8 9h8M8 13h8M8 17h5",
    destinos: [
      { texto: "Resultado y acta de la jornada", href: "/admin/partidos" },
      { texto: "Importar acta o resultados", href: "/admin/importar" },
      { texto: "Calendario completo", href: "/admin/importar-jornada?origen=calendario" },
    ],
  },
  {
    id: "federacion",
    titulo: "Federación",
    para: "Traer resultados, actas y datos",
    icono: "M4 20h16M6 20V10M10 20V10M14 20V10M18 20V10M3 10l9-6 9 6Z",
    destinos: [{ texto: "Federación", href: "/admin/federacion", admin: true }],
  },
  {
    id: "carteles",
    titulo: "Carteles",
    para: "Para Instagram",
    icono: "M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1ZM4 16l4.5-4.5 3.5 3.5 3-3 5 5M9 9h.01",
    destinos: [
      { texto: "Partido", href: "/admin/carteles?plantilla=partido", admin: true },
      { texto: "Próximos", href: "/admin/carteles?plantilla=proximos", admin: true },
      { texto: "Resumo", href: "/admin/carteles?plantilla=resumo", admin: true },
      { texto: "Cronoloxía", href: "/admin/carteles?plantilla=cronoloxia", admin: true },
      { texto: "O noso 11", href: "/admin/carteles?plantilla=noso11", admin: true },
      { texto: "Clasificación", href: "/admin/carteles?plantilla=clasificacion", admin: true },
      { texto: "Anuncio", href: "/admin/carteles?plantilla=multiusos", admin: true },
    ],
  },
  {
    id: "multas",
    titulo: "Multas",
    para: "Apuntar y cobrar",
    icono: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM15 9.5a3.5 3.5 0 1 0 0 5M8 11h5M8 13.5h5",
    destinos: [{ texto: "Multas", href: "/admin/multas" }],
  },
  {
    id: "liga",
    titulo: "La liga",
    para: "Tabla, goles y tarjetas",
    icono: "M5 20V10M12 20V4M19 20v-7",
    destinos: [
      { texto: "Partidos", href: "/admin/partidos" },
      { texto: "Clasificación", href: "/admin/clasificacion" },
      { texto: "Goleadores y tarjetas", href: "/admin/liga" },
      { texto: "Estadísticas", href: "/admin/estadisticas" },
      { texto: "Calendario", href: "/admin/calendario" },
    ],
  },
  {
    id: "plantilla",
    titulo: "Plantilla",
    para: "Jugadores y técnicos",
    icono: "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 19a6 6 0 0 1 12 0M16.5 11a2.5 2.5 0 1 0 0-5M17 14a5 5 0 0 1 5 5",
    destinos: [
      { texto: "Jugadores", href: "/admin/jugadores" },
      { texto: "Cuerpo técnico", href: "/admin/tecnicos" },
      { texto: "Directiva", href: "/admin/directiva" },
    ],
  },
  {
    id: "ajustes",
    titulo: "Ajustes",
    para: "Equipos, logos, usuarios",
    icono: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4",
    destinos: [
      { texto: "Equipos", href: "/admin/equipos" },
      { texto: "Patrocinadores y logos", href: "/admin/patrocinadores" },
      { texto: "Temporadas", href: "/admin/temporadas", admin: true },
      { texto: "Ajustes gráficos", href: "/admin/ajustes-graficos", admin: true },
      { texto: "Usuarios", href: "/admin/usuarios", admin: true, conSesion: true },
      { texto: "Mi cuenta", href: "/admin/cuenta", conSesion: true },
    ],
  },
];

function Icono({ trazo }: { trazo: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={trazo} />
    </svg>
  );
}

const FLECHA = <span className={styles.flecha} aria-hidden="true">›</span>;

/**
 * Portada del Studio: el partido que toca de cada equipo y, debajo, la lista de categorías. Al
 * tocar una se entra en ella (`?menu=`) y se ven sus pantallas.
 */
export default function AdminInicio() {
  const { acceso, params, setParams } = useStudio();
  const tecnico = acceso?.rol === "tecnico";
  const categorias = CATEGORIAS.map((categoria) => ({
    ...categoria,
    destinos: categoria.destinos.filter(
      (destino) => !(tecnico && destino.admin) && !(acceso === null && destino.conSesion),
    ),
  })).filter((categoria) => categoria.destinos.length > 0);
  const abierta = categorias.find((categoria) => categoria.id === params.get("menu"));

  if (abierta) {
    return (
      <section className={styles.inicio} aria-labelledby="inicio-categoria">
        <div className={styles.cabecera}>
          <button type="button" className={styles.volver} onClick={() => setParams({ menu: null })}>
            ‹ Inicio
          </button>
          <h2 id="inicio-categoria" className={styles.titulo}>
            {abierta.titulo}
          </h2>
        </div>
        <div className={styles.lista}>
          {abierta.destinos.map((destino) => (
            <Link
              key={destino.href}
              className={styles.fila}
              href={destino.href}
              transitionTypes={["nav-forward"]}
            >
              <strong>{destino.texto}</strong>
              {FLECHA}
            </Link>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className={styles.inicio} aria-labelledby="inicio-titulo">
      <NuestrosPartidos />
      <h2 id="inicio-titulo" className={styles.titulo}>
        ¿Qué quieres hacer?
      </h2>
      <div className={styles.lista}>
        {categorias.map((categoria) => {
          const contenido = (
            <>
              <Icono trazo={categoria.icono} />
              <span className={styles.filaTexto}>
                <strong>{categoria.titulo}</strong>
                <span>{categoria.para}</span>
              </span>
              {FLECHA}
            </>
          );
          // Con un solo destino no hay nada que elegir: se entra directo.
          return categoria.destinos.length === 1 ? (
            <Link
              key={categoria.id}
              className={styles.fila}
              href={categoria.destinos[0]!.href}
              transitionTypes={["nav-forward"]}
            >
              {contenido}
            </Link>
          ) : (
            <button
              key={categoria.id}
              type="button"
              className={styles.fila}
              onClick={() => setParams({ menu: categoria.id })}
            >
              {contenido}
            </button>
          );
        })}
      </div>
    </section>
  );
}
