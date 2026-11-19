# Prueba integral en una raiz desechable. Ejecutar como usuario normal.
param([switch]$SoloPuertoAjeno)
. "$PSScriptRoot\comun.ps1"
$Repo=Split-Path (Split-Path $PSScriptRoot)
$Raiz=Join-Path (Split-Path $Repo) '_prueba-movil'
$Bandeja="$Raiz\bandeja"
$Puerto=3150
$Programadores='off'
$node=(Get-Command node.exe).Source
if (@(Oyentes).Count) { throw '3150 ya ocupado' }
if ((Test-Path $Raiz) -and @(Get-ChildItem $Raiz -Force | Where-Object Name -ne 'logs').Count) { throw "La raiz no esta vacia: $Raiz" }
foreach ($dir in 'slots','logs','data','bandeja\solicitudes') { [IO.Directory]::CreateDirectory("$Raiz\$dir") | Out-Null }
$logGit="$Raiz\logs\pruebas.log"
function Esperar($Condicion,$Segundos=90) {
    $limite=(Get-Date).AddSeconds($Segundos)
    do { if (& $Condicion) { return }; Start-Sleep -Milliseconds 250 } while ((Get-Date) -lt $limite)
    throw "Tiempo agotado esperando $Condicion"
}
function Supervisor([switch]$Fallar) {
    $argsSup="-NoProfile -ExecutionPolicy Bypass -File $(Comillas "$PSScriptRoot\supervisor.ps1") -Raiz $(Comillas $Raiz) -Repo $(Comillas $Repo) -Puerto 3150 -Programadores off -Bandeja $(Comillas $Bandeja) -Offline"
    if ($Fallar) { $argsSup+=' -PruebaFalloSalud' }
    $script:super=[Diagnostics.Process]::Start((InfoProceso (Get-Command powershell.exe).Source $argsSup $Raiz))
}
function PararSupervisor {
    if ($super -and !$super.HasExited) { $super.Kill(); $super.WaitForExit() }
}
function Peticion($Revision) {
    $clave=[guid]::NewGuid().ToString()
    GuardarJson "$Bandeja\solicitudes\$clave.json" @{id=$clave; sha=$Revision; motivo='Prueba automatica'}
    return $clave
}
function ComprobarRecibo($Clave,$Resultado) {
    $ruta="$Bandeja\recibos\$Clave.json"
    Esperar { Test-Path $ruta } 1800
    $r=LeerJson $ruta
    if ($r.resultado -ne $Resultado -or $r.id -ne $Clave) { throw "Esperado $Resultado. Recibido $($r.resultado) $($r.detalle)" }
}
function ComprobarSlot($Slot) {
    $c=LeerJson "$Raiz\control.json"
    if ($c.confirmado.slot -ne $Slot) { throw "Confirmado incorrecto: $($c.confirmado.slot)" }
    $n=ConfirmarSalud $Slot
    "Salud $Slot verificada, $n recursos JS/CSS" | Out-Host
    @(Oyentes)[0]
}
function EsperarActivo {
    Esperar {
        if (!(Test-Path "$Bandeja\estado.json")) { return $false }
        $e=LeerJson "$Bandeja\estado.json"
        $e.estado -eq 'activo' -and $e.supervisor -eq $super.Id
    }
}
function Informe($Texto) { Add-Content "$Raiz\logs\pruebas.log" "$(Get-Date -Format o) $Texto" -Encoding UTF8; Write-Host $Texto }
function Vigia {
    # Observador independiente. Registra intervalo entre muestras y cada fallo HTTP.
    $script:job=Start-Job -ArgumentList $PSScriptRoot,$Raiz -ScriptBlock {
        param($scripts,$carpeta)
        . "$scripts\comun.ps1"
        $Puerto=3150
        while ($true) {
            $ids=@(Oyentes)
            if ($ids.Count -gt 1) { Add-Content "$carpeta\logs\solapamiento.log" ($ids -join ',') }
            $ok=$false
            try { $ok=(Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3150/entrar -MaximumRedirection 0 -TimeoutSec 2).StatusCode -eq 200 } catch {}
            Add-Content "$carpeta\logs\muestras.csv" ("{0},{1},{2}" -f [DateTime]::UtcNow.Ticks,[int]$ok,($ids -join '+'))
            Start-Sleep -Milliseconds 80
        }
    }
    Esperar { Test-Path "$Raiz\logs\muestras.csv" }
}
function Medida($Desde) {
    $muestras=@(Get-Content "$Raiz\logs\muestras.csv" | ForEach-Object {
        $t,$ok,$num=$_ -split ','
        if ([long]$t -ge $Desde) { [pscustomobject]@{t=[long]$t; ok=$ok; numero=$num} }
    })
    $cota=0; $ultimo=$null
    foreach ($m in $muestras) {
        if ($m.ok -ne '1') { continue }
        if ($ultimo -and $ultimo.numero -ne $m.numero) { $cota=[Math]::Max($cota,($m.t-$ultimo.t)/10000.0) }
        $ultimo=$m
    }
    if (!$cota) { throw 'Sin muestras a ambos lados del relevo' }
    "corte <= $cota ms entre respuestas correctas"
}
try {
    $sha=Nativo git @('-C',$Repo,'rev-parse','main') $logGit -Salida
    if ($sha -notmatch '^[a-f0-9]{40}$') { throw 'main incorrecta' }
    [IO.File]::Copy("$Repo\data\santiso.db","$Raiz\data\santiso.db")
    [IO.File]::WriteAllLines("$Raiz\produccion.env",@('STUDIO_ACCESO=1',"SANTISO_DATA_DIR=$Raiz\data"))
    GuardarJson "$Raiz\control.json" @{confirmado=@{slot='a';sha=$sha};anterior=$null;fase=$null;id=$null;detalle='';resultado='';intervencion=$false}
    # Ejecutar primero el escenario que no necesita ninguna compilacion.
    $ajeno=[Diagnostics.Process]::Start((InfoProceso $node '-e "require(''net'').createServer().listen(3150,''127.0.0.1'')"' $Raiz))
    Esperar { @(Oyentes) -contains $ajeno.Id }
    Supervisor
    Esperar { (Test-Path "$Raiz\logs\supervisor.log") -and (Select-String -LiteralPath "$Raiz\logs\supervisor.log" -SimpleMatch "Puerto ajeno PID $($ajeno.Id)" -Quiet) }
    if ($ajeno.HasExited -or @(Oyentes).Count -ne 1) { throw 'El proceso ajeno no se conservo' }
    Informe '8 OK. PID ajeno conservado y registrado'
    PararSupervisor
    $ajeno.Kill(); $ajeno.WaitForExit()
    if (!$SoloPuertoAjeno) {
        foreach ($slot in 'a','b') {
            Nativo git @('-C',$Repo,'worktree','add','--detach',"$Raiz\slots\$slot",$sha) $logGit
        }
        $argsBuild="-NoProfile -ExecutionPolicy Bypass -File $(Comillas "$PSScriptRoot\preparar.ps1") -Raiz $(Comillas $Raiz) -Repo $(Comillas $Repo) -Slot a -Sha $sha -Offline -Log $(Comillas "$Raiz\logs\inicial-prueba.log")"
        $compilador=[Diagnostics.Process]::Start((InfoProceso (Get-Command powershell.exe).Source $argsBuild $Raiz))
        $compilador.WaitForExit()
        if ($compilador.ExitCode) { throw 'Instalacion inicial fallida. Consulte inicial-prueba.log' }
        Vigia
        Supervisor; EsperarActivo
        $a=ComprobarSlot 'a'
        Informe "1 OK. PID $a"
        $desde=[DateTime]::UtcNow.Ticks
        ComprobarRecibo (Peticion $sha) 'ok'
        $b=ComprobarSlot 'b'
        Informe "2 OK. PID $b. $(Medida $desde)"
        ComprobarRecibo (Peticion ('0'*40)) 'error_preparacion'
        if ((ComprobarSlot 'b') -ne $b) { throw 'Cambio de PID tras SHA invalido' }
        Informe '3 OK. Mismo PID'
        PararSupervisor; Supervisor -Fallar; EsperarActivo
        $desde=[DateTime]::UtcNow.Ticks
        ComprobarRecibo (Peticion $sha) 'rollback_ok'
        $b=ComprobarSlot 'b'
        Informe "4 OK. PID $b. $(Medida $desde)"
        Parar (Studio 'b')
        Esperar { $ids=@(Oyentes); $ids.Count -eq 1 -and $ids[0] -ne $b }
        $b=ComprobarSlot 'b'; Informe "5 OK. Rearranque PID $b"
        PararSupervisor; Supervisor; EsperarActivo
        if ((ComprobarSlot 'b') -ne $b) { throw 'No adopto el proceso' }
        Informe "6 OK. Adoptado PID $b"
        PararSupervisor; Parar (Studio 'b')
        $c=LeerJson "$Raiz\control.json"
        $c.fase='relevo'; $c.id=[guid]::NewGuid().ToString(); GuardarJson "$Raiz\control.json" $c
        $candidato=Arrancar 'a'; $null=ConfirmarSalud 'a'
        Supervisor; ComprobarRecibo $c.id 'interrumpida'
        $b=ComprobarSlot 'b'; Informe "7 OK. Recuperado PID $b"
        if ($job.State -ne 'Running' -or (Test-Path "$Raiz\logs\solapamiento.log")) { throw 'Fallo del observador o multiples oyentes' }
    }
} catch { Informe "ERROR: $($_.Exception.Message)"; throw }
finally {
    PararSupervisor
    if ($job) { Stop-Job $job; Remove-Job $job }
    if ($ajeno -and !$ajeno.HasExited) { $ajeno.Kill(); $ajeno.WaitForExit() }
    foreach ($num in @(Oyentes)) {
        foreach ($s in 'a','b') { if (Identificar $num (Studio $s)) { Parar (Studio $s) } }
    }
    foreach ($s in 'a','b') {
        if (Test-Path "$Raiz\slots\$s\.git") {
            $rc=0
            Nativo git @('-c','core.longpaths=true','-C',$Repo,'worktree','remove','--force',"$Raiz\slots\$s") $logGit -Codigo ([ref]$rc)
            if ($rc) {
                $listado=Nativo git @('-C',$Repo,'worktree','list','--porcelain') $logGit -Salida
                if ($listado -contains ("worktree "+("$Raiz\slots\$s").Replace('\','/'))) { throw "No se pudo retirar el slot $s" }
            }
        }
    }
    foreach ($item in Get-ChildItem -LiteralPath $Raiz -Force) {
        if ($item.Name -eq 'logs') { continue }
        if ([IO.Path]::GetDirectoryName($item.FullName) -ne $Raiz -or $Raiz -ne (Join-Path (Split-Path $Repo) '_prueba-movil')) { throw 'Ruta no autorizada' }
        Remove-Item -LiteralPath $item.FullName -Recurse -Force
    }
    Nativo git @('-C',$Repo,'worktree','list') $logGit -Salida
}


