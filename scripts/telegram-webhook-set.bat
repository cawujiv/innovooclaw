@echo off
:: ─── Telegram Webhook registrieren ───────────────────────────────────────────
:: Einmalig ausführen nachdem Caddy/HTTPS läuft

set TOKEN=8674561606:AAF374rGFoFuHid6IyqgqtPFeItxm1dLmmw
set WEBHOOK_URL=https://kit-werk.myfritz.link/api/telegram/webhook

echo Registriere Telegram Webhook...
echo URL: %WEBHOOK_URL%
echo.

powershell -Command ^
  "$r = Invoke-RestMethod -Uri 'https://api.telegram.org/bot%TOKEN%/setWebhook' -Method POST -ContentType 'application/json' -Body ('{\"url\":\"%WEBHOOK_URL%\",\"allowed_updates\":[\"message\",\"callback_query\"],\"drop_pending_updates\":true}'); Write-Host ('Ergebnis: ' + ($r | ConvertTo-Json))"

echo.
echo Aktuellen Webhook-Status prüfen:
powershell -Command ^
  "$r = Invoke-RestMethod 'https://api.telegram.org/bot%TOKEN%/getWebhookInfo'; Write-Host ($r | ConvertTo-Json -Depth 5)"

pause
