@echo off
:: Caddy als Windows Autostart-Aufgabe einrichten
:: Als Administrator ausführen!

cd /d C:\Users\Manfred\Documents\MCP-DATA\innovooClaw

echo Richte Caddy als Windows-Aufgabe ein...

:: Aufgabe erstellen (startet beim Login, läuft im Hintergrund)
schtasks /create /tn "innovooClaw-Caddy" /tr "caddy run --config \"C:\Users\Manfred\Documents\MCP-DATA\innovooClaw\Caddyfile\"" /sc onlogon /ru "%USERNAME%" /f /rl highest

if %ERRORLEVEL% EQU 0 (
    echo OK - Aufgabe erstellt.
    echo Starte Caddy jetzt...
    schtasks /run /tn "innovooClaw-Caddy"
    timeout /t 2 /nobreak >nul
    echo.
    echo Caddy läuft jetzt und startet automatisch beim nächsten Login.
) else (
    echo FEHLER beim Erstellen der Aufgabe.
    echo Starte Caddy manuell...
    start "Caddy" /min cmd /c "caddy run --config C:\Users\Manfred\Documents\MCP-DATA\innovooClaw\Caddyfile"
)

echo.
echo Test: https://kit-werk.myfritz.link/api/status
pause
