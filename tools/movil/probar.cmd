@echo off
setlocal
set "SANTISO_PRUEBA=%~dp0..\..\..\_prueba-movil"
powershell.exe -NoProfile -Command "$ErrorActionPreference='Stop'; if (Test-Path -LiteralPath $env:SANTISO_PRUEBA) { if (@(Get-ChildItem -Force -LiteralPath $env:SANTISO_PRUEBA | Where-Object { $_.Name -ne 'logs' -or !$_.PSIsContainer }).Count) { exit 1 } }"
if errorlevel 1 (
    echo ERROR: Revise "%SANTISO_PRUEBA%". Solo se permite la carpeta logs.
    pause
    exit /b 1
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0pruebas.ps1"
set "resultado=%errorlevel%"
if "%resultado%"=="0" (
    echo OK: todas las pruebas han pasado.
) else (
    echo ERROR: pruebas incompletas o fallidas. Revise tambien el mensaje de la consola.
)
echo Log: "%SANTISO_PRUEBA%\logs\pruebas.log"
pause
exit /b %resultado%
