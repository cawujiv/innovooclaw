cat > /opt/innovooclaw/innovooclaw-stop.sh << 'EOF'
#!/bin/bash
PID_FILE="/opt/innovooclaw/logs/innovooclaw.pid"

echo "Stoppe innovooClaw..."

if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        kill "$PID"
        # Auf sauberes Beenden warten (max 10 Sekunden)
        for i in $(seq 1 10); do
            if ! kill -0 "$PID" 2>/dev/null; then
                break
            fi
            sleep 1
        done
        # Falls noch aktiv: hart beenden
        if kill -0 "$PID" 2>/dev/null; then
            kill -9 "$PID"
            echo "Prozess $PID wurde hart beendet (SIGKILL)."
        else
            echo "innovooClaw gestoppt (PID $PID)."
        fi
    else
        echo "Prozess $PID läuft nicht mehr."
    fi
    rm -f "$PID_FILE"
else
    # Fallback: per pgrep suchen
    PIDS=$(pgrep -f "node proxy.js" 2>/dev/null || true)
    if [ -n "$PIDS" ]; then
        echo "Keine PID-Datei, stoppe via pgrep: $PIDS"
        kill $PIDS
    else
        echo "Keine laufende Instanz gefunden."
    fi
fi
EOF

chmod +x /opt/innovooclaw/innovooclaw-stop.sh
