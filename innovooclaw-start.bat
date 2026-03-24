@echo off
cd /d C:\Users\Manfred\Documents\MCP-DATA\innovooClaw

echo ================================================
echo  innovooClaw Start
echo ================================================

:: ── 1) Alte Prozesse stoppen ──────────────────────
taskkill /F /IM node.exe /T 2>nul
taskkill /F /IM caddy.exe /T 2>nul
timeout /t 2 /nobreak >nul

:: ── 2) Node.js Server starten (eigenes Fenster) ───
start "innovooClaw-Node" cmd /k "cd /d C:\Users\Manfred\Documents\MCP-DATA\innovooClaw && node proxy.js"
echo [1/3] Node.js Server gestartet...
timeout /t 3 /nobreak >nul

:: ── 3) Caddy unsichtbar im Hintergrund starten ──
for /f "delims=" %%i in ('where caddy 2^>nul') do set CADDY_PATH=%%i
if not defined CADDY_PATH (
    echo [2/3] WARNUNG: Caddy nicht gefunden!
    goto caddy_done
)
echo [2/3] Caddy gefunden: %CADDY_PATH%
powershell -WindowStyle Hidden -Command "$p = Start-Process -FilePath '%CADDY_PATH%' -ArgumentList @('run','--config','C:\Users\Manfred\Documents\MCP-DATA\innovooClaw\Caddyfile') -WindowStyle Hidden -RedirectStandardOutput 'C:\Users\Manfred\Documents\MCP-DATA\innovooClaw\logs\caddy.log' -RedirectStandardError 'C:\Users\Manfred\Documents\MCP-DATA\innovooClaw\logs\caddy-error.log' -PassThru; if ($p) { $p.Id | Out-File 'C:\Users\Manfred\Documents\MCP-DATA\innovooClaw\logs\caddy.pid' } " 2>nul
echo [2/3] Caddy gestartet (Hintergrund)...
timeout /t 4 /nobreak >nul
:caddy_done

:: ── 4) Telegram Webhook registrieren ─────────────
echo [3/3] Telegram Webhook registrieren...
powershell -Command "$r = Invoke-RestMethod -Uri 'https://api.telegram.org/bot8674561606:AAF374rGFoFuHid6IyqgqtPFeItxm1dLmmw/setWebhook' -Method POST -ContentType 'application/json' -Body '{\"url\":\"https://kit-werk.myfritz.link/api/telegram/webhook\",\"allowed_updates\":[\"message\"],\"drop_pending_updates\":false}' -ErrorAction SilentlyContinue; if ($r.ok) { Write-Host '       Telegram Webhook OK' } else { Write-Host '       Telegram Webhook FEHLER (kein Internet?)' }" 2>nul

:: ── 5) Status anzeigen ────────────────────────────
echo.
echo ================================================
echo  innovooClaw laeuft!
echo ================================================
echo  Lokal:    http://localhost:3000
echo  Extern:   https://kit-werk.myfritz.link
echo  Telegram: verbunden
echo ================================================
echo.
echo  Fenster offen lassen:
echo   - "innovooClaw-Node"  = Node.js Logs
echo   - "innovooClaw-Caddy" = Caddy Logs
echo.
timeout /t 5 /nobreak >nul

:: Dieses Startfenster minimieren
powershell -noprofile -command "$h=(Get-Process -Id $PID).MainWindowHandle; Add-Type -Name U -Namespace W -MemberDefinition '[DllImport(\"user32.dll\")]public static extern bool ShowWindow(IntPtr h,int n);'; [W.U]::ShowWindow($h,2)" 2>nul
