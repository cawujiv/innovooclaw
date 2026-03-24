@echo off
:: Simuliert "Vera, dein Status" direkt an localhost
echo Sende: "Vera, dein Status"
powershell -Command ^
  "$body = '{\"update_id\":123460,\"message\":{\"message_id\":5,\"from\":{\"id\":8557984309,\"first_name\":\"Manfred\"},\"chat\":{\"id\":8557984309,\"type\":\"private\"},\"text\":\"Vera, dein Status\"}}'; try { $r = Invoke-RestMethod -Uri 'http://localhost:3000/api/telegram/webhook' -Method POST -ContentType 'application/json' -Body $body -TimeoutSec 90; Write-Host ('Server: ' + ($r | ConvertTo-Json)) } catch { Write-Host ('FEHLER: ' + $_.Exception.Message) }"
echo.
echo Warte 30 Sekunden auf Antwort in Telegram...
echo (Schaue gleichzeitig in die Node.js-Konsole!)
timeout /t 30 /nobreak
pause
