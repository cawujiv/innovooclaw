cat > /opt/innovooclaw/scripts/diagnose.sh << 'EOF'
#!/bin/bash
# Schnelldiagnose für innovooClaw
BASE="http://localhost:3000"

echo "═══════════════════════════════════════════════"
echo " innovooClaw Diagnose"
echo "═══════════════════════════════════════════════"

check() {
    local name="$1"
    local url="$2"
    local result
    result=$(curl -sf --max-time 5 "$url" 2>/dev/null)
    if [ $? -eq 0 ]; then
        echo "✅ $name"
        echo "$result" | python3 -m json.tool 2>/dev/null | head -5
    else
        echo "❌ $name — nicht erreichbar"
    fi
    echo "───────────────────────────────────────────────"
}

check "Server Status"     "$BASE/api/status"
check "Ollama Stats"      "$BASE/api/ollama/stats"
check "Memory Status"     "$BASE/api/memory/status"
check "Drive Status"      "$BASE/api/drive/status"
check "Shelly Status"     "$BASE/api/shelly/status"
check "Vector DB"         "$BASE/api/memory/vector-status"

echo ""
echo "Node-Prozess:"
pgrep -a -f "node proxy.js" || echo "  ❌ Nicht gefunden"

echo ""
echo "Caddy:"
systemctl is-active --quiet caddy && echo "  ✅ läuft" || echo "  ❌ gestoppt"

echo ""
echo "Ollama:"
systemctl is-active --quiet ollama && echo "  ✅ läuft" || echo "  ❌ gestoppt"
EOF

chmod +x /opt/innovooclaw/scripts/diagnose.sh
