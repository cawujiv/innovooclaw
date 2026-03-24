cat > /opt/innovooclaw/innovooclaw-start.sh << 'EOF'
#!/bin/bash
# ─── innovooClaw Start (Linux) ────────────────────────────────────────────────
set -euo pipefail

APP_DIR="/opt/innovooclaw"
LOG_DIR="$APP_DIR/logs"
PID_FILE="$LOG_DIR/innovooclaw.pid"

mkdir -p "$LOG_DIR"

echo "================================================"
echo " innovooClaw Start"
echo "================================================"

# ── 1) Alte Instanz prüfen und stoppen ──────────────────────────────────────
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    if kill -0 "$OLD_PID" 2>/dev/null; then
        echo "[1/4] Stoppe alte Instanz (PID $OLD_PID)..."
        kill "$OLD_PID"
        sleep 2
    else
        echo "[1/4] Alte PID-Datei gefunden, Prozess läuft nicht mehr."
    fi
    rm -f "$PID_FILE"
else
    echo "[1/4] Keine laufende Instanz gefunden."
fi

# ── 2) Node.js Server starten ──────────────────────────────────────────────
echo "[2/4] Starte Node.js Server..."
cd "$APP_DIR"
NODE_PATH=$(which node)
nohup "$NODE_PATH" proxy.js >> "$LOG_DIR/node.log" 2>> "$LOG_DIR/node-error.log" &
NODE_PID=$!
echo "$NODE_PID" > "$PID_FILE"
sleep 2

# Prüfen ob Prozess noch läuft
if kill -0 "$NODE_PID" 2>/dev/null; then
    echo "[2/4] Node.js Server gestartet (PID $NODE_PID)"
else
    echo "[2/4] FEHLER: Node.js Server hat sich sofort beendet!"
    echo "      Logs: tail -50 $LOG_DIR/node-error.log"
    exit 1
fi

# ── 3) Caddy Status prüfen ──────────────────────────────────────────────────
echo "[3/4] Prüfe Caddy..."
if systemctl is-active --quiet caddy; then
    echo "[3/4] Caddy läuft (systemd-Service)"
elif command -v caddy &>/dev/null; then
    echo "[3/4] WARNUNG: Caddy installiert aber nicht aktiv!"
    echo "      Start: sudo systemctl start caddy"
else
    echo "[3/4] WARNUNG: Caddy nicht gefunden. HTTPS nicht verfügbar."
fi

# ── 4) Telegram Webhook registrieren ───────────────────────────────────────
echo "[4/4] Telegram Webhook..."
SECRETS_FILE="/opt/mcp-data/secrets/secrets.env"
if [ -f "$SECRETS_FILE" ]; then
    TELEGRAM_TOKEN=$(grep "^TELEGRAM_BOT_TOKEN=" "$SECRETS_FILE" | cut -d= -f2)
    CADDY_DOMAIN=$(grep "^CADDY_DOMAIN=" "$APP_DIR/.env" | cut -d= -f2)
    CADDY_DOMAIN="${CADDY_DOMAIN:-kit-werk.myfritz.link}"

    if [ -n "$TELEGRAM_TOKEN" ]; then
        RESULT=$(curl -s -X POST \
            "https://api.telegram.org/bot${TELEGRAM_TOKEN}/setWebhook" \
            -H "Content-Type: application/json" \
            -d "{\"url\":\"https://${CADDY_DOMAIN}/api/telegram/webhook\",\"allowed_updates\":[\"message\"]}" \
            2>/dev/null)
        if echo "$RESULT" | grep -q '"ok":true'; then
            echo "[4/4] Telegram Webhook registriert"
        else
            echo "[4/4] Telegram Webhook fehlgeschlagen (kein Internet?)"
        fi
    else
        echo "[4/4] TELEGRAM_BOT_TOKEN nicht gefunden, übersprungen."
    fi
fi

# ── Status ──────────────────────────────────────────────────────────────────
echo ""
echo "================================================"
echo " innovooClaw läuft!"
echo "================================================"
echo " Lokal:    http://localhost:3000"
echo " HTTPS:    https://localhost:3443"
echo " Extern:   https://${CADDY_DOMAIN:-kit-werk.myfritz.link}"
echo " Logs:     tail -f $LOG_DIR/node.log"
echo "================================================"
EOF

chmod +x /opt/innovooclaw/innovooclaw-start.sh
