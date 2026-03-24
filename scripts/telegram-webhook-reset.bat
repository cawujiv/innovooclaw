@echo off
set TOKEN=8674561606:AAF374rGFoFuHid6IyqgqtPFeItxm1dLmmw
set WEBHOOK_URL=https://kit-werk.myfritz.link/api/telegram/webhook

echo ════════════════════════════════════════
echo  Schritt 1: Webhook LOESCHEN
echo ════════════════════════════════════════
powershell -Command "$r = Invoke-RestMethod -Uri 'https://api.telegram.org/bot%TOKEN%/deleteWebhook?drop_pending_updates=true' -Method GET; Write-Host ('deleteWebhook: ok=' + $r.ok + ' | ' + $r.description)"

echo Warte 3 Sekunden...
timeout /t 3 /nobreak > nul

echo.
echo ════════════════════════════════════════
echo  Schritt 2: Webhook NEU SETZEN
echo ════════════════════════════════════════
powershell -Command "$r = Invoke-RestMethod -Uri 'https://api.telegram.org/bot%TOKEN%/setWebhook' -Method POST -ContentType 'application/json' -Body '{\"url\":\"%WEBHOOK_URL%\",\"allowed_updates\":[\"message\"],\"drop_pending_updates\":true,\"max_connections\":1}'; Write-Host ('setWebhook: ok=' + $r.ok + ' | ' + $r.description)"

echo.
echo ════════════════════════════════════════
echo  Schritt 3: Status pruefen
echo ════════════════════════════════════════
powershell -Command "$r = Invoke-RestMethod 'https://api.telegram.org/bot%TOKEN%/getWebhookInfo'; $w=$r.result; Write-Host ('URL:     ' + $w.url); Write-Host ('Fehler:  ' + $w.last_error_message); Write-Host ('Pending: ' + $w.pending_update_count)"

echo.
echo ════════════════════════════════════════
echo  JETZT: Neue Nachricht in Telegram senden!
echo  (nicht eine alte - eine komplett neue)
echo ════════════════════════════════════════
pause
