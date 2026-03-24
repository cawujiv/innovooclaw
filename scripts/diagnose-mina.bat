@echo off
echo ════════════════════════════════════════════
echo  Diagnose: Welcher Code laeuft auf Port 3000?
echo ════════════════════════════════════════════
echo.

echo [1] Alle Node-Prozesse:
tasklist /FI "IMAGENAME eq node.exe" /FO TABLE

echo.
echo [2] Was hoert auf Port 3000?
netstat -ano | findstr ":3000"

echo.
echo [3] Direkt MINA aufrufen (nicht ueber Telegram):
powershell -Command ^
  "$body = '{\"message\":\"Kontostand bitte\",\"maxTokens\":300}'; $r = Invoke-RestMethod -Uri 'http://localhost:3000/api/agent/mina' -Method POST -ContentType 'application/json' -Body $body -TimeoutSec 60; Write-Host ('Agent: ' + $r.agent); Write-Host ('Reply: ' + $r.reply)"

echo.
echo [4] Telegram Webhook simulieren mit 'mina, Kontostand':
powershell -Command ^
  "$body = '{\"update_id\":999999,\"message\":{\"message_id\":99,\"from\":{\"id\":8557984309,\"first_name\":\"Test\"},\"chat\":{\"id\":8557984309,\"type\":\"private\"},\"text\":\"mina, Kontostand\"}}'; $r = Invoke-RestMethod -Uri 'http://localhost:3000/api/telegram/webhook' -Method POST -ContentType 'application/json' -Body $body; Write-Host ('Webhook OK: ' + ($r | ConvertTo-Json))"

echo.
echo [5] Node.js Konsole zeigt [Telegram] Namenserkennung? (Pruefe manuell!)
echo    Wenn NICHT erscheint: alter Server laeuft noch!
echo.
pause
