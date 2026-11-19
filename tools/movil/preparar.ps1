# Compilacion en un proceso separado para mantener la vigilancia.
param([Parameter(Mandatory)]$Raiz,[Parameter(Mandatory)]$Repo,
    [ValidateSet('a','b')]$Slot,[ValidatePattern('^[0-9a-f]{40}$')]$Sha,
    [ValidateSet('a','b','ninguno')]$Activo='ninguno',[switch]$Offline,[string]$Log)
. "$PSScriptRoot\comun.ps1"
function RutaAbsoluta($Ruta) {
    [IO.Path]::GetFullPath($ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Ruta)).TrimEnd('\')
}
$Raiz=RutaAbsoluta $Raiz
$Repo=RutaAbsoluta $Repo
$dir=Join-Path $Raiz "slots\$Slot"
$app=Join-Path $dir 'apps\studio'
$next=Join-Path $app '.next'
$temp=Join-Path $env:TEMP ("santiso-build-"+[guid]::NewGuid())
try {
    $bloqueo=[IO.File]::Open("$Raiz\build.lock","OpenOrCreate","ReadWrite","None")
    if ($Slot -eq $Activo) { throw 'Slot en uso' }
    $top=Nativo git @('-C',$dir,'rev-parse','--show-toplevel') $Log -Salida
    if ((RutaAbsoluta $top) -ne (RutaAbsoluta $dir)) { throw 'Worktree incorrecto' }
    $comunRepo=Nativo git @('-C',$Repo,'rev-parse','--path-format=absolute','--git-common-dir') $Log -Salida
    $comunSlot=Nativo git @('-C',$dir,'rev-parse','--path-format=absolute','--git-common-dir') $Log -Salida
    if ((RutaAbsoluta $comunSlot) -ne (RutaAbsoluta $comunRepo)) { throw 'Slot de otro repositorio' }
    if (Test-Path "$app\.env.local") { Remove-Item -LiteralPath "$app\.env.local" }
    Nativo git @('-C',$dir,'checkout','--force','--detach',$Sha) $Log
    Set-Location -LiteralPath $dir
    $env:STUDIO_RFGF_AUTO='0'
    $env:STUDIO_COPIA_DIARIA='0'
    $env:STUDIO_ACCESO='1'
    $env:SANTISO_DATA_DIR=$temp
    $env:CI='true'
    New-Item -ItemType Directory $temp | Out-Null
    $argsInstall=@('install','--frozen-lockfile')
    if ($Offline) { $argsInstall+='--offline' }
    Nativo pnpm.cmd $argsInstall $Log
    if (Test-Path $next) {
        foreach ($item in Get-ChildItem -LiteralPath $next -Force) {
            if ($item.Name -eq 'cache') { continue }
            if ($item.DirectoryName -ne $next -and $item.Parent.FullName -ne $next) { throw 'Ruta inesperada' }
            Remove-Item -LiteralPath $item.FullName -Recurse -Force
        }
    }
    Set-Location -LiteralPath $app
    Nativo node.exe @('node_modules\next\dist\bin\next','build','--webpack') $Log
    $static=Join-Path $next 'static'
    $propios=@(foreach ($tipo in 'chunks','css','media') {
        if (Test-Path "$static\$tipo") {
            Get-ChildItem "$static\$tipo" -File -Recurse | ForEach-Object { $_.FullName.Substring($static.Length+1) }
        }
    })
    [IO.File]::WriteAllLines("$dir\estaticos-propios.txt",[string[]]$propios)
    if ($Activo -ne 'ninguno' -and (Test-Path -LiteralPath "$Raiz\slots\$Activo\estaticos-propios.txt" -PathType Leaf)) {
        $prev=Join-Path $Raiz "slots\$Activo"
        foreach ($rel in [IO.File]::ReadAllLines("$prev\estaticos-propios.txt")) {
            # Solo se rechaza un segmento «..» entero: rutas como `media\[...clave]` son legítimas.
            if ($rel -notmatch '^(chunks|css|media)\\' -or $rel -match '(^|\\)\.\.(\\|$)' -or $rel -match ':') { throw 'Manifiesto incorrecto' }
            $dest=Join-Path $static $rel
            if (!(Test-Path -LiteralPath $dest)) {
                [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($dest)) | Out-Null
                [IO.File]::Copy("$prev\apps\studio\.next\static\$rel",$dest)
            }
        }
    }
} catch { if ($Log) { Add-Content -LiteralPath $Log -Encoding UTF8 -Value $_.Exception.Message }; Write-Output $_.Exception.Message; exit 1 }
finally {
    if ($bloqueo) { $bloqueo.Dispose() }
    if ([IO.Path]::GetDirectoryName($temp) -eq $env:TEMP.TrimEnd('\') -and (Test-Path $temp)) {
        Remove-Item -LiteralPath $temp -Recurse -Force
    }
}


