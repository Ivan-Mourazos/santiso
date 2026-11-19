param([Parameter(Mandatory)][string]$Sha,[string]$Motivo='Despliegue solicitado',
    [string]$Repo,[string]$Bandeja,[int]$EsperaMinutos=60)
# `$PSScriptRoot` puede llegar vacío a los valores por defecto de `param`: se resuelve aquí.
$aqui=if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
if (!$Repo) { $Repo=Split-Path (Split-Path $aqui) }
. "$aqui\comun.ps1"
if (!$Bandeja) { $Bandeja="$Repo\.movil" }
if ($Sha -notmatch '^[0-9a-f]{7,40}$') { throw 'Indique un SHA de Git' }
[IO.Directory]::CreateDirectory("$Bandeja\solicitudes") | Out-Null
$completo=Nativo git @('-C',$Repo,'rev-parse','--verify',"$Sha^{commit}") "$Bandeja\solicitar.log" -Salida
$id=[guid]::NewGuid().ToString()

GuardarJson "$Bandeja\solicitudes\$id.json" @{ id=$id; sha=$completo; motivo=$Motivo }
Write-Host "Solicitud $id enviada."
$ruta="$Bandeja\recibos\$id.json"
$limite=(Get-Date).AddMinutes($EsperaMinutos)
while (!(Test-Path -LiteralPath $ruta)) {
    if ((Get-Date) -ge $limite) { throw "Sigue pendiente. Consulte $ruta y $Bandeja\estado.json" }
    Start-Sleep 2
}
$r=LeerJson $ruta
if ($r.id -cne $id) { throw 'Recibo incorrecto' }
if ($r.log -and (Test-Path -LiteralPath $r.log)) { Get-Content -LiteralPath $r.log -Encoding UTF8 }
Write-Host "$($r.resultado) - $($r.detalle)"
if ($r.resultado -ne 'ok') { exit 1 }
