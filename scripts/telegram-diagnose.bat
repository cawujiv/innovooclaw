@echo off
:: ─── Telegram vollständige Diagnose ──────────────────────────────────────────
set TOKEN=8674561606:AAF374rGFoFuHid6IyqgqtPFeItxm1dLmmw
set CHAT_ID=8557984309
set WEBHOOK_URL=https://kit-werk.myfritz.link/api/telegram/webhook

echo ════════════════════════════════════════════
echo  1) Bot-Info
echo ════════════════════════════════════════════
powershell -Command "$r = Invoke-RestMethod 'https://api.telegram.org/bot%TOKEN%/getMe'; Write-Host ('Bot: ' + $r.result.first_name + ' (@' + $r.result.username + ')  ID: ' + $r.result.id)"

echo.
echo ════════════════════════════════════════════
echo  2) Webhook-Status (aktuelle URL + Fehler)
echo ════════════════════════════════════════════
powershell -Command "$r = Invoke-RestMethod 'https://api.telegram.org/bot%TOKEN%/getWebhookInfo'; $w = $r.result; Write-Host ('URL:            ' + $w.url); Write-Host ('Ausstehend:     ' + $w.pending_update_count + ' Updates'); Write-Host ('Letzter Fehler: ' + $w.last_error_message); Write-Host ('Fehler-Zeit:    ' + [DateTimeOffset]::FromUnixTimeSeconds($w.last_error_date).LocalDateTime)"

echo.
echo ════════════════════════════════════════════
echo  3) Webhook neu setzen (drop_pending)
echo ════════════════════════════════════════════
powershell -Command "$r = Invoke-RestMethod -Uri 'https://api.telegram.org/bot%TOKEN%/setWebhook' -Method POST -ContentType 'application/json' -Body '{\"url\":\"%WEBHOOK_URL%\",\"allowed_updates\":[\"message\"],\"drop_pending_updates\":true}'; Write-Host ('Ergebnis: ok=' + $r.ok + '  desc=' + $r.description)"

echo.
echo ════════════════════════════════════════════
echo  4) Test-Nachricht direkt senden
echo ════════════════════════════════════════════
powershell -Command "$r = Invoke-RestMethod -Uri 'https://api.telegram.org/bot%TOKEN%/sendMessage' -Method POST -ContentType 'application/json' -Body ('{\"chat_id\":\"%CHAT_ID%\",\"text\":\"<b>Test</b>: Bot funktioniert!\",\"parse_mode\":\"HTML\"}'); Write-Host ('Gesendet: ok=' + $r.ok + '  msg_id=' + $r.result.message_id)"

echo.
echo ════════════════════════════════════════════
echo  5) innovooClaw Server direkt testen
echo ════════════════════════════════════════════
powershell -Command "try { $r = Invoke-RestMethod 'http://localhost:3000/api/telegram/test'; Write-Host ('Server-Test: ok=' + $r.ok) } catch { Write-Host ('Server NICHT erreichbar: ' + $_.Exception.Message) }"

echo.
pause
