@echo off
:: ─── Simuliert eine Telegram-Nachricht direkt an localhost:3000 ───────────────
:: Damit sehen wir in der Node.js-Konsole was passiert

echo ════════════════════════════════════════════
echo  TEST 1: Webhook lokal simulieren (/start)
echo ════════════════════════════════════════════
powershell -Command ^
  "$body = '{\"update_id\":123456,\"message\":{\"message_id\":1,\"from\":{\"id\":8557984309,\"first_name\":\"Manfred\"},\"chat\":{\"id\":8557984309,\"type\":\"private\"},\"text\":\"/start\"}}'; $r = Invoke-RestMethod -Uri 'http://localhost:3000/api/telegram/webhook' -Method POST -ContentType 'application/json' -Body $body; Write-Host ('Antwort: ' + ($r | ConvertTo-Json))"

echo.
echo ════════════════════════════════════════════
echo  TEST 2: Einfache Nachricht simulieren
echo ════════════════════════════════════════════
powershell -Command ^
  "$body = '{\"update_id\":123457,\"message\":{\"message_id\":2,\"from\":{\"id\":8557984309,\"first_name\":\"Manfred\"},\"chat\":{\"id\":8557984309,\"type\":\"private\"},\"text\":\"Hallo OTTO\"}}'; $r = Invoke-RestMethod -Uri 'http://localhost:3000/api/telegram/webhook' -Method POST -ContentType 'application/json' -Body $body; Write-Host ('Antwort: ' + ($r | ConvertTo-Json))"

echo.
echo ════════════════════════════════════════════
echo  TEST 3: Telegram-Test-Endpunkt
echo ════════════════════════════════════════════
powershell -Command ^
  "try { $r = Invoke-RestMethod 'http://localhost:3000/api/telegram/test'; Write-Host ('ok=' + $r.ok + ' | result=' + ($r.result | ConvertTo-Json -Compress)) } catch { Write-Host ('FEHLER: ' + $_.Exception.Message) }"

echo.
echo ════════════════════════════════════════════
echo  TEST 4: Webhook bei Telegram neu registrieren
echo ════════════════════════════════════════════
powershell -Command ^
  "$r = Invoke-RestMethod -Uri 'https://api.telegram.org/bot8674561606:AAF374rGFoFuHid6IyqgqtPFeItxm1dLmmw/setWebhook' -Method POST -ContentType 'application/json' -Body '{\"url\":\"https://kit-werk.myfritz.link/api/telegram/webhook\",\"allowed_updates\":[\"message\"],\"drop_pending_updates\":true}'; Write-Host ('Webhook: ok=' + $r.ok + ' | ' + $r.description)"

echo.
echo ════════════════════════════════════════════
echo  TEST 5: Webhook-Status + letzter Fehler
echo ════════════════════════════════════════════
powershell -Command ^
  "$r = Invoke-RestMethod 'https://api.telegram.org/bot8674561606:AAF374rGFoFuHid6IyqgqtPFeItxm1dLmmw/getWebhookInfo'; $w=$r.result; Write-Host ('URL:     ' + $w.url); Write-Host ('Fehler:  ' + $w.last_error_message); Write-Host ('Pending: ' + $w.pending_update_count)"

echo.
echo ► Schaue jetzt in die Node.js-Konsole (proxy.js Fenster)!
echo ► Dort sollten die Debug-Zeilen [Telegram] erscheinen.
pause
