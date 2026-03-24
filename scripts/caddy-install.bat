@echo off
:: ─── Caddy installieren (Windows) ────────────────────────────────────────────
cd /d C:\Users\Manfred\Documents\MCP-DATA\innovooClaw

echo ================================================
echo  Caddy Installation
echo ================================================

:: Methode 1: winget mit korrektem Package-Namen
echo [1] Versuche winget...
winget install --id=CaddyServer.Caddy -e --accept-package-agreements --accept-source-agreements 2>nul
if %ERRORLEVEL% EQU 0 (
    echo OK - Caddy via winget installiert.
    goto :test
)

:: Methode 2: Direkter Download der aktuellen Version
echo [2] winget fehlgeschlagen - lade Caddy direkt herunter...
powershell -Command ^
  "Write-Host 'Lade Caddy v2.10.2...'; [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/caddyserver/caddy/releases/download/v2.10.2/caddy_2.10.2_windows_amd64.zip' -OutFile '%TEMP%\caddy.zip' -UseBasicParsing; Write-Host 'Entpacke...'; Expand-Archive -Path '%TEMP%\caddy.zip' -DestinationPath 'C:\caddy' -Force; Write-Host 'Fertig.'"

:: caddy.exe in PATH einfügen (für aktuelle Session)
set PATH=%PATH%;C:\caddy
echo [2] Caddy nach C:\caddy\ entpackt.

:test
echo.
echo [3] Teste caddy...
caddy version
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo FEHLER: caddy.exe nicht im PATH.
    echo Bitte C:\caddy\ zum System-PATH hinzufügen:
    echo   Windows-Taste → "Umgebungsvariablen" → Path → Neu → C:\caddy
    pause
    exit /b 1
)

echo.
echo ================================================
echo  Caddy ist installiert! Starte Reverse Proxy...
echo ================================================
echo.
echo Stelle sicher dass port 80+443 in der Fritz!Box
echo auf diesen PC weitergeleitet werden.
echo.
echo Starte Caddy...
caddy run --config Caddyfile
pause
