# Despliegue de la copia del móvil — diseño acordado (19/11/2026)

Acordado entre Claude (coordinador), Astra (Codex) y Argon (Gemini). Antecedentes y debate en
`..\_consulta-despliegue\` (propuestas, síntesis y críticas). Este documento manda.

## Problema
La copia del móvil (`next start` en 127.0.0.1:3100, publicada por `tailscale serve`) se actualizaba
compilando encima de lo que servía, se arrancaba desde un `.cmd` de Inicio que luego no se dejaba parar
(«Acceso denegado») y el agente no podía hacerlo solo (Windows Redirection Guard en las junctions de
`node_modules` de otra sesión; el clasificador bloquea `schtasks /create`).

## Piezas
```
Proyectos_Mou\
├── santiso\                         repo de desarrollo (main)
│   ├── .movil\                      (en .gitignore) bandeja agente <-> supervisor
│   │   ├── solicitudes\<uuid>.json  la escribe el agente: { id, sha, motivo }
│   │   ├── recibos\<uuid>.json      la escribe el supervisor: resultado final
│   │   └── estado.json              estado vivo (solo el supervisor)
│   └── tools\movil\                 versionado: supervisor.ps1, instalar.cmd, solicitar.ps1, DISENO.md
└── santiso-movil\                   raíz de ejecución (fuera de git)
    ├── supervisor.ps1               copia instalada (la tarea ejecuta ESTA, no la del repo)
    ├── produccion.env               secretos y SANTISO_DATA_DIR real (sin STUDIO_RFGF_AUTO/COPIA_DIARIA)
    ├── control.json                 confirmado {slot, sha}, anterior, fase pendiente (escritura atómica)
    ├── logs\                        supervisor.log (rotado) y <uuid>.log por despliegue
    └── slots\a\ , slots\b\          dos worktrees git (detached) con su node_modules y apps\studio\.next
```

## Supervisor (`supervisor.ps1`, Windows PowerShell 5.1)
- Lo lanza una **tarea programada ONLOGON** del usuario de Iván, RunLevel Limited, oculta,
  `ExecutionTimeLimit` 0, `MultipleInstances IgnoreNew`, reinicio tras fallo (3 veces, 1 min).
- Mutex con nombre `Local\SantisoMovilSupervisor`: una sola instancia.
- Parámetros (para poder probarlo aislado): `-Raiz`, `-Repo`, `-Puerto` (3100), `-Programadores` (on/off),
  `-Bandeja`.
- **Arranque**: lee `control.json`. Si el puerto lo ocupa un `node.exe` cuyo ejecutable/argumentos son
  exactamente los del slot confirmado y pasa la salud → lo **adopta**. Si lo ocupa el `node` de
  `santiso-estable` (instalación inicial) o uno propio sin salud → lo para. Cualquier otro dueño → no
  toca nada, registra y reintenta más tarde. Si quedó una fase pendiente (corte de luz a mitad de
  relevo) → arranca el slot confirmado y cierra la solicitud como `interrumpida`.
- **Vigilancia**: cada 3 s; si el servidor muere, lo rearranca (espera creciente, máx. 5 intentos
  seguidos y luego estado `intervencion`). La vigilancia sigue durante compilaciones y esperas.
- **Identificar puertos**: `Get-NetTCPConnection` NO existe en este PC. Usar `netstat -ano -p tcp`
  con regex exacta sobre `(?:127\.0\.0\.1|0\.0\.0\.0|\[::1?\]):<puerto>\s+\S+\s+LISTENING\s+(\d+)`, y
  autorizar la parada solo si el PID es el hijo propio (o el `node` de estable en la instalación).
- **Parar**: `taskkill /F /T /PID <pid propio>` + `WaitForExit` + puerto libre comprobado.
- **Arrancar**: `node.exe <slot>\apps\studio\node_modules\next\dist\bin\next start -H 127.0.0.1 -p <puerto>`,
  cwd `<slot>\apps\studio`, entorno: variables de `produccion.env` + `STUDIO_RFGF_AUTO=1`,
  `STUDIO_COPIA_DIARIA=1` (solo si `-Programadores on`). El `.env.local` del slot se escribe desde
  `produccion.env` justo antes de arrancar (nunca durante install/build).
- HTTP siempre con `Invoke-WebRequest -UseBasicParsing` (PS 5.1 en tarea oculta).

## Despliegue (una solicitud)
1. Reclamar `solicitudes\<uuid>.json` (renombrar a `.procesando`), validar formato y que `sha` es
   ancestro de `main` en el repo. Escribir fase en `control.json` y `estado.json`.
2. **Slot inactivo** (el que no es el confirmado): borrar su `.env.local`; `git checkout --force --detach <sha>`;
   `pnpm install --frozen-lockfile` en la raíz del slot; limpiar `apps\studio\.next` salvo `cache\`;
   `next build --webpack` con entorno explícito: `STUDIO_RFGF_AUTO=0`, `STUDIO_COPIA_DIARIA=0`,
   `STUDIO_ACCESO=1`, `SANTISO_DATA_DIR=<temporal>` (si el build necesita la BD, copiar solo el fichero
   SQLite al temporal; sin fotos), sin claves de API.
   Cualquier fallo aquí → recibo `error_preparacion`, el servidor no se toca (corte 0).
3. **Estáticos para pestañas abiertas**: copiar del slot activo a `.next\static` nuevo solo
   `chunks\`, `css\`, `media\` que no existan, y solo los que figuren en el manifiesto de originales
   del build activo (`estaticos-propios.txt`, generado tras cada build). Nunca `static\<BUILD_ID>\`.
4. **Esperar momento seguro**: fuera de 20:58–21:05 y 00:08–00:15, y con los ficheros de la BD
   (`*.db`, `*-wal`) sin modificar en los últimos 20 s (máx. 15 min de espera; luego aplazar).
5. **Relevo**: guardar fase `relevo` en `control.json`; parar el propio; arrancar el slot nuevo.
6. **Salud** (≤30 s, y repetir a los 3 s): proceso vivo; `/entrar` 200 sin redirección; todos los
   `/_next/static/**.(js|css)` que referencia, 200 y no vacíos; `/api/estado` 401; el `BUILD_ID` del
   slot coincide con el que sirve (aparece en el HTML/rutas). OK → `control.json` confirmado=nuevo,
   anterior=viejo; recibo `ok`.
7. **Vuelta atrás**: si falla la salud y **no hay migraciones** entre los dos SHA
   (`packages/db/migrations`), parar y arrancar el slot anterior intacto, misma salud → recibo
   `rollback_ok` o `rollback_fallido` (estado `intervencion`). Si hay migraciones, no se vuelve atrás
   solo: recibo `fallo_con_migracion` y estado `intervencion`.

## Agente
`tools\movil\solicitar.ps1 -Sha <sha>` (o escribir el JSON a mano): crea la solicitud con escritura
atómica (`.tmp` + rename) y espera el recibo con el mismo id, mostrando el log. No necesita push.

## Instalación única (`instalar.cmd`, doble clic de Iván)
Crea `santiso-movil`, copia `supervisor.ps1`, genera `produccion.env` desde
`santiso-estable\apps\studio\.env.local` (quitando las dos variables de programadores), crea los
worktrees `slots\a` y `slots\b` en el SHA de `estable`, instala y compila el slot `a`, registra la tarea,
renombra el `.cmd` de Inicio a `.desactivado`, arranca la tarea (que retira el servidor de
`santiso-estable` y adopta el puerto) y muestra `estado.json`. Si no puede parar el servidor viejo
(«Acceso denegado»), pide cerrar la ventana «Santiso Studio (movil)» y reintenta.
`santiso-estable` queda de respaldo; se retira más adelante con permiso de Iván.
