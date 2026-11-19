# Funciones compartidas por instalacion, supervisor y pruebas. Windows PowerShell 5.1.
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
function Nativo($Exe,[string[]]$Argumentos,$Log,[switch]$Salida,[ref]$Codigo) {
    # PS 5.1 representa stderr como ErrorRecord. Solo el codigo indica fallo.
    $ErrorActionPreference='Continue'
    if ($Log) { Add-Content -LiteralPath $Log -Encoding UTF8 -ErrorAction Stop -Value ("> $Exe "+($Argumentos -join ' ')) }
    $comando=Get-Command -Name $Exe -CommandType Application -ErrorAction Stop | Select-Object -First 1
    & $comando.Source @Argumentos 2>&1 | ForEach-Object {
        if ($Log) { Add-Content -LiteralPath $Log -Encoding UTF8 -ErrorAction Stop -Value "$_" }
        if ($Salida -and $_ -isnot [Management.Automation.ErrorRecord]) { "$_" }
        elseif (!$Log) { Write-Host "$_" }
    }
    $rc=$LASTEXITCODE
    if ($Log) { Add-Content -LiteralPath $Log -Encoding UTF8 -ErrorAction Stop -Value "Codigo $rc" }
    if ($Codigo) { $Codigo.Value=$rc } elseif ($rc) { throw "$Exe termino con codigo $rc" }
}
function GuardarJson($Ruta,$Valor) {
    $tmp="$Ruta.$([guid]::NewGuid()).tmp"
    try {
        [IO.File]::WriteAllText($tmp,($Valor | ConvertTo-Json -Depth 8))
        for ($i=0; ; $i++) {
            try {
                if ([IO.File]::Exists($Ruta)) { [IO.File]::Replace($tmp,$Ruta,"$tmp.bak") }
                else { [IO.File]::Move($tmp,$Ruta) }
                break
            } catch [IO.IOException] { if ($i -ge 5) { throw }; Start-Sleep -Milliseconds 60 }
        }
    } finally { [IO.File]::Delete($tmp); [IO.File]::Delete("$tmp.bak") }
}
function LeerJson($Ruta) {
    for ($i=0; ; $i++) {
        try { return ([IO.File]::ReadAllText($Ruta) | ConvertFrom-Json) }
        catch [IO.IOException] { if ($i -ge 5) { throw }; Start-Sleep -Milliseconds 60 }
    }
}
function DetenerProceso($Proceso) {
    if (!$Proceso -or $Proceso.HasExited) { return }
    $rc=0
    $logParada=if ($script:id) { "$Raiz\logs\$id.log" } else { "$Raiz\logs\supervisor.log" }
    Nativo taskkill.exe @('/F','/T','/PID',$Proceso.Id) $logParada -Codigo ([ref]$rc)
    if (!$Proceso.WaitForExit(5000)) { throw "PID $($Proceso.Id) sigue activo (taskkill $rc)" }
}
function Comillas($Valor) { '"'+$Valor+'"' }
function Studio($Slot) {
    if ($Slot -notin 'a','b') { throw 'Slot incorrecto' }
    Join-Path $Raiz "slots\$Slot\apps\studio"
}
function Oyentes {
    $lineas=netstat.exe -ano -p tcp
    if ($LASTEXITCODE) { throw 'netstat ha fallado' }
    @($lineas | ForEach-Object {
        if ($_ -match "^\s*TCP\s+\S+:${Puerto}\s+\S+\s+(?:LISTENING|ESCUCHANDO)\s+(\d+)\s*$") { [int]$Matches[1] }
    } | Sort-Object -Unique)
}
function Identificar($Numero,$Directorio) {
    $proceso=Get-CimInstance Win32_Process -Filter "ProcessId=$Numero"
    if (!$proceso -or !$proceso.CommandLine -or $proceso.ExecutablePath -ne $node) { return $false }
    $cli=[regex]::Escape("$Directorio\node_modules\next\dist\bin\next")
    $ejecutable='(?:"'+[regex]::Escape($node)+'"|'+[regex]::Escape($node)+'|"?node(?:\.exe)?"?)'
    $linea=$proceso.CommandLine.Replace('/','\').Replace('\node_modules\.bin\\..\next\','\node_modules\next\').Replace('\node_modules\.bin\..\next\','\node_modules\next\')
    return $linea -match "^\s*$ejecutable\s+(?:`"$cli`"|$cli)\s+start\s+-H\s+127\.0\.0\.1\s+-p\s+$Puerto\s*$"
}
function Parar($Directorio) {
    foreach ($numero in @(Oyentes)) {
        $p=Get-Process -Id $numero -ErrorAction SilentlyContinue
        if (!$p -or $p.HasExited) { continue }
        try { $null=$p.Handle } catch { if ($p.HasExited) { continue }; throw }
        if (!(Identificar $numero $Directorio)) { if ($p.HasExited) { continue }; throw "Puerto ocupado por PID ajeno $numero" }
        DetenerProceso $p
    }
    if (@(Oyentes).Count) { throw 'Puerto ocupado tras parada' }
}
function Entorno {
    $map=@{}
    foreach ($linea in [IO.File]::ReadAllLines("$Raiz\produccion.env")) {
        if ($linea -match '^\s*(?:#.*)?$') { continue }
        if ($linea -notmatch '^\s*([A-Za-z_][A-Za-z_0-9]*)\s*=\s*(.*?)\s*$') { throw 'Linea incorrecta en produccion.env' }
        $clave=$Matches[1]; $valor=$Matches[2]
        if ($valor -match '^"(.*)"$' -or $valor -match "^'(.*)'$") { $valor=$Matches[1] }
        $map[$clave]=$valor
    }
    if (![IO.Path]::IsPathRooted($map['SANTISO_DATA_DIR'])) { throw 'Falta ruta absoluta en SANTISO_DATA_DIR' }
    $map
}
function InfoProceso($Archivo,$Argumentos,$Carpeta) {
    $info=New-Object Diagnostics.ProcessStartInfo
    $info.FileName=$Archivo
    $info.Arguments=$Argumentos
    $info.WorkingDirectory=$Carpeta
    $info.UseShellExecute=$false
    $info.CreateNoWindow=$true
    # Tanto el compilador como el servidor parten de un entorno conocido.
    $info.EnvironmentVariables.Clear()
    foreach ($k in 'SystemRoot','windir','ComSpec','PATH','PATHEXT','TEMP','TMP','USERPROFILE','HOMEDRIVE','HOMEPATH','APPDATA','LOCALAPPDATA','ProgramFiles','ProgramFiles(x86)','ProgramData','NUMBER_OF_PROCESSORS','PROCESSOR_ARCHITECTURE','USERNAME','USERDOMAIN','PNPM_HOME','SystemDrive','ProgramW6432','CommonProgramFiles','CommonProgramFiles(x86)','CommonProgramW6432','PSModulePath','COMPUTERNAME','FNM_DIR','FNM_MULTISHELL_PATH','NVM_HOME','NVM_SYMLINK','VOLTA_HOME') {
        $v=[Environment]::GetEnvironmentVariable($k)
        if ($v) { $info.EnvironmentVariables[$k]=$v }
    }
    $info
}
function Arrancar($Slot) {
    $app=Studio $Slot
    if (@(Oyentes).Count) { throw 'Puerto ocupado al arrancar' }
    # Tras un reinicio puede quedar vivo un node propio que aun no ha hecho listen.
    # Solo retirar procesos con ejecutable y argumentos exactos de estos dos slots.
    foreach ($otro in Get-CimInstance Win32_Process -Filter "Name='node.exe'") {
        if ($otro.CommandLine -notlike "*$Raiz\slots\*") { continue }
        $proceso=Get-Process -Id $otro.ProcessId -ErrorAction SilentlyContinue
        if (!$proceso) { continue }
        try { $null=$proceso.Handle } catch { if ($proceso.HasExited) { continue }; throw }
        if (!(Identificar $proceso.Id (Studio 'a')) -and !(Identificar $proceso.Id (Studio 'b'))) { continue }
        if (@(Oyentes).Count) { throw 'Un servidor ha empezado a escuchar; se verificara en la siguiente pasada' }
        DetenerProceso $proceso
    }
    if (@(Oyentes).Count) { throw 'Puerto ocupado antes de crear proceso' }
    Copy-Item -LiteralPath "$Raiz\produccion.env" -Destination "$app\.env.local" -Force
    $info=InfoProceso $node ("{0} start -H 127.0.0.1 -p {1}" -f (Comillas "$app\node_modules\next\dist\bin\next"),$Puerto) $app
    $map=Entorno
    foreach ($k in $map.Keys) { $info.EnvironmentVariables[$k]=$map[$k] }
    $valor=if ($Programadores -eq 'on') {'1'} else {'0'}
    foreach ($k in 'STUDIO_RFGF_AUTO','STUDIO_COPIA_DIARIA') { $info.EnvironmentVariables[$k]=$valor }
    [Diagnostics.Process]::Start($info)
}
function Salud($Slot,$Limite) {
    $base="http://127.0.0.1:$Puerto"
    function Descargar($Ruta) {
        $resto=[int][Math]::Floor(($Limite-[DateTime]::UtcNow).TotalSeconds)
        if ($resto -lt 1) { throw 'Tiempo de salud agotado' }
        Invoke-WebRequest -UseBasicParsing -Uri ($base+$Ruta) -TimeoutSec ([Math]::Min($resto,5)) -MaximumRedirection 0
    }
    $duenos=@(Oyentes)
    if ($duenos.Count -ne 1 -or !(Identificar $duenos[0] (Studio $Slot))) { throw 'Servidor aun sin escucha propia' }
    $html=(Descargar '/entrar')
    $id=[IO.File]::ReadAllText("$(Studio $Slot)\.next\BUILD_ID").Trim()
    if ($html.StatusCode -ne 200 -or !$id -or !$html.Content.Contains($id)) { throw 'HTML con BUILD_ID incorrecto' }
    $urls=@([regex]::Matches($html.Content,'/_next/static/[^"''<>\s\\?]+?\.(?:js|css)(?=["''?\\<>\s])') | ForEach-Object Value | Sort-Object -Unique)
    if (!$urls.Count) { throw 'Sin recursos estaticos' }
    foreach ($url in $urls) {
        $r=Descargar $url
        if ($r.StatusCode -ne 200 -or ($r.RawContentStream.Length -le 0 -and !$r.Content.Length)) { throw "Recurso vacio: $url" }
    }
    try { $null=Descargar '/api/estado'; throw 'API sin proteccion' }
    catch { if (!$_.Exception.Response -or [int]$_.Exception.Response.StatusCode -ne 401) { throw } }
    return $urls.Count
}
function ConfirmarSalud($Slot) {
    $limite=[DateTime]::UtcNow.AddSeconds(30)
    do {
        try {
            $null=Salud $Slot $limite
            Start-Sleep -Seconds 3
            return (Salud $Slot ([DateTime]::UtcNow.AddSeconds(30)))
        } catch { $fallo=$_.Exception.Message; Start-Sleep -Milliseconds 300 }
    } while ([DateTime]::UtcNow -lt $limite)
    throw $fallo
}
