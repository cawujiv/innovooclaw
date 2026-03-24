@echo off
:: ─── Telegram Webhook-Status prüfen ──────────────────────────────────────────
set TOKEN=8674561606:AAF374rGFoFuHid6IyqgqtPFeItxm1dLmmw

echo Telegram Bot Info:
powershell -Command ^
  "$r = Invoke-RestMethod 'https://api.telegram.org/bot%TOKEN%/getMe'; Write-Host ('Bot: ' + $r.result.first_name + ' (@' + $r.result.username + ')')"

echo.
echo Webhook Status:
powershell -Command ^
  "$r = Invoke-RestMethod 'https://api.telegram.org/bot%TOKEN%/getWebhookInfo'; $w = $r.result; Write-Host ('URL:           ' + $w.url); Write-Host ('Ausstehend:    ' + $w.pending_update_count + ' Updates'); Write-Host ('Letzter Fehler: ' + $w.last_error_message)"

pause
