# innovooClaw – Portierung auf Linux

> **Zielplattform:** Ubuntu 22.04 LTS oder Debian 12 (empfohlen)
> **Basis:** innovooClaw v2.0
> **Stand:** 2026-03-22
>
> Dieses Dokument führt Schritt für Schritt durch die vollständige Migration von
> Windows auf Linux. Alle Änderungen am Code (cross-platform Pfade, API-Schutz)
> sind bereits eingebaut — es verbleiben ausschließlich Konfigurations- und
> Infrastrukturaufgaben.

---

## Inhaltsverzeichnis

1. [Systemvoraussetzungen prüfen](#1-systemvoraussetzungen-prüfen)
2. [Voraussetzungen installieren](#2-voraussetzungen-installieren)
3. [Benutzer und Verzeichnisstruktur anlegen](#3-benutzer-und-verzeichnisstruktur-anlegen)
4. [Code übertragen](#4-code-übertragen)
5. [Datenmigration (Memory, Dialog, Kalender)](#5-datenmigration-memory-dialog-kalender)
6. [.env für Linux konfigurieren](#6-env-für-linux-konfigurieren)
7. [secrets.env einrichten](#7-secretsenv-einrichten)
8. [Caddyfile für Linux anpassen](#8-caddyfile-für-linux-anpassen)
9. [Node-Abhängigkeiten installieren](#9-node-abhängigkeiten-installieren)
10. [Shell-Skripte erstellen](#10-shell-skripte-erstellen)
11. [systemd-Service einrichten](#11-systemd-service-einrichten)
12. [Caddy einrichten](#12-caddy-einrichten)
13. [Fritz!Box Portweiterleitung](#13-fritzbox-portweiterleitung)
14. [Ollama einrichten](#14-ollama-einrichten)
15. [Google OAuth neu verbinden](#15-google-oauth-neu-verbinden)
16. [Telegram Webhook registrieren](#16-telegram-webhook-registrieren)
17. [Slack Integration prüfen](#17-slack-integration-prüfen)
18. [Erster Start & schrittweise Diagnose](#18-erster-start--schrittweise-diagnose)
19. [Monitoring & Logs](#19-monitoring--logs)
20. [Update-Prozess](#20-update-prozess)
21. [Backup-Strategie](#21-backup-strategie)
22. [Was bereits cross-platform ist](#22-was-bereits-cross-platform-ist)
23. [Vollständige Fehlerdiagnose](#23-vollständige-fehlerdiagnose)

---

## 1. Systemvoraussetzungen prüfen

Vor dem Start sicherstellen, dass der Linux-Rechner die Mindestanforderungen erfüllt.

### Hardwareanforderungen

| Komponente | Minimum | Empfehlung |
|------------|---------|------------|
| CPU | 2 Kerne | 4+ Kerne |
| RAM | 4 GB | 8+ GB |
| RAM mit Ollama (llama3.1:8b) | 8 GB | 16 GB |
| Speicher | 20 GB | 50 GB SSD |
| Netzwerk | 100 Mbit | 1 Gbit (für Ollama-Downloads) |

### Betriebssystem prüfen

```bash
lsb_release -a
# Ausgabe:
# Distributor ID: Ubuntu
# Release:        22.04
# Codename:       jammy

uname -m
# Ausgabe: x86_64   (oder aarch64 für ARM/Raspberry Pi)
```

> Auf ARM (Raspberry Pi 4/5) funktioniert alles, aber `@lancedb/lancedb`
> braucht längere Kompilierzeit (~30 Min). Ollama auf ARM nutzt keine GPU-Beschleunigung.

### Systemaktualisierung vor dem Start

```bash
sudo apt update && sudo apt upgrade -y
sudo reboot   # empfohlen nach Kernel-Updates
```

---

## 2. Voraussetzungen installieren

### 2.1 Node.js (Version 20 LTS)

innovooClaw benötigt Node.js ≥ 18. Version 20 LTS ist empfohlen.

```bash
# NodeSource-Repository einbinden (offizielle Quelle, aktueller als apt-Standard)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Node.js installieren
sudo apt install -y nodejs

# Version prüfen
node --version    # Erwartete Ausgabe: v20.x.x
npm --version     # Erwartete Ausgabe: 10.x.x
```

**Warum nicht die Standard-apt-Version?**
Ubuntu 22.04 liefert Node.js 12 aus, das zu alt ist.
Das NodeSource-Repository liefert aktuelle LTS-Versionen.

### 2.2 Build-Tools für native npm-Module

Zwei Pakete kompilieren C++-Code beim `npm install`:
- `@lancedb/lancedb` — Vektordatenbank (Rust-basiert, braucht Cargo)
- `@xenova/transformers` — lokale Embeddings (C++ Bindings)

```bash
# Basis Build-Tools
sudo apt install -y build-essential python3 python3-pip git curl wget

# Rust (für lancedb benötigt)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
rustc --version   # Erwartete Ausgabe: rustc 1.x.x

# Prüfen ob alles da ist
gcc --version      # GCC
g++ --version      # G++
python3 --version  # Python 3.x
```

> **Ohne Rust schlägt `npm install` bei `@lancedb/lancedb` fehl.**
> Rust wird nur für die Kompilierung gebraucht, nicht für den Betrieb.

### 2.3 Caddy (Reverse Proxy)

Caddy übernimmt HTTPS (Let's Encrypt), Zertifikats-Erneuerung und die
Weiterleitung von Port 443 → Port 3000.

```bash
# Caddy-Repository einbinden
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https

curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg

curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list

sudo apt update && sudo apt install -y caddy

# Version prüfen
caddy version    # Erwartete Ausgabe: v2.x.x
```

Die apt-Installation richtet Caddy automatisch als systemd-Service ein und
erteilt ihm die Berechtigung, Port 80 und 443 zu nutzen (ohne root).

### 2.4 Ollama (optional — für Hybrid-Modus)

Ollama ermöglicht lokale LLM-Inferenz. Bei `OLLAMA_MODE=hybrid` ist innovooClaw
voll funktionsfähig auch ohne Ollama (Anthropic-Fallback greift automatisch).

```bash
# Installationsskript (installiert auch den systemd-Service)
curl -fsSL https://ollama.com/install.sh | sh

# Service starten
sudo systemctl start ollama
sudo systemctl status ollama

# Verbindung prüfen
curl http://localhost:11434/api/tags
# Ausgabe: {"models":[]}  ← noch kein Modell geladen
```

Modell laden (dauert je nach Verbindung 5–30 Min, ~4,7 GB):

```bash
ollama pull llama3.1:8b

# Nach dem Download prüfen:
ollama list
# NAME                ID              SIZE    MODIFIED
# llama3.1:8b         ...             4.7 GB  ...
```

---

## 3. Benutzer und Verzeichnisstruktur anlegen

### 3.1 Dedizierter Systembenutzer (empfohlen)

Für Produktivbetrieb: eigener Benutzer ohne Login-Shell, nur für den Service.

```bash
# Benutzer anlegen (kein Home, keine Shell)
sudo useradd --system --no-create-home --shell /usr/sbin/nologin innovooclaw

# Alternativ: eigenen Benutzer verwenden (einfacher, für Heimserver OK)
# Dann überall 'innovooclaw' durch deinen Benutzernamen ersetzen
```

### 3.2 Verzeichnisstruktur

```bash
# Projektverzeichnis
sudo mkdir -p /opt/innovooclaw
sudo chown innovooclaw:innovooclaw /opt/innovooclaw

# Unterverzeichnisse (werden beim Start auch automatisch erstellt, aber besser explizit)
sudo -u innovooclaw mkdir -p /opt/innovooclaw/{logs,memory,data,secrets/tokens}

# Externes Secrets-Verzeichnis — außerhalb des Projekts (wie C:\...\secrets\ unter Windows)
sudo mkdir -p /opt/mcp-data/secrets
sudo chown innovooclaw:innovooclaw /opt/mcp-data/secrets
sudo chmod 700 /opt/mcp-data/secrets
```

### 3.3 Berechtigungsübersicht

| Verzeichnis | Besitzer | Rechte | Zweck |
|-------------|---------|--------|-------|
| `/opt/innovooclaw/` | innovooclaw | `755` | Projektroot |
| `/opt/innovooclaw/logs/` | innovooclaw | `755` | Server- und Caddy-Logs |
| `/opt/innovooclaw/memory/` | innovooclaw | `700` | Memory-Daten (episodic, semantic usw.) |
| `/opt/innovooclaw/data/` | innovooclaw | `755` | Statische Daten, calendar.ics |
| `/opt/innovooclaw/secrets/tokens/` | innovooclaw | `700` | Google OAuth Token |
| `/opt/mcp-data/secrets/` | innovooclaw | `700` | secrets.env (API-Keys) |

```bash
# Berechtigungen setzen
chmod 700 /opt/innovooclaw/memory
chmod 700 /opt/innovooclaw/secrets
chmod 700 /opt/mcp-data/secrets
```

### 3.4 Vollständige Verzeichnisübersicht nach der Migration

```
/opt/
├── innovooclaw/                  ← Projektroot (git-verwaltet)
│   ├── proxy.js                  ← Hauptserver
│   ├── .env                      ← Konfiguration (Linux-Pfade!)
│   ├── Caddyfile                 ← Caddy-Konfiguration (Linux-Pfad!)
│   ├── package.json
│   ├── cert.pem / key.pem        ← Self-signed TLS (Port 3443)
│   ├── core/
│   ├── data/
│   ├── modules/
│   ├── public/
│   │   └── innovooclaw.html      ← Web-UI
│   ├── skills/
│   ├── memory/                   ← Persistente Daten (nicht ins Git!)
│   │   ├── episodic.json
│   │   ├── semantic.json
│   │   ├── procedural.json
│   │   ├── working.json
│   │   ├── dialog-history.json
│   │   ├── drive-index.json
│   │   ├── pdf-cache.json
│   │   └── lancedb/              ← Vektordatenbank-Dateien
│   ├── logs/
│   │   ├── node.log
│   │   ├── node-error.log
│   │   ├── caddy.log
│   │   ├── caddy-access.log
│   │   └── innovooclaw.pid
│   ├── secrets/
│   │   └── tokens/
│   │       └── google_token.json ← Google OAuth (nach erstem Login)
│   ├── innovooclaw-start.sh
│   ├── innovooclaw-stop.sh
│   └── innovooclaw-restart.sh
│
└── mcp-data/
    └── secrets/
        └── secrets.env           ← Externe Secrets (API-Keys, Tokens)
```

---

## 4. Code übertragen

### 4.1 Option A: rsync (direkt vom Windows-Rechner)

In WSL2, Git Bash oder PowerShell mit OpenSSH:

```bash
# Von WSL2 oder Git Bash:
rsync -avz --progress \
  --exclude='node_modules/' \
  --exclude='.git/' \
  --exclude='memory/lancedb/' \
  --exclude='logs/' \
  /mnt/c/Users/Manfred/Documents/MCP-DATA/innovooClaw/ \
  innovooclaw@linux-host:/opt/innovooclaw/

# Erwartet Ausgabe wie:
# sending incremental file list
# proxy.js
# .env
# Caddyfile
# ...
# sent 2,456,789 bytes  received 1,234 bytes  98,430.28 bytes/sec
```

> Die Vektordatenbank (`memory/lancedb/`) ist plattformspezifisch kompiliert
> und muss auf Linux neu aufgebaut werden — daher ausschließen und später
> neu indexieren (→ Schritt 5).

### 4.2 Option B: Git (wenn Repo vorhanden)

```bash
cd /opt/innovooclaw
git init
git remote add origin https://github.com/dein-user/innovooclaw.git
git pull origin main

# .gitignore prüfen — folgende Einträge sollten drin sein:
cat .gitignore | grep -E "node_modules|memory|secrets|logs"
```

> Wenn noch kein Git-Repo existiert: Option A verwenden und dann
> `git init` nachträglich einrichten.

### 4.3 Secrets übertragen (separat, sicher)

```bash
# Per scp (nicht rsync, da Zieldatei andere Rechte bekommt)
scp C:/Users/Manfred/Documents/MCP-DATA/secrets/secrets.env \
    innovooclaw@linux-host:/opt/mcp-data/secrets/secrets.env

# Auf dem Linux-Server: Berechtigungen sichern
chmod 600 /opt/mcp-data/secrets/secrets.env
chown innovooclaw:innovooclaw /opt/mcp-data/secrets/secrets.env

# Inhalt prüfen (nur Struktur, keine Werte ausgeben)
grep -c "=" /opt/mcp-data/secrets/secrets.env   # Anzahl Einträge
```

### 4.4 Übertragung prüfen

```bash
# Alle wichtigen Dateien vorhanden?
ls -la /opt/innovooclaw/
# Erwartete Ausgabe:
# -rw-r--r--  proxy.js
# -rw-r--r--  .env
# -rw-r--r--  Caddyfile
# -rw-r--r--  package.json
# drwxr-xr-x  core/
# drwxr-xr-x  modules/
# drwxr-xr-x  public/
# drwxr-xr-x  data/
# drwxr-xr-x  skills/

# Anzahl Dateien vergleichen (Windows vs. Linux)
find /opt/innovooclaw -not -path '*/node_modules/*' -not -path '*/.git/*' -type f | wc -l
```

---

## 5. Datenmigration (Memory, Dialog, Kalender)

### 5.1 Was migriert werden muss

| Datei/Verzeichnis | Migrieren? | Hinweis |
|-------------------|-----------|---------|
| `memory/episodic.json` | ✅ Ja | Gesprächsgedächtnis |
| `memory/semantic.json` | ✅ Ja | Gelernte Fakten |
| `memory/procedural.json` | ✅ Ja | Prozedurales Wissen |
| `memory/working.json` | ✅ Ja | Kurzzeit-Kontext |
| `memory/dialog-history.json` | ✅ Ja | Verlauf aller Chats |
| `memory/drive-index.json` | ✅ Ja | Drive-Dateiindex |
| `memory/pdf-cache.json` | ✅ Ja | PDF-Analysecache |
| `memory/routing-overrides.json` | ✅ Ja | Routing-Anpassungen |
| `memory/tool-overrides.json` | ✅ Ja | Tool-Overrides |
| `memory/lancedb/` | ⚠️ Neu aufbauen | Plattformspezifisch (binär) |
| `data/calendar.ics` | ✅ Ja (falls vorhanden) | Lokaler Kalender-Cache |

### 5.2 JSON-Dateien übertragen

```bash
# Von Windows (WSL2) mit rsync, nur die JSON-Dateien
rsync -avz \
  --include='*.json' \
  --exclude='lancedb/' \
  --exclude='*' \
  /mnt/c/Users/Manfred/Documents/MCP-DATA/innovooClaw/memory/ \
  innovooclaw@linux-host:/opt/innovooclaw/memory/
```

### 5.3 LanceDB-Vektordatenbank neu aufbauen

Die LanceDB-Daten sind plattformspezifisch kompiliert und können nicht
direkt von Windows übernommen werden. Nach dem Start neu indexieren:

```bash
# Nach dem ersten Start von innovooClaw:
# 1. Vektorindex neu aufbauen (aus bestehenden Memory-JSON-Dateien)
curl -s http://localhost:3000/api/memory/init | python3 -m json.tool

# 2. Drive-Index neu aufbauen (falls Google Drive verbunden)
curl -s http://localhost:3000/api/drive/index | python3 -m json.tool

# 3. Alternativ per npm script
npm run index:memory   # Memory indexieren
npm run index:drive    # Drive indexieren
```

> Der erste Indexierungslauf lädt das `@xenova/transformers`-Modell
> (~80 MB) herunter und kann 5–10 Min dauern.

---

## 6. .env für Linux konfigurieren

### 6.1 Datei bearbeiten

```bash
nano /opt/innovooclaw/.env
```

### 6.2 Vollständige Linux-.env mit Erklärungen

```dotenv
# ============================================================
#  innovooClaw .env – Linux-Konfiguration
#  Tokens und API-Keys: /opt/mcp-data/secrets/secrets.env
# ============================================================

# ── Externe Secrets-Datei ──────────────────────────────────────────────────
# Zeigt auf die externe secrets.env außerhalb des Projektverzeichnisses.
# Wird beim Start automatisch geladen. Werte dort überschreiben NICHTS hier
# (override: false), daher API_SECRET hier NICHT setzen.
SECRETS_FILE=/opt/mcp-data/secrets/secrets.env

# ── Server-Ports ───────────────────────────────────────────────────────────
# Port 3000: HTTP intern (Caddy leitet von 443 hierher weiter)
# Port 3443: HTTPS direkt (mit self-signed cert.pem/key.pem)
# Port 3000 darf NICHT öffentlich in der Firewall geöffnet sein!
PORT=3000
HTTPS_PORT=3443

# ── Verzeichnispfade ───────────────────────────────────────────────────────
# MEMORY_DIR: Speicherort aller Memory-JSON-Dateien und LanceDB-Daten
MEMORY_DIR=/opt/innovooclaw/memory

# DATA_DIR: Statische Daten, banking.csv, calendar.ics
DATA_DIR=/opt/innovooclaw/data

# ── Google OAuth Token-Verzeichnis ─────────────────────────────────────────
# Hier speichert innovooClaw den google_token.json nach dem OAuth-Login.
# Verzeichnis wird automatisch angelegt wenn es nicht existiert.
GOOGLE_TOKEN_DIR=/opt/innovooclaw/secrets/tokens

# ── Ollama (lokaler LLM) ──────────────────────────────────────────────────
# OLLAMA_URL: Standard-Port von Ollama (nicht ändern wenn lokal)
# OLLAMA_MODEL: Muss vorher mit 'ollama pull' geladen worden sein
# OLLAMA_MODE:
#   hybrid  = Ollama für Pre-Processing, Anthropic für Antworten (empfohlen)
#   off     = Kein Ollama, nur Anthropic Claude
#   only    = Nur Ollama, kein Anthropic (kein Internet nötig)
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
OLLAMA_MODE=hybrid

# ── Shelly Pro 3EM Energiemessung ─────────────────────────────────────────
# SHELLY_IP: IP-Adresse des Shelly-Geräts im lokalen Netzwerk
# SHELLY_AUTH: Leer wenn keine HTTP-Auth, sonst "user:passwort"
SHELLY_IP=192.168.0.120
SHELLY_AUTH=

# ── Externe Dienste ───────────────────────────────────────────────────────
# VVS_STAMMHALTESTELLE: Standardhaltestelle für Abfahrtsanzeige
# GARMIN_POOL_LENGTH: Schwimmbad-Länge in Metern (für Garmin-Schwimmdaten)
# CADDY_DOMAIN: Externe Domain (für Caddy-Statusmeldung im Log)
VVS_STAMMHALTESTELLE=Stuttgart, Libanonstraße
GARMIN_POOL_LENGTH=25
CADDY_DOMAIN=kit-werk.myfritz.link

# ── Lokale Datenpfade ─────────────────────────────────────────────────────
# CALENDAR_ICS_PATH: Pfad zur lokalen ICS-Datei (Fallback wenn Google Calendar fehlt)
CALENDAR_ICS_PATH=/opt/innovooclaw/data/calendar.ics

# ── API-Sicherheit ─────────────────────────────────────────────────────────
# API_SECRET wird aus secrets.env geladen – hier NICHT setzen!
# (Ein leerer Wert hier würde den secrets.env-Wert überschreiben)
```

### 6.3 Konfiguration testen

```bash
# Alle Umgebungsvariablen beim Start prüfen (ohne Server zu starten)
node -e "
  require('dotenv').config({ path: '/opt/innovooclaw/.env' });
  const path = require('path');
  const fs = require('fs');
  const vars = ['SECRETS_FILE','PORT','MEMORY_DIR','DATA_DIR','GOOGLE_TOKEN_DIR','OLLAMA_URL'];
  vars.forEach(v => console.log(v + '=', process.env[v] || '(nicht gesetzt)'));
"
```

---

## 7. secrets.env einrichten

### 7.1 Speicherort

```
/opt/mcp-data/secrets/secrets.env
```

Die Datei ist identisch mit der Windows-Version — **keine Pfad-Änderungen nötig**,
da sie nur API-Keys und Tokens enthält (keine Dateipfade).

### 7.2 Pflichtfelder prüfen

```bash
# Welche Keys sind gesetzt (nur Schlüsselnamen, keine Werte ausgeben)
grep -v '^#' /opt/mcp-data/secrets/secrets.env | grep '=' | cut -d= -f1
```

Erwartete Ausgabe:
```
ANTHROPIC_API_KEY
SLACK_WEBHOOK_URL
SLACK_BOT_TOKEN
SLACK_APP_TOKEN
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
BRAVE_API_KEY
CADDY_AUTH_USER
CADDY_AUTH_HASH
API_SECRET
```

### 7.3 API_SECRET aktivieren (optional)

Wenn der API-Schutz aktiv sein soll, ein langes zufälliges Secret generieren
und in beiden Dateien eintragen:

```bash
# Zufälliges Secret generieren (32 Byte = 64 Hex-Zeichen)
openssl rand -hex 32
# Ausgabe: a3f9b2c8e1d4... (64 Zeichen)

# In secrets.env eintragen
nano /opt/mcp-data/secrets/secrets.env
# API_SECRET=a3f9b2c8e1d4...
```

Denselben Wert in `public/innovooclaw.html` eintragen:

```javascript
// In innovooclaw.html (ca. Zeile 389):
window.INNOVOO_API_KEY = 'a3f9b2c8e1d4...';
```

### 7.4 Sicherheit der Datei prüfen

```bash
ls -la /opt/mcp-data/secrets/secrets.env
# Erwartete Ausgabe: -rw------- 1 innovooclaw innovooclaw ...
# Nur Besitzer darf lesen/schreiben (600), keine Gruppenzugriffe
```

---

## 8. Caddyfile für Linux anpassen

### 8.1 Einzige notwendige Änderung: Log-Pfad

```bash
cd /opt/innovooclaw
# Alten Windows-Pfad ersetzen:
sed -i 's|C:/Users/Manfred/Documents/MCP-DATA/innovooClaw/logs/caddy-access.log|/opt/innovooclaw/logs/caddy-access.log|g' Caddyfile

# Ergebnis prüfen:
grep "output file" Caddyfile
# Ausgabe: output file /opt/innovooclaw/logs/caddy-access.log {
```

### 8.2 Vollständiger fertiger Caddyfile für Linux

```caddyfile
# ─── Caddyfile für innovooClaw (Linux) ────────────────────────────────────────
# Start: sudo systemctl start caddy
# Voraussetzung: Fritz!Box leitet Port 80 + 443 auf diesen Linux-Server weiter
# ─────────────────────────────────────────────────────────────────────────────

{
    # Let's Encrypt-Konto E-Mail (für Zertifikats-Benachrichtigungen)
    email manfred@innovoo.de

    # Caddy Admin API (nur lokal erreichbar)
    admin localhost:2019
}

kit-werk.myfritz.link {
    # Alle Anfragen an innovooClaw (Port 3000) weiterleiten
    reverse_proxy localhost:3000 {
        # Echte Client-IP weitergeben (für Logging und localhost-Checks)
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
        header_up Host {host}

        # Timeouts erhöhen für langsame Agent-Antworten (LLM kann dauern)
        transport http {
            dial_timeout         30s
            response_header_timeout 60s
            read_timeout        120s
        }
    }

    # Zugriffs-Log (rotiert automatisch)
    log {
        output file /opt/innovooclaw/logs/caddy-access.log {
            roll_size 10mb
            roll_keep 3
        }
        format json
    }

    # Sicherheits-Header
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options "nosniff"
        -Server
    }
}

# HTTP → HTTPS Redirect (Port 80 muss offen sein für ACME-Challenge!)
http://kit-werk.myfritz.link {
    redir https://{host}{uri} permanent
}
```

### 8.3 Caddy-Konfiguration validieren

```bash
caddy validate --config /opt/innovooclaw/Caddyfile
# Erwartete Ausgabe: Valid configuration
```

### 8.4 Wichtig: Let's Encrypt Zertifikat

Caddy holt automatisch ein gültiges TLS-Zertifikat von Let's Encrypt,
sobald `kit-werk.myfritz.link` öffentlich erreichbar ist (Port 80 offen).

Unter Windows wurde wahrscheinlich ein self-signed `cert.pem/key.pem` verwendet —
das ist unter Linux **nicht mehr nötig**, Caddy übernimmt das vollständig.
Die `cert.pem`/`key.pem` im Projektverzeichnis werden weiterhin für
Port 3443 (direkter HTTPS-Zugriff lokal) genutzt.

---

## 9. Node-Abhängigkeiten installieren

### 9.1 npm install ausführen

```bash
cd /opt/innovooclaw
npm install
```

Erwarteter Ablauf (mit Kommentaren):

```
npm warn deprecated ...         ← unkritische Warnungen, ignorieren
...
> @lancedb/lancedb@0.26.x install
> node-pre-gyp install --fallback-to-build
                                ← Lädt vorkompiliertes Binary oder kompiliert selbst
                                ← Bei fehlendem Binary: Rust-Kompilierung (~5-15 Min)
> @xenova/transformers@2.17.x install
> ...
                                ← Lädt ONNX-Runtime (~50 MB)

added 342 packages in 8m       ← Gesamtdauer je nach Hardware
```

### 9.2 Fehlerbehebung bei npm install

**Fehler: `node-pre-gyp` / `gyp ERR!`**
```bash
# Build-Tools fehlen oder veraltet
sudo apt install -y build-essential
npm rebuild
```

**Fehler: `cargo: command not found`**
```bash
# Rust ist nicht installiert
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
npm install   # erneut versuchen
```

**Fehler: `EACCES permission denied`**
```bash
# Falscher Benutzer oder falsche Berechtigungen
sudo chown -R innovooclaw:innovooclaw /opt/innovooclaw
sudo -u innovooclaw npm install
```

**Fehler: `ENOSPC: no space left on device`**
```bash
# Speicherplatz prüfen
df -h
# node_modules braucht ~500 MB
```

### 9.3 Installation prüfen

```bash
# Jedes kritische Modul einzeln testen
node -e "require('./core/llm-router');      console.log('✅ llm-router')"
node -e "require('./core/unified-memory');  console.log('✅ unified-memory')"
node -e "require('./core/agent-factory');   console.log('✅ agent-factory')"
node -e "require('./modules/memory-vector');console.log('✅ memory-vector')"
node -e "require('./modules/skill-loader'); console.log('✅ skill-loader')"
node -e "require('./data/routing-rules');   console.log('✅ routing-rules')"
node -e "require('./data/agent-registry');  console.log('✅ agent-registry')"
```

---

## 10. Shell-Skripte erstellen

Ersatz für die Windows-Batch-Dateien. Direkt im Projektverzeichnis anlegen.

### 10.1 `innovooclaw-start.sh`

```bash
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
```

### 10.2 `innovooclaw-stop.sh`

```bash
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
```

### 10.3 `innovooclaw-restart.sh`

```bash
cat > /opt/innovooclaw/innovooclaw-restart.sh << 'EOF'
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "Neustart..."
bash "$SCRIPT_DIR/innovooclaw-stop.sh"
sleep 2
bash "$SCRIPT_DIR/innovooclaw-start.sh"
EOF

chmod +x /opt/innovooclaw/innovooclaw-restart.sh
```

### 10.4 `diagnose.sh` (Linux-Ersatz für scripts/diagnose.bat)

```bash
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
```

---

## 11. systemd-Service einrichten

Für automatischen Start beim Booten und automatischen Neustart bei Absturz.

### 11.1 Service-Datei erstellen

```bash
sudo nano /etc/systemd/system/innovooclaw.service
```

```ini
[Unit]
Description=innovooClaw Multi-Agent KI-Proxy v2.0
Documentation=https://kit-werk.myfritz.link
# Erst starten wenn Netzwerk verfügbar
After=network-online.target
Wants=network-online.target
# Wenn Ollama läuft: warten bis Ollama bereit ist
After=ollama.service

[Service]
# 'simple': systemd betrachtet den Prozess als gestartet sobald er läuft
Type=simple

# Benutzer (NICHT root — keine erhöhten Rechte nötig)
User=innovooclaw
Group=innovooclaw

# Arbeitsverzeichnis (wichtig für relative Pfade in proxy.js)
WorkingDirectory=/opt/innovooclaw

# Start-Kommando (absoluter Pfad zu node)
ExecStart=/usr/bin/node /opt/innovooclaw/proxy.js

# Graceful Reload: SIGTERM senden, dann SIGKILL nach 30s
ExecStop=/bin/kill -SIGTERM $MAINPID
TimeoutStopSec=30

# Automatischer Neustart bei Absturz (nicht bei manuellem 'stop')
Restart=on-failure
RestartSec=10s
# Maximal 5 Neustarts in 2 Minuten, dann aufgeben
StartLimitBurst=5
StartLimitIntervalSec=120s

# Logging: stdout und stderr in Dateien
StandardOutput=append:/opt/innovooclaw/logs/node.log
StandardError=append:/opt/innovooclaw/logs/node-error.log

# Umgebungsvariablen
Environment=NODE_ENV=production
Environment=HOME=/opt/innovooclaw

# Sicherheitseinschränkungen
NoNewPrivileges=yes
PrivateTmp=yes

[Install]
WantedBy=multi-user.target
```

### 11.2 Service aktivieren und starten

```bash
# systemd-Konfiguration neu laden
sudo systemctl daemon-reload

# Service beim Booten aktivieren
sudo systemctl enable innovooclaw

# Service sofort starten
sudo systemctl start innovooclaw

# Status prüfen
sudo systemctl status innovooclaw
```

Erwartete Ausgabe von `systemctl status`:

```
● innovooclaw.service - innovooClaw Multi-Agent KI-Proxy v2.0
     Loaded: loaded (/etc/systemd/system/innovooclaw.service; enabled)
     Active: active (running) since Sun 2026-03-22 10:00:00 CET; 5s ago
   Main PID: 12345 (node)
      Tasks: 12 (limit: 9494)
     Memory: 180.0M
        CPU: 2.345s
     CGroup: /system.slice/innovooclaw.service
             └─12345 node /opt/innovooclaw/proxy.js
```

### 11.3 Wichtige systemctl-Befehle

```bash
sudo systemctl start innovooclaw    # Starten
sudo systemctl stop innovooclaw     # Stoppen
sudo systemctl restart innovooclaw  # Neu starten
sudo systemctl reload innovooclaw   # Graceful reload (SIGHUP)
sudo systemctl status innovooclaw   # Status
sudo systemctl disable innovooclaw  # Autostart deaktivieren

# Logs aus dem systemd Journal:
journalctl -u innovooclaw -f           # Live verfolgen
journalctl -u innovooclaw -n 100       # Letzte 100 Zeilen
journalctl -u innovooclaw --since today # Nur heute
```

---

## 12. Caddy einrichten

### 12.1 Caddyfile kopieren und Service konfigurieren

```bash
# Eigenen Caddyfile verwenden statt /etc/caddy/Caddyfile
# Dazu den Caddy-Service überschreiben:
sudo mkdir -p /etc/systemd/system/caddy.service.d/
sudo nano /etc/systemd/system/caddy.service.d/override.conf
```

Inhalt der Override-Datei:

```ini
[Service]
# ExecStart erst leeren, dann neu setzen (systemd-Syntax)
ExecStart=
ExecStart=/usr/bin/caddy run --environ --config /opt/innovooclaw/Caddyfile
```

```bash
sudo systemctl daemon-reload
sudo systemctl restart caddy
sudo systemctl status caddy
```

### 12.2 Berechtigungen für Log-Verzeichnis

Caddy läuft als eigener Benutzer (`caddy`) und muss in das Log-Verzeichnis schreiben:

```bash
sudo chown -R caddy:caddy /opt/innovooclaw/logs
# oder: Gruppe nutzen
sudo chown innovooclaw:caddy /opt/innovooclaw/logs
sudo chmod 775 /opt/innovooclaw/logs
```

> Alternative: Einen eigenen Log-Pfad für Caddy verwenden, z.B.
> `/var/log/caddy/innovooclaw-access.log` (dann Caddyfile anpassen).

### 12.3 Ports freigeben

```bash
# ufw Firewall aktivieren (falls noch nicht aktiv)
sudo ufw enable

# Nur Port 80 (HTTP/ACME) und 443 (HTTPS) öffnen
sudo ufw allow 80/tcp comment 'Caddy HTTP / Let-s Encrypt'
sudo ufw allow 443/tcp comment 'Caddy HTTPS'

# SSH-Zugang sichern (wichtig! Sonst aussperren)
sudo ufw allow ssh

# Port 3000 explizit blockieren (darf nicht direkt erreichbar sein)
sudo ufw deny 3000/tcp comment 'innovooClaw intern - nur via Caddy'
sudo ufw deny 3443/tcp comment 'innovooClaw HTTPS intern'

# Status prüfen
sudo ufw status verbose
```

Erwartete Ausgabe:

```
Status: active
To                         Action      From
--                         ------      ----
22/tcp                     ALLOW IN    Anywhere
80/tcp                     ALLOW IN    Anywhere    # Caddy HTTP
443/tcp                    ALLOW IN    Anywhere    # Caddy HTTPS
3000/tcp                   DENY IN     Anywhere    # intern
```

### 12.4 Let's Encrypt Zertifikat testen

```bash
# Caddy-Logs verfolgen während Zertifikat geholt wird
journalctl -u caddy -f

# Sobald Caddy läuft und Port 80/443 erreichbar sind:
# "certificate obtained successfully" erscheint im Log

# Zertifikat prüfen
curl -v https://kit-werk.myfritz.link/api/status 2>&1 | grep -E "SSL|certificate|expire"
```

---

## 13. Fritz!Box Portweiterleitung

Die Fritz!Box muss Port 80 und Port 443 an die lokale IP des Linux-Servers weiterleiten.

### 13.1 Linux-Server IP-Adresse ermitteln

```bash
ip addr show | grep "inet " | grep -v 127
# Ausgabe z.B.: inet 192.168.0.100/24 brd 192.168.0.255 scope global eth0
```

### 13.2 Statische IP vergeben (empfohlen)

In der Fritz!Box: **Heimnetz → Netzwerk → Geräte** → Linux-Server auswählen →
"Diesem Netzwerkgerät immer die gleiche IPv4-Adresse zuweisen" aktivieren.

Alternativ direkt auf dem Linux-Server (Netplan für Ubuntu):

```bash
sudo nano /etc/netplan/00-installer-config.yaml
```

```yaml
network:
  version: 2
  ethernets:
    eth0:
      dhcp4: false
      addresses:
        - 192.168.0.100/24
      routes:
        - to: default
          via: 192.168.0.1
      nameservers:
        addresses: [8.8.8.8, 1.1.1.1]
```

```bash
sudo netplan apply
```

### 13.3 Portweiterleitung in der Fritz!Box einrichten

**Fritz!Box Oberfläche:** `http://fritz.box` → **Internet → Freigaben → Portfreigaben**

| Protokoll | Port extern | An Server | Port intern | Bezeichnung |
|-----------|-------------|-----------|-------------|-------------|
| TCP | 80 | 192.168.0.100 | 80 | innovooClaw HTTP (ACME) |
| TCP | 443 | 192.168.0.100 | 443 | innovooClaw HTTPS |

> Port 3000 darf **nicht** weitergeleitet werden — nur Caddy soll extern erreichbar sein.

### 13.4 Weiterleitung testen

```bash
# Von außen (z.B. Smartphone-Daten, nicht WLAN):
curl -s https://kit-werk.myfritz.link/api/status

# Oder mit externem Dienst testen:
# https://www.yougetsignal.com/tools/open-ports/
# Port 443 auf kit-werk.myfritz.link prüfen
```

---

## 14. Ollama einrichten

### 14.1 Service aktivieren

```bash
# Ollama-Service beim Booten starten
sudo systemctl enable ollama
sudo systemctl start ollama

# Status prüfen
sudo systemctl status ollama
# Erwartete Ausgabe: active (running)
```

### 14.2 Modell laden

```bash
# Modell herunterladen (4,7 GB — dauert je nach Verbindung)
ollama pull llama3.1:8b

# Fortschritt wird angezeigt:
# pulling manifest
# pulling 8eeb52dfb3bb... 100% ▕████████▏ 4.7 GB

# Verfügbare Modelle anzeigen
ollama list
```

### 14.3 GPU-Beschleunigung (optional, deutlich schneller)

**NVIDIA GPU:**

```bash
# NVIDIA-Treiber prüfen
nvidia-smi
# Ausgabe: GPU-Name, VRAM, Treiber-Version

# Ollama nutzt GPU automatisch wenn nvidia-smi verfügbar ist
# Prüfen ob GPU genutzt wird:
ollama run llama3.1:8b "Hallo"
# Im nvidia-smi: GPU-Auslastung steigt während Inferenz
```

**AMD GPU:**

```bash
# ROCm prüfen
rocminfo | head -20
# Ollama unterstützt AMD GPUs via ROCm
```

### 14.4 Ollama-Verbindung testen

```bash
# Direkt testen
curl http://localhost:11434/api/generate \
  -d '{"model":"llama3.1:8b","prompt":"Antworte nur: OK","stream":false}'
# Erwartete Ausgabe: {"response":"OK",...}

# Über innovooClaw testen (wenn Server läuft)
curl http://localhost:3000/api/ollama/stats
```

---

## 15. Google OAuth neu verbinden

Nach dem Wechsel auf Linux muss Google neu autorisiert werden, da der
gespeicherte Token an die alte Windows-Instanz gebunden war.

### 15.1 Alten Token löschen

```bash
rm -f /opt/innovooclaw/secrets/tokens/google_token.json
```

### 15.2 Redirect URI in Google Cloud Console aktualisieren

1. **Google Cloud Console** aufrufen: `https://console.cloud.google.com`
2. Projekt auswählen
3. **APIs & Dienste → Anmeldedaten**
4. OAuth 2.0-Client-ID anklicken
5. Unter **Autorisierte Weiterleitungs-URIs** prüfen/ergänzen:

```
http://localhost:3000/auth/google/callback
https://kit-werk.myfritz.link/auth/google/callback
```

6. **Speichern**

### 15.3 Redirect URI in secrets.env prüfen

```bash
grep GOOGLE_REDIRECT_URI /opt/mcp-data/secrets/secrets.env
# Sollte lauten:
# GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
```

### 15.4 OAuth-Flow durchführen

```bash
# innovooClaw muss laufen
# Browser öffnen (lokal oder per SSH-Tunnel):
xdg-open http://localhost:3000/auth/google
# Alternativ: URL manuell im Browser öffnen
```

OAuth-Ablauf:
1. Browser öffnet Google-Login
2. Google-Konto auswählen und Berechtigungen bestätigen
3. Browser wird zu `http://localhost:3000/auth/google/callback` weitergeleitet
4. Seite zeigt: `✅ Google verbunden: manfred@gmail.com`
5. Token wird gespeichert unter `/opt/innovooclaw/secrets/tokens/google_token.json`

### 15.5 Verbindung prüfen

```bash
curl -s http://localhost:3000/auth/google/status | python3 -m json.tool
# Erwartete Ausgabe:
# {
#   "connected": true,
#   "email": "manfred@gmail.com",
#   "expired": false,
#   "has_refresh": true
# }
```

---

## 16. Telegram Webhook registrieren

### 16.1 Webhook setzen

```bash
# Token aus secrets.env lesen
TELEGRAM_TOKEN=$(grep "^TELEGRAM_BOT_TOKEN=" /opt/mcp-data/secrets/secrets.env | cut -d= -f2)
DOMAIN="kit-werk.myfritz.link"

# Webhook registrieren
curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"https://${DOMAIN}/api/telegram/webhook\",
    \"allowed_updates\": [\"message\"],
    \"drop_pending_updates\": false
  }" | python3 -m json.tool
```

Erwartete Ausgabe:

```json
{
    "ok": true,
    "result": true,
    "description": "Webhook was set"
}
```

### 16.2 Webhook-Status prüfen

```bash
curl -s "https://api.telegram.org/bot${TELEGRAM_TOKEN}/getWebhookInfo" \
  | python3 -m json.tool
```

Erwartete Ausgabe:

```json
{
    "ok": true,
    "result": {
        "url": "https://kit-werk.myfritz.link/api/telegram/webhook",
        "has_custom_certificate": false,
        "pending_update_count": 0,
        "last_error_date": 0,
        "max_connections": 40
    }
}
```

> `last_error_date: 0` bedeutet: kein Fehler. Falls ein Fehler-Datum erscheint:
> Caddy ist nicht erreichbar oder der Endpunkt gibt Fehler zurück.

### 16.3 Telegram-Verbindung testen

```bash
curl -s http://localhost:3000/api/telegram/test | python3 -m json.tool
# Erwartet: { "ok": true, ... }
```

---

## 17. Slack Integration prüfen

### 17.1 Slack App Webhook-URL

Die Slack-Integration nutzt zwei Mechanismen:
- `SLACK_WEBHOOK_URL`: Nachrichten an Slack senden (outgoing)
- `SLACK_BOT_TOKEN` + `SLACK_APP_TOKEN`: Events empfangen (incoming)

```bash
curl -s http://localhost:3000/api/slack/status | python3 -m json.tool
```

### 17.2 Slack Event URL aktualisieren

Falls Slack Events direkt an die Domain gesendet werden:
In der **Slack App Konfiguration** → **Event Subscriptions** → **Request URL** prüfen:

```
https://kit-werk.myfritz.link/api/slack
```

Slack sendet eine Verifikationsanfrage — die URL muss erreichbar sein.

---

## 18. Erster Start & schrittweise Diagnose

### 18.1 Manueller Teststart (empfohlen als erstes)

Vor dem systemd-Service erst manuell testen um Startfehler direkt zu sehen:

```bash
cd /opt/innovooclaw
node proxy.js
```

Erwartete vollständige Startausgabe:

```
⟳ innovooClaw v2.0 startet...
✅ Secrets     geladen: /opt/mcp-data/secrets/secrets.env
✅ HTTP        http://localhost:3000/
✅ HTTPS       https://localhost:3443/
✅ VectorMemory initialisiert (oder: ⚠️ VectorMemory: erster Start)
✅ Caddy       Reverse Proxy läuft (Hintergrund) → https://kit-werk.myfritz.link
✅ Bereit      Agents: otto, vera, mina, leo, sam, cleo, shellyem, react
✅ UI          http://localhost:3000/innovooclaw.html
```

> `⚠️ Secrets nicht gefunden` → `SECRETS_FILE`-Pfad in `.env` prüfen
> `⚠️ VectorMemory` → Normal beim ersten Start, wird beim ersten Agent-Call initialisiert

### 18.2 Schrittweise Endpunkt-Diagnose

```bash
# ── Basis ──────────────────────────────────────────────────────────────────
# Server erreichbar und Agents geladen?
curl -s http://localhost:3000/api/status | python3 -m json.tool
# Erwartete Felder: agents[], version, uptime

# ── Memory ─────────────────────────────────────────────────────────────────
curl -s http://localhost:3000/api/memory/status | python3 -m json.tool
# Erwartete Felder: episodic{count}, semantic{count}, vectorDb{ready}

curl -s "http://localhost:3000/api/memory/latest-facts?n=3" | python3 -m json.tool
# Zeigt die 3 zuletzt gespeicherten Fakten

# ── Ollama ─────────────────────────────────────────────────────────────────
curl -s http://localhost:3000/api/ollama/stats | python3 -m json.tool
# Felder: mode(hybrid/off/only), ollamaAvailable(true/false), compressed, savedChars

# ── Google Drive ────────────────────────────────────────────────────────────
curl -s http://localhost:3000/api/drive/status | python3 -m json.tool
# Felder: connected(true/false), email, expired(false = gut)

# ── Kalender ───────────────────────────────────────────────────────────────
curl -s http://localhost:3000/api/calendar | python3 -m json.tool
# Felder: events[], quelle(google|ics|keine)

# ── VVS ────────────────────────────────────────────────────────────────────
curl -s "http://localhost:3000/api/vvs/abfahrten?stop=Stuttgart%20Hbf&limit=3" \
  | python3 -m json.tool

# ── Shelly ─────────────────────────────────────────────────────────────────
curl -s http://localhost:3000/api/shelly/status | python3 -m json.tool
# Falls Shelly nicht erreichbar: { "error": "..." }

# ── Wetter ─────────────────────────────────────────────────────────────────
curl -s "http://localhost:3000/api/weather?lat=48.7758&lon=9.1829&city=Stuttgart" \
  | python3 -m json.tool

# ── Agent-Aufruf testen (OTTO) ─────────────────────────────────────────────
curl -s -X POST http://localhost:3000/api/agent/otto \
  -H "Content-Type: application/json" \
  -d '{"message":"Hallo, wer bist du?","maxTokens":200}' \
  | python3 -m json.tool
# Felder: ok(true), reply("Ich bin OTTO..."), agent, tokens

# ── Externes HTTPS (Caddy) ──────────────────────────────────────────────────
curl -s https://kit-werk.myfritz.link/api/status | python3 -m json.tool
```

### 18.3 UI im Browser öffnen

```bash
# Lokal:
xdg-open http://localhost:3000
# Oder extern: https://kit-werk.myfritz.link
```

Checkliste im Browser:
- [ ] Seite lädt (Fonts, CSS, Agent-Cards)
- [ ] Ollama-Badge zeigt Modus (HYBRID/OFF/ONLY)
- [ ] Caddy-Status grün (oder orange wenn nicht lokal)
- [ ] Chat mit OTTO: Nachricht senden und Antwort erhalten
- [ ] Drive-Status (oben rechts) zeigt verbunden

---

## 19. Monitoring & Logs

### 19.1 Log-Dateien

| Datei | Inhalt | Aktualisierung |
|-------|--------|----------------|
| `/opt/innovooclaw/logs/node.log` | Server-Ausgaben, Agent-Aktivität, Tool-Calls | Live |
| `/opt/innovooclaw/logs/node-error.log` | Fehler und Exceptions | Bei Fehlern |
| `/opt/innovooclaw/logs/caddy-access.log` | HTTP-Zugriffslog (JSON) | Pro Request |
| `journalctl -u innovooclaw` | systemd-Journal | Live |

```bash
# Live-Monitoring aller Logs
tail -f /opt/innovooclaw/logs/node.log \
        /opt/innovooclaw/logs/node-error.log

# Nur Fehler anzeigen
grep -i "error\|fehler\|❌\|warn" /opt/innovooclaw/logs/node.log | tail -20

# Caddy-Zugriffslog auswerten (JSON-Format)
tail -20 /opt/innovooclaw/logs/caddy-access.log \
  | python3 -c "import sys,json; [print(json.loads(l).get('request',{}).get('uri',''),json.loads(l).get('status','')) for l in sys.stdin]"
```

### 19.2 Ressourcenverbrauch überwachen

```bash
# Speicher- und CPU-Verbrauch von innovooClaw
ps aux | grep "node proxy"

# Detailliert mit top
top -p $(pgrep -f "node proxy.js")

# Speicher der Ollama-Prozesse
ps aux | grep ollama

# Festplatte prüfen (memory/ und logs/ wachsen)
du -sh /opt/innovooclaw/memory/
du -sh /opt/innovooclaw/logs/
df -h /opt
```

### 19.3 Einfache Verfügbarkeitsprüfung als Cronjob

```bash
# Alle 5 Minuten prüfen ob Server läuft, bei Absturz neu starten
crontab -e
```

```cron
*/5 * * * * curl -sf http://localhost:3000/api/status > /dev/null || \
  systemctl restart innovooclaw >> /opt/innovooclaw/logs/watchdog.log 2>&1
```

> Bei systemd-Service mit `Restart=on-failure` ist das meist nicht nötig —
> systemd übernimmt den Neustart automatisch.

---

## 20. Update-Prozess

### 20.1 Code-Update (ohne Neuinstallation)

```bash
cd /opt/innovooclaw

# 1. Aktuelle Version sichern (optional)
cp proxy.js proxy.js.bak

# 2. Neue Dateien übertragen (per rsync oder git pull)
git pull origin main
# oder:
rsync -avz --exclude='node_modules/' --exclude='memory/' \
  /mnt/c/.../innovooClaw/ /opt/innovooclaw/

# 3. Abhängigkeiten aktualisieren (nur wenn package.json geändert)
npm install

# 4. Service neu starten
sudo systemctl restart innovooclaw

# 5. Status prüfen
sudo systemctl status innovooclaw
```

### 20.2 Node.js aktualisieren

```bash
# Aktuelle Version prüfen
node --version

# Neue Version installieren (z.B. auf v22 LTS)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Abhängigkeiten neu kompilieren (native Module!)
cd /opt/innovooclaw
rm -rf node_modules
npm install

sudo systemctl restart innovooclaw
```

### 20.3 Ollama-Modell aktualisieren

```bash
# Neues Modell herunterladen
ollama pull llama3.1:8b

# Oder auf größeres Modell wechseln (mehr RAM nötig!)
ollama pull llama3.1:70b   # ~40 GB — nur mit viel VRAM

# Modell in .env ändern
nano /opt/innovooclaw/.env
# OLLAMA_MODEL=llama3.1:70b

sudo systemctl restart innovooclaw
```

---

## 21. Backup-Strategie

### 21.1 Was gesichert werden muss

| Was | Wo | Wichtigkeit |
|-----|----|-------------|
| Memory-Daten | `/opt/innovooclaw/memory/*.json` | 🔴 Kritisch |
| Google Token | `/opt/innovooclaw/secrets/tokens/` | 🔴 Kritisch |
| Secrets | `/opt/mcp-data/secrets/secrets.env` | 🔴 Kritisch |
| Konfiguration | `/opt/innovooclaw/.env`, `Caddyfile` | 🟡 Wichtig |
| Code | `/opt/innovooclaw/` (ohne node_modules) | 🟢 Wiederherstellbar |
| LanceDB | `/opt/innovooclaw/memory/lancedb/` | 🟢 Neu aufbaubar |

### 21.2 Automatisches Backup-Skript

```bash
cat > /opt/innovooclaw/scripts/backup.sh << 'EOF'
#!/bin/bash
# Tägliches Backup der kritischen Daten
BACKUP_DIR="/backup/innovooclaw/$(date +%Y-%m-%d)"
mkdir -p "$BACKUP_DIR"

# Memory-Daten (ohne LanceDB)
rsync -a --exclude='lancedb/' \
    /opt/innovooclaw/memory/ "$BACKUP_DIR/memory/"

# Google Token
cp -r /opt/innovooclaw/secrets/ "$BACKUP_DIR/secrets/"

# Konfiguration
cp /opt/innovooclaw/.env "$BACKUP_DIR/"
cp /opt/innovooclaw/Caddyfile "$BACKUP_DIR/"

# Secrets (verschlüsselt empfohlen!)
cp /opt/mcp-data/secrets/secrets.env "$BACKUP_DIR/"
chmod 600 "$BACKUP_DIR/secrets.env"

# Alte Backups löschen (älter als 30 Tage)
find /backup/innovooclaw -maxdepth 1 -mtime +30 -type d -exec rm -rf {} +

echo "Backup abgeschlossen: $BACKUP_DIR"
du -sh "$BACKUP_DIR"
EOF

chmod +x /opt/innovooclaw/scripts/backup.sh

# Als täglichen Cronjob einrichten (03:00 Uhr)
crontab -e
# 0 3 * * * /opt/innovooclaw/scripts/backup.sh >> /opt/innovooclaw/logs/backup.log 2>&1
```

---

## 22. Was bereits cross-platform ist

Die folgenden Punkte wurden **bereits vor der Portierung in proxy.js angepasst**
und erfordern keine weiteren Maßnahmen:

| Bereich | Alte Windows-Lösung | Neue cross-platform Lösung |
|---------|--------------------|-----------------------------|
| Garmin-Token Fallback-Pfad | `C:\Users\Manfred\...\garmin_tokens` | `path.join(__dirname, 'secrets', 'tokens')` |
| Caddy PID-Check | `tasklist /FI "PID eq ..."` | `process.platform === 'win32'` → `ps -p <pid>` |
| Caddy Namens-Check | `tasklist /FI "IMAGENAME eq caddy.exe"` | `pgrep -x caddy` |
| Caddy Starthinweis | `innovooclaw-start.bat` | Plattformabhängig: `caddy start --config Caddyfile` |
| CADDY_DOMAIN | Hardcoded in Meldung | `process.env.CADDY_DOMAIN` |
| API-Key Middleware | — | Rein Node.js, kein OS-Bezug |
| `/api/drive/token` Schutz | — | `req.socket.remoteAddress` (OS-neutral) |
| Alle Modul-Pfade | Hätten Probleme machen können | `path.join(__dirname, ...)` durchgängig |

---

## 23. Vollständige Fehlerdiagnose

### `@lancedb/lancedb` Build-Fehler

**Symptom:**
```
Error: Cannot find module '../build/Release/lancedb.node'
```

**Lösung:**
```bash
sudo apt install -y build-essential
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
cd /opt/innovooclaw
npm rebuild @lancedb/lancedb
```

---

### Server startet nicht: `EADDRINUSE`

**Symptom:**
```
❌ Port 3000 belegt!
```

**Lösung:**
```bash
# Welcher Prozess belegt Port 3000?
sudo lsof -i :3000
# oder:
sudo ss -tlnp | grep 3000

# Prozess beenden (PID aus obigem Befehl):
kill <PID>
# oder innovooClaw-Instanz stoppen:
bash /opt/innovooclaw/innovooclaw-stop.sh
```

---

### `EACCES` / Berechtigungsfehler

**Symptom:**
```
Error: EACCES: permission denied, open '/opt/innovooclaw/memory/...'
```

**Lösung:**
```bash
# Berechtigungen für alle Projektdateien korrigieren
sudo chown -R innovooclaw:innovooclaw /opt/innovooclaw
sudo chown -R innovooclaw:innovooclaw /opt/mcp-data/secrets
chmod 700 /opt/innovooclaw/memory
chmod 700 /opt/mcp-data/secrets
```

---

### Caddy: Zertifikat wird nicht ausgestellt

**Symptom:** Browser zeigt "Ungültiges Zertifikat" oder Caddy-Logs zeigen ACME-Fehler.

**Diagnose:**
```bash
journalctl -u caddy -n 50 | grep -i "acme\|cert\|error"
```

**Häufige Ursachen:**

| Ursache | Prüfen | Lösung |
|---------|--------|--------|
| Port 80 nicht erreichbar | `curl http://kit-werk.myfritz.link` von extern | Fritz!Box Portweiterleitung Port 80 prüfen |
| Rate Limit (5 Fehlversuche/Stunde) | Caddy-Log: "too many certificates" | 1 Stunde warten |
| DNS noch nicht aktualisiert | `nslookup kit-werk.myfritz.link` | Bis zu 24h warten |
| Falsche Domain im Caddyfile | `cat /opt/innovooclaw/Caddyfile` | Domain-Name prüfen |

---

### Google OAuth: `Token abgelaufen`

**Symptom:**
```json
{ "connected": false, "error": "Token abgelaufen – bitte neu einloggen" }
```

**Lösung:**
```bash
# Token löschen und neu verbinden
rm /opt/innovooclaw/secrets/tokens/google_token.json

# Browser öffnen:
# http://localhost:3000/auth/google
# OAuth-Flow durchlaufen (→ Schritt 15)
```

---

### Ollama: Out of Memory

**Symptom:** Ollama startet, aber bei Anfragen: `CUDA error: out of memory`
oder sehr hohe RAM-Auslastung.

**Lösung:**
```bash
# Auf kleineres Modell wechseln
ollama pull llama3.2:3b   # 2 GB statt 4.7 GB

# In .env ändern:
# OLLAMA_MODEL=llama3.2:3b
sudo systemctl restart innovooclaw

# Oder Ollama ganz deaktivieren:
# OLLAMA_MODE=off
```

---

### Shelly nicht erreichbar

**Symptom:**
```json
{ "error": "connect ECONNREFUSED 192.168.0.120:80" }
```

**Diagnose:**
```bash
# Shelly-IP im Netzwerk prüfen
ping 192.168.0.120

# HTTP-Zugriff direkt testen
curl -s http://192.168.0.120/status | python3 -m json.tool
```

**Mögliche Ursachen:**
- Linux-Server in anderem Subnetz als Shelly
- Shelly-IP hat sich geändert (DHCP) → In `.env` aktualisieren
- Shelly-Gerät offline

---

### Telegram: `last_error_message` im Webhook-Status

**Diagnose:**
```bash
TELEGRAM_TOKEN=$(grep "^TELEGRAM_BOT_TOKEN=" /opt/mcp-data/secrets/secrets.env | cut -d= -f2)
curl -s "https://api.telegram.org/bot${TELEGRAM_TOKEN}/getWebhookInfo" \
  | python3 -m json.tool | grep -A2 "last_error"
```

**Häufige Fehler:**

| Fehlermeldung | Ursache | Lösung |
|---------------|---------|--------|
| `Connection refused` | innovooClaw läuft nicht | `systemctl start innovooclaw` |
| `SSL certificate error` | Caddy-Zertifikat ungültig | Caddy-Logs prüfen, Zertifikat erneuern |
| `Wrong response from server` | `/api/telegram/webhook` gibt Fehler | `node.log` prüfen |

---

### `window is not defined` im Node.js-Log

Kein echtes Problem. `agent-api.js` ist Browser-Code und enthält
`window.INNOVOO_API_KEY`. Dieser Code wird nur vom Browser geladen
(statisch unter `/modules/agent-api.js`), nicht von Node.js direkt.

Wenn die Meldung aus einem anderen Modul kommt: Log-Kontext prüfen.

---

*Dokument erstellt für innovooClaw v2.0 · Portierung auf Linux*
*Letzte Änderung: 2026-03-22*
