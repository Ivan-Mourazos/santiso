param()
. "$PSScriptRoot\comun.ps1"
$Repo=Split-Path (Split-Path $PSScriptRoot)
$padre=Split-Path $Repo
$estable="$padre\santiso-estable"
$Raiz="$padre\santiso-movil"
$Bandeja="$Repo\.movil"
$tarea='SantisoMovilSupervisor'
$Puerto=3100
function EsperarPuertoLibre {
    $intentados=@{}
    while ($true) {
        $ocupantes=@(Oyentes)
        if (!$ocupantes.Count) { return }
        foreach ($numero in $ocupantes) {
            if ($intentados.ContainsKey($numero)) { continue }
            $intentados[$numero]=$true
            try {
                $p=Get-Process -Id $numero -ErrorAction Stop
                # Fijar la identidad antes de consultar CIM o enviar taskkill.
                $null=$p.Handle
                $w=Get-CimInstance Win32_Process -Filter "ProcessId=$numero"
                $rutaEstable=[regex]::Escape($estable)+'(?:[\\/]|["\s]|$)'
                if ($w.ExecutablePath -and [IO.Path]::GetFileName($w.ExecutablePath) -eq 'node.exe' -and
                    $w.CommandLine -and $w.CommandLine.Replace('/','\') -match $rutaEstable -and
                    (@(Oyentes) -contains $numero) -and !$p.HasExited) {
                    DetenerProceso $p
                }
            } catch { Write-Host "No se pudo retirar automaticamente PID $numero. $($_.Exception.Message)" }
            if (@(Oyentes) -contains $numero) {
                Write-Host "Puerto 3100 ocupado por PID $numero. Cierre la ventana Santiso Studio (movil) o, si reconoce ese servidor, finalice el PID en el Administrador de tareas."
                Write-Host 'Esperando a que el puerto quede libre. Pulse Ctrl+C para cancelar.'
            }
        }
        Start-Sleep -Milliseconds 500
    }
}
$inicio=[Environment]::GetFolderPath('Startup')
$antiguos=@(Get-ChildItem $inicio -Filter '*.cmd' -File | Where-Object {
    $texto=[IO.File]::ReadAllText($_.FullName)
    $texto -match 'santiso-estable' -and $texto -match 'start:movil'
})
if ($antiguos.Count -gt 1) { throw 'Hay varios lanzadores de movil en Inicio. Revise sus nombres.' }
foreach ($carpeta in $Raiz,"$Raiz\slots","$Raiz\logs") { [IO.Directory]::CreateDirectory($carpeta) | Out-Null }
if (!(Test-Path "$Raiz\produccion.env")) {
    $lineas=[IO.File]::ReadAllLines("$estable\apps\studio\.env.local") | Where-Object { $_ -notmatch '^\s*(STUDIO_RFGF_AUTO|STUDIO_COPIA_DIARIA)\s*=' }
    [IO.File]::WriteAllLines("$Raiz\produccion.env.tmp",[string[]]$lineas)
    [IO.File]::Move("$Raiz\produccion.env.tmp","$Raiz\produccion.env")
}
$map=Entorno
if ($map.STUDIO_ACCESO -ne '1') { throw 'Revise STUDIO_ACCESO en produccion.env' }
if (!(Test-Path "$Raiz\control.json")) {
    $log="$Raiz\logs\inicial.log"
    $sha=Nativo git @('-C',$estable,'rev-parse','HEAD') $log -Salida
    foreach ($slot in 'a','b') {
        $dir="$Raiz\slots\$slot"
        if (!(Test-Path $dir)) {
            Nativo git @('-C',$Repo,'worktree','add','--detach',$dir,$sha) $log
        }
    }
    Write-Host 'Preparando slot a. El servidor actual sigue atendiendo.'
    $arg="-NoProfile -ExecutionPolicy Bypass -File $(Comillas "$PSScriptRoot\preparar.ps1") -Raiz $(Comillas $Raiz) -Repo $(Comillas $Repo) -Slot a -Sha $sha -Log $(Comillas "$Raiz\logs\inicial.log")"
    $p=[Diagnostics.Process]::Start((InfoProceso (Get-Command powershell.exe).Source $arg $Raiz))
    $p.WaitForExit()
    if ($p.ExitCode) { throw "Fallo al preparar. Consulte $Raiz\logs\inicial.log" }
    GuardarJson "$Raiz\control.json" @{ confirmado=@{slot='a';sha=$sha}; anterior=$null; fase=$null; id=$null; detalle=''; resultado=''; intervencion=$false }
}
$usuario=[Security.Principal.WindowsIdentity]::GetCurrent().Name
$accion=New-ScheduledTaskAction -Execute (Get-Command powershell.exe).Source -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File $(Comillas "$Raiz\supervisor.ps1") -Raiz $(Comillas $Raiz) -Repo $(Comillas $Repo)"
$trigger=New-ScheduledTaskTrigger -AtLogOn -User $usuario
$principal=New-ScheduledTaskPrincipal -UserId $usuario -LogonType Interactive -RunLevel Limited
$opciones=New-ScheduledTaskSettingsSet -Hidden -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$existente=Get-ScheduledTask -TaskName $tarea -ErrorAction SilentlyContinue
if ($existente -and ($existente.Actions.Arguments -ne $accion.Arguments -or $existente.Actions.Execute -ne $accion.Execute)) { throw 'Ya existe otra tarea con ese nombre' }
$c=LeerJson "$Raiz\control.json"
if ($c.fase -and !$c.intervencion) { throw 'Despliegue pendiente. Reintente al terminar.' }
if ($c.intervencion) {
    Write-Host "Intervencion: $($c.detalle). Se reintentara el slot confirmado $($c.confirmado.slot)."
    if ($c.resultado -eq 'fallo_con_migracion') { Write-Host 'Compruebe primero que la base es compatible con el slot confirmado.' }
    if ((Read-Host 'Limpiar la intervencion y reintentar (S/N)') -ne 'S') { Write-Host 'Rescate cancelado.'; return }
    if ($existente -and $existente.State -eq 'Running') {
        Stop-ScheduledTask -TaskName $tarea
        $limite=(Get-Date).AddSeconds(30)
        do {
            Start-Sleep -Milliseconds 250
            $existente=Get-ScheduledTask -TaskName $tarea
            if ((Get-Date) -gt $limite) { throw 'La tarea no se ha detenido. Intervencion conservada.' }
        } while ($existente.State -eq 'Running')
    }
}
if ($existente -and $existente.State -eq 'Running') {
    # Una segunda instalacion identica no interrumpe la vigilancia.
    $cambios=@('comun.ps1','supervisor.ps1','preparar.ps1' | Where-Object {
        (Get-FileHash "$PSScriptRoot\$_").Hash -ne (Get-FileHash "$Raiz\$_").Hash
    })
    if ($cambios.Count) { throw 'Para actualizar scripts detenga primero la tarea entre despliegues.' }
    LeerJson "$Bandeja\estado.json" | Format-List
    return
}
foreach ($f in 'comun.ps1','supervisor.ps1','preparar.ps1') { Copy-Item "$PSScriptRoot\$f" "$Raiz\$f" -Force }
Register-ScheduledTask -TaskName $tarea -Action $accion -Trigger $trigger -Principal $principal -Settings $opciones -Force | Out-Null
EsperarPuertoLibre
if ($c.intervencion) {
    $c.intervencion=$false; $c.detalle=''
    GuardarJson "$Raiz\control.json" $c
}
foreach ($f in $antiguos) { Rename-Item -LiteralPath $f.FullName -NewName ($f.Name+'.desactivado') }
$desde=Get-Date
EsperarPuertoLibre
Start-ScheduledTask -TaskName $tarea
$limite=(Get-Date).AddMinutes(2)
do {
    Start-Sleep 3
    if ((Test-Path "$Bandeja\estado.json") -and (Get-Item "$Bandeja\estado.json").LastWriteTime -ge $desde) {
        $estado=LeerJson "$Bandeja\estado.json"
        Write-Host "$($estado.estado) $($estado.detalle)"
        if ($estado.estado -eq 'activo') { return }
        if ($estado.estado -eq 'intervencion') { throw 'Revise supervisor.log' }
    }
} while ((Get-Date) -lt $limite)
throw 'Supervisor sigue reintentando. Revise estado.json y logs\supervisor.log.'
