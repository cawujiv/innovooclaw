@echo off
cd /d "C:\Users\Manfred\Documents\MCP-DATA\innovooClaw"
echo Stoppe Server...
taskkill /F /FI "WINDOWTITLE eq node*" /IM node.exe 2>nul
timeout /t 1 /nobreak >nul

echo Kopiere neue proxy.js...
powershell -Command "Invoke-WebRequest -Uri 'http://localhost:3000/api/status' -TimeoutSec 2 2>$null | Out-Null; Write-Host 'Server war noch aktiv'" 2>nul

echo FERTIG - bitte proxy_final.js manuell nach proxy.js umbenennen
echo Dann: node proxy.js
pause
