#!/bin/bash
cd /opt/innovooclaw

STATUS=$(git status --short)
if [ -z "$STATUS" ]; then
  echo "$(date): Keine Änderungen." >> /opt/innovooclaw/logs/git.log
  exit 0
fi

git add .
DATUM=$(date '+%Y-%m-%d %H:%M')
git commit -m "auto: Snapshot – $DATUM" >> /opt/innovooclaw/logs/git.log 2>&1
git push >> /opt/innovooclaw/logs/git.log 2>&1
echo "$(date): Push erfolgreich." >> /opt/innovooclaw/logs/git.log
