cat > /opt/innovooclaw/innovooclaw-restart.sh << 'EOF'
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "Neustart..."
bash "$SCRIPT_DIR/innovooclaw-stop.sh"
sleep 2
bash "$SCRIPT_DIR/innovooclaw-start.sh"
EOF

chmod +x /opt/innovooclaw/innovooclaw-restart.sh
