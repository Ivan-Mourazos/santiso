# Compactación móvil de Carteles y calendario propio

Diseño decidido por usuario. Trabajo en `carteles-movil`, desde `main` (`dda149d`), en worktree `../santiso-carteles-movil`.

1. Medir a 360×844 px las siete plantillas y Partidos del Santiso con datos reales, sin guardar. Registrar altura inicial y controles principales.
2. Conservar pestañas Datos/Vista previa y mantenerlas accesibles durante el scroll. Compartir plegados móviles para Instagram, escudos, limpieza y bloques secundarios; mantener DOM de escritorio. Emparejar campos desde 360 px, conservar áreas táctiles de 44 px y fuentes de 16 px.
3. Próximos: tarjetas de una línea que abren edición individual; acciones de preparar y rellenar dentro de primera pantalla. Evitar que varias tarjetas abiertas alarguen el formulario.
4. Calendario propio: seleccionar último finalizado y siguientes; permitir desplegar anteriores sin modificar filas, borradores ni vista Por jornada. Mantener listado completo en escritorio.
5. Regresiones unitarias de corte deportivo; presupuestos por plantilla y fila de calendario, primer dato visible y acciones, e2e móviles actualizadas conservando tamaño/desbordamiento. PNG simulado en interacciones móviles; no Gemini ni escrituras reales.
6. Medir después, inspeccionar capturas, revisar cambios. Puertas `pnpm check`, lectura en 3300 y escritura temporal en 3111, sin servidores dev simultáneos. Esperar puerto compartido si ocupado.
7. Commits pequeños en castellano, informe con medidas y límites, dos capturas fuera de Git. Cerrar servidores. Sin merge ni push.
