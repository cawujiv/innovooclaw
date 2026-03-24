@echo off
echo Stoppe alle Node-Prozesse...
taskkill /F /IM node.exe /T 2>nul
taskkill /F /IM caddy.exe /T 2>nul
timeout /t 2 /nobreak >nul

echo Pruefe Port 3000...
netstat -ano | findstr ":3000" | findstr "LISTENING"
if %ERRORLEVEL% EQU 0 (
    echo PORT 3000 noch belegt! Erzwinge Freigabe...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do taskkill /F /PID %%a 2>nul
    timeout /t 2 /nobreak >nul
)

echo Starte innovooClaw neu...
cd /d C:\Users\Manfred\Documents\MCP-DATA\innovooClaw
start "innovooClaw-Node" cmd /k "node proxy.js"
timeout /t 4 /nobreak >nul

echo Starte Caddy...
for /f "delims=" %%i in ('where caddy 2^>nul') do set CADDY_PATH=%%i
if defined CADDY_PATH (
    powershell -WindowStyle Hidden -Command "Start-Process -FilePath '%CADDY_PATH%' -ArgumentList @('run','--config','C:\Users\Manfred\Documents\MCP-DATA\innovooClaw\Caddyfile') -WindowStyle Hidden -RedirectStandardOutput 'C:\Users\Manfred\Documents\MCP-DATA\innovooClaw\logs\caddy.log' -RedirectStandardError 'C:\Users\Manfred\Documents\MCP-DATA\innovooClaw\logs\caddy-error.log' -PassThru; if ($p) { $p.Id | Out-File 'C:\Users\Manfred\Documents\MCP-DATA\innovooClaw\logs\caddy.pid' }" 2>nul
    echo Caddy gestartet.
)

echo.
echo Neustart abgeschlossen!
echo Pruefe in 10 Sekunden ob MINA antwortet...
timeout /t 10 /nobreak >nul

echo.
echo === MINA Test ===
powershell -Command "$b='{\"message\":\"Kontostand\",\"maxTokens\":800}'; $r=Invoke-RestMethod 'http://localhost:3000/api/agent/mina' -Method POST -ContentType 'application/json' -Body $b -TimeoutSec 60; Write-Host ('Agent:' $r.agent); Write-Host ('Reply:' $r.reply.Substring(0, [Math]::Min(300, $r.reply.Length)))"
echo.
pause
