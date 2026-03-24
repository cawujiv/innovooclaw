# innovooClaw · WORKFLOWS
# ─────────────────────────────────────────────────────────────────────────────
# Hier werden alle automatischen Abläufe definiert.
# Format: YAML-Frontmatter + Beschreibung
# Keine Programmierkenntnisse nötig – einfach beschreiben was passieren soll.
# Otto liest diese Datei beim Morgenbericht und kennt alle aktiven Workflows.
# ─────────────────────────────────────────────────────────────────────────────

## AKTIVE WORKFLOWS

---
id: energie-abend
name: Energie-Abendroutine
aktiv: true
zeit: "21:00"
trigger: cron
agent: shellyem → mina
beschreibung: >
  SHELLYEM ermittelt täglich um 21:00 den Tagesertrag (kWh) vom Shelly Pro 3EM.
  MINA berechnet den Gegenwert in EUR (Einspeisevergütung) und hängt eine Zeile
  an MINA/Energieertrag.csv in Google Drive an.
  Format: DATUM;kWh;EUR
skript: scripts/cron-energie-abend.js
windows_task: innovooClaw_Energie_Abend
letzter_lauf: automatisch via Windows Task Scheduler
---

---
id: morgenbericht
name: Morgenbriefing
aktiv: true
zeit: "auf Anfrage"
trigger: manuell ("Guten Morgen", "Morgenbericht")
agent: otto
beschreibung: >
  OTTO holt täglich auf Anfrage: Kalendertermine, neue Mails (Top 5),
  Energieertrag der letzten 7 Tage von MINA, Wetter.
  Ausgabe als kompaktes Briefing mit Emojis.
---

---
id: kontostand
name: Kontostand auf Anfrage
aktiv: true
trigger: manuell ("mina, Kontostand" oder "@MINA Kontostand")
agent: mina
beschreibung: >
  MINA liest automatisch den neuesten Kontoauszug aus Google Drive Ordner "MINA".
  Kein fester Dateiname nötig – MINA nimmt immer die neueste Datei.
  Einmal pro Monat neuen Kontoauszug in den Drive-Ordner MINA hochladen.
---


## WORKFLOW HINZUFÜGEN

Neuen Workflow einfach unten einfügen, Format:

```
---
id: mein-workflow
name: Beschreibender Name
aktiv: true
zeit: "HH:MM" oder "auf Anfrage"
trigger: cron | manuell | event
agent: welcher-agent
beschreibung: >
  Was soll passieren? In natürlicher Sprache beschreiben.
  Wer macht was, wann, womit, wohin?
skript: scripts/mein-skript.js   (optional, nur bei cron)
---
```

Dann im Chat sagen: "Bau Workflow [id] um" — und ich implementiere ihn.


## GEPLANTE WORKFLOWS (noch nicht aktiv)

---
id: energie-wochenbericht
name: Wöchentliche Energieauswertung
aktiv: false
zeit: "Sonntag 20:00"
trigger: cron
agent: mina → otto (Telegram)
beschreibung: >
  MINA liest Energieertrag.csv, summiert die letzte Woche (Mo-So),
  vergleicht mit Vorwoche, berechnet monatliche Hochrechnung.
  OTTO schickt Zusammenfassung per Telegram.
---

---
id: abo-check
name: Monatlicher Abo-Check
aktiv: false
zeit: "1. des Monats 09:00"
trigger: cron
agent: mina
beschreibung: >
  MINA durchsucht Gmail nach neuen Abo-Bestätigungen und Rechnungen
  des letzten Monats. Listet alle Abos mit Betrag auf.
  Speichert Zusammenfassung in Drive/MINA/Abos.txt.
---

---
id: shelly-alarm
name: Shelly Verbrauchsalarm
aktiv: false
trigger: event (wenn Netzbezug > 3000W für 10 Min)
agent: shellyem → otto (Telegram)
beschreibung: >
  SHELLYEM überwacht Netzbezug. Wenn dauerhaft > 3000W,
  sendet OTTO eine Telegram-Warnung mit aktuellen Phasenwerten.
---
