param(
    [string]$Repo=(Join-Path (Split-Path $PSScriptRoot) 'santiso'),
    [string]$Raiz=$PSScriptRoot,[int]$Puerto=3100,
    [ValidateSet('on','off')]$Programadores='on',[string]$Bandeja,
    [switch]$Offline,[switch]$PruebaFalloSalud)
. "$PSScriptRoot\comun.ps1"
$Repo=[IO.Path]::GetFullPath($Repo)
$Raiz=[IO.Path]::GetFullPath($Raiz)
if (!$Bandeja) { $Bandeja="$Repo\.movil" }
if ($PruebaFalloSalud -and ($Puerto -ne 3150 -or $Programadores -ne 'off')) { throw 'Fallo simulado reservado a pruebas' }
$node=(Get-Command node.exe).Source
$control="$Raiz\control.json"
$nombre='Local\SantisoMovilSupervisor'
if ($Puerto -ne 3100) { $nombre+="-$Puerto" }
$mutex=New-Object Threading.Mutex($false,$nombre)
try { $adquirido=$mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $adquirido=$true }
if (!$adquirido) { exit 2 }
function Registrar($Mensaje) {
    $log="$Raiz\logs\supervisor.log"
    if ((Test-Path $log) -and (Get-Item $log).Length -gt 2MB) { Move-Item $log "$log.1" -Force }
    $linea="$(Get-Date -Format o) $Mensaje"
    Add-Content -LiteralPath $log -Value $linea -Encoding UTF8
    if ($script:id) { Add-Content -LiteralPath "$Raiz\logs\$id.log" -Value $linea -Encoding UTF8 }
}
function Guardar { GuardarJson $control $c }
function Estado($Estado,$Detalle='') {
    GuardarJson "$Bandeja\estado.json" @{ estado=$Estado; detalle=$Detalle; confirmado=$c.confirmado; fase=$c.fase; fecha=(Get-Date -Format o); supervisor=$PID }
}
function Terminar($Resultado,$Detalle) {
    # Guardar la decision junto con el confirmado antes de publicar el recibo.
    $c.fase='cerrando'; $c.resultado=$Resultado; $c.detalle=$Detalle; Guardar
    Registrar "$Resultado $Detalle"
    GuardarJson "$Bandeja\recibos\$id.json" @{ id=$id; resultado=$Resultado; detalle=$Detalle; confirmado=$c.confirmado; log="$Raiz\logs\$id.log" }
    [IO.File]::Delete("$Bandeja\solicitudes\$id.procesando")
    $c.fase=$null; $c.id=$null; Guardar
    $script:id=$null
    if ($c.intervencion) { Estado 'intervencion' $Detalle } else { Estado 'activo' $Detalle }
}
function Vigilar {
    if ($c.intervencion) { return }
    $slot=$c.confirmado.slot
    $duenos=@(Oyentes)
    if ($duenos.Count -eq 1 -and (Identificar $duenos[0] (Studio $slot))) {
        if ($script:conocido -ne $duenos[0]) {
            try { $null=ConfirmarSalud $slot; Registrar "Adoptado PID $($duenos[0])" }
            catch { Parar (Studio $slot); throw }
            $script:conocido=$duenos[0]
        }
        $script:intentos=0
        return
    }
    if ($duenos.Count) { throw "Puerto ajeno PID $duenos" }
    if ([DateTime]::UtcNow -lt $script:reintentar) { throw 'Esperando para reintentar arranque' }
    $script:intentos++
    $script:reintentar=[DateTime]::UtcNow.AddSeconds(3*$script:intentos)
    try {
        $script:hijo=Arrancar $slot
        $null=ConfirmarSalud $slot
        $script:conocido=$hijo.Id
        Registrar "Arrancado $slot PID $conocido"
        Estado 'activo'
    } catch {
        if ($script:hijo -and !$script:hijo.HasExited) { DetenerHijo }
        if ($script:intentos -ge 5) { $c.intervencion=$true; $c.detalle=$_.Exception.Message; Guardar; Estado 'intervencion' $c.detalle }
        throw
    }
}
function DetenerHijo {
    if ($script:hijo -and !$script:hijo.HasExited) {
        # Conservar el handle del hijo incluso si aun no abrio el puerto.
        DetenerProceso $hijo
    }
}
function VigilarConRegistro {
    try { Vigilar }
    catch { Registrar $_.Exception.Message; if (!$c.intervencion) { Estado 'esperando' $_.Exception.Message } }
}
function Seguro {
    $hora=Get-Date -Format HHmm
    if (($hora -ge '2058' -and $hora -le '2105') -or ($hora -ge '0008' -and $hora -le '0015')) { return $false }
    $dir=(Entorno)['SANTISO_DATA_DIR']
    if (!(Test-Path -LiteralPath $dir -PathType Container)) { throw 'Directorio de datos ausente' }
    !@(Get-ChildItem -LiteralPath $dir -File | Where-Object {
        ($_.Name -like '*.db' -or $_.Name -like '*-wal') -and $_.LastWriteTimeUtc -gt [DateTime]::UtcNow.AddSeconds(-20)
    }).Count
}
function Desplegar($Peticion) {
    $script:id=$Peticion.BaseName
    $archivo="$Bandeja\solicitudes\$id.procesando"
    if ($Peticion.Extension -eq '.json') { [IO.File]::Move($Peticion.FullName,$archivo) }
    $c.id=$id; $c.fase='preparacion'; Guardar; Estado 'preparacion'
    $viejo=$c.confirmado
    $slot=if ($viejo.slot -eq 'a') {'b'} else {'a'}
    try {
        $p=LeerJson $archivo
        if ($p.id -cne $id -or $p.sha -cnotmatch '^[a-f0-9]{40}$' -or $p.motivo -isnot [string]) { throw 'Solicitud incorrecta' }
        $log="$Raiz\logs\$id.log"
        $rc=0
        Nativo git @('-C',$Repo,'merge-base','--is-ancestor',$p.sha,'main') $log -Codigo ([ref]$rc)
        if ($rc) { throw 'SHA ajeno a main' }
        $argsBuild="-NoProfile -ExecutionPolicy Bypass -File $(Comillas "$PSScriptRoot\preparar.ps1") -Raiz $(Comillas $Raiz) -Repo $(Comillas $Repo) -Slot $slot -Sha $($p.sha) -Activo $($viejo.slot) -Log $(Comillas $log)"
        if ($Offline) { $argsBuild+=' -Offline' }
        $worker=[Diagnostics.Process]::Start((InfoProceso (Get-Command powershell.exe).Source $argsBuild $Raiz))
        while (!$worker.WaitForExit(3000)) { VigilarConRegistro }
        if ($worker.ExitCode) { throw 'Fallo de preparacion. Consulte el log.' }
        $limite=(Get-Date).AddMinutes(15)
        $c.fase='espera'; Guardar; Estado 'espera'
        while (!(Seguro)) {
            if ((Get-Date) -gt $limite) { Terminar 'aplazada' 'No hubo momento seguro'; return }
            Start-Sleep 3; VigilarConRegistro
        }
        if ($c.intervencion) { throw 'Servidor requiere intervencion' }
        $duenos=@(Oyentes)
        if ($duenos.Count -ne 1 -or !(Identificar $duenos[0] (Studio $viejo.slot))) { throw 'Servidor confirmado no disponible' }
        Nativo git @('-C',$Repo,'diff','--quiet',$viejo.sha,$p.sha,'--','packages/db/migrations') $log -Codigo ([ref]$rc)
        if ($rc -notin 0,1) { throw 'No se pudieron comprobar migraciones' }
        $migracion=$rc -ne 0
    } catch { Terminar 'error_preparacion' $_.Exception.Message; return }
    $c.fase='relevo'; Guardar; Estado 'relevo'
    try {
        Parar (Studio $viejo.slot)
        $script:hijo=Arrancar $slot
        $n=ConfirmarSalud $slot
        if ($PruebaFalloSalud) { throw 'Salud fallida por simulacion' }
    } catch {
        $detalle=$_.Exception.Message
        if ($migracion) { $c.intervencion=$true; Terminar 'fallo_con_migracion' $detalle; return }
        try {
            foreach ($ocupante in @(Oyentes)) {
                if (Identificar $ocupante (Studio $slot)) { Parar (Studio $slot) }
            }
            if (!$hijo.HasExited -and $hijo.StartInfo.WorkingDirectory -eq (Studio $slot)) { DetenerHijo }
            if (!@(Oyentes).Count) { $script:hijo=Arrancar $viejo.slot }
            $null=ConfirmarSalud $viejo.slot
        } catch { $c.intervencion=$true; Terminar 'rollback_fallido' $_.Exception.Message; return }
        Terminar 'rollback_ok' $detalle; return
    }
    $c.anterior=$viejo; $c.confirmado=@{ slot=$slot; sha=$p.sha }
    $script:conocido=$hijo.Id
    Terminar 'ok' "$n recursos verificados"
}
try {
    foreach ($dir in "$Bandeja\recibos","$Bandeja\solicitudes","$Raiz\logs") { [IO.Directory]::CreateDirectory($dir) | Out-Null }
    $c=LeerJson $control
    $script:id=$c.id
    $script:reintentar=[DateTime]::MinValue
    $script:intentos=0
    while ($true) {
        try {
            if ($c.fase -eq 'cerrando') { Terminar $c.resultado $c.detalle }
            if ($c.intervencion) { Estado 'intervencion' $c.detalle }
            else {
                if ($c.fase -eq 'relevo') {
                    $otro=if ($c.confirmado.slot -eq 'a') {'b'} else {'a'}
                    foreach ($ocupante in @(Oyentes)) { if (Identificar $ocupante (Studio $otro)) { Parar (Studio $otro) } }
                }
                Vigilar
                if ($c.fase -eq 'preparacion') {
                    # Un compilador puede sobrevivir al supervisor. Esperar a que suelte el slot.
                    $lock=[IO.File]::Open("$Raiz\build.lock","OpenOrCreate","ReadWrite","None")
                    $lock.Dispose()
                }
                if ($c.fase) { Terminar 'interrumpida' 'Recuperado el slot confirmado' }
                else {
                    Estado 'activo'
                    $p=Get-ChildItem "$Bandeja\solicitudes" -File | Where-Object {
                        $_.BaseName -match '^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$' -and $_.Extension -in '.json','.procesando'
                    } | Sort-Object LastWriteTimeUtc | Select-Object -First 1
                    if ($p) {
                        if (Test-Path -LiteralPath "$Bandeja\recibos\$($p.BaseName).json") {
                            [IO.File]::Delete($p.FullName)
                        } else { Desplegar $p }
                    }
                }
            }
        } catch { Registrar $_.Exception.Message; if (!$c.intervencion) { Estado 'esperando' $_.Exception.Message } }
        Start-Sleep 3
    }
} finally { $mutex.ReleaseMutex(); $mutex.Dispose() }

