@echo off
echo ================================================
echo  innovooClaw Verbindungs-Diagnose
echo ================================================
echo.

echo [1] innovooClaw Server (localhost:3000)...
powershell -Command "try { $r = Invoke-RestMethod 'http://localhost:3000/api/status' -TimeoutSec 3; Write-Host '  OK - Server laeuft' -ForegroundColor Green; Write-Host ('  Agents: ' + ($r.agents -join ', ')) } catch { Write-Host '  FEHLER: Server nicht erreichbar!' -ForegroundColor Red; Write-Host '  Loesung: node proxy.js starten' }"
echo.

echo [2] Slack-Konfiguration...
powershell -Command "try { $r = Invoke-RestMethod 'http://localhost:3000/api/slack/status' -TimeoutSec 3; if ($r.configured) { Write-Host '  OK - Bot-Token und Webhook konfiguriert' -ForegroundColor Green } else { Write-Host '  WARNUNG: Slack nicht vollstaendig konfiguriert' -ForegroundColor Yellow; Write-Host ('  webhook: ' + $r.webhook + ', bot_token: ' + $r.bot_token) } } catch { Write-Host '  FEHLER: Konnte Slack-Status nicht abrufen' -ForegroundColor Red }"
echo.

echo [3] Caddy Prozess...
powershell -Command "if (Get-Process caddy -ErrorAction SilentlyContinue) { Write-Host '  OK - Caddy laeuft' -ForegroundColor Green } else { Write-Host '  FEHLER: Caddy laeuft nicht!' -ForegroundColor Red; Write-Host '  Loesung: caddy run --config Caddyfile' }"
echo.

echo [4] Externe URL (via Caddy)...
powershell -Command "try { $r = Invoke-RestMethod 'https://kit-werk.myfritz.link/api/status' -TimeoutSec 5; Write-Host '  OK - Extern erreichbar!' -ForegroundColor Green } catch { $err = $_.Exception.Message; if ($err -match '400') { Write-Host '  400: Caddy laeuft aber Zertifikat fehlt noch (Port 80 in Fritz!Box freigeben)' -ForegroundColor Yellow } elseif ($err -match '502') { Write-Host '  502: Caddy laeuft aber innovooClaw nicht erreichbar' -ForegroundColor Red } elseif ($err -match 'konnte keine Verbindung') { Write-Host '  Keine Verbindung: Fritz!Box-Portweiterleitung fehlt (Port 80+443)' -ForegroundColor Red } else { Write-Host ('  Fehler: ' + $err) -ForegroundColor Red } }"
echo.

echo [5] Telegram Bot...
powershell -Command "try { $r = Invoke-RestMethod 'https://api.telegram.org/bot8674561606:AAF374rGFoFuHid6IyqgqtPFeItxm1dLmmw/getWebhookInfo' -TimeoutSec 5; $url = $r.result.url; $pending = $r.result.pending_update_count; $err = $r.result.last_error_message; if ($url) { Write-Host ('  Webhook: ' + $url) -ForegroundColor Green; Write-Host ('  Ausstehend: ' + $pending + ' | Letzter Fehler: ' + $err) } else { Write-Host '  Kein Webhook gesetzt - scripts\telegram-webhook-set.bat ausfuehren' -ForegroundColor Yellow } } catch { Write-Host ('  Fehler: ' + $_.Exception.Message) -ForegroundColor Red }"
echo.

echo ================================================
pause
