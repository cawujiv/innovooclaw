# 🌍 i18n Integration - Anleitung

## ✅ Was wurde erstellt:

1. **`/client/i18n/de.json`** - Deutsche Übersetzungen (vollständig)
2. **`/client/i18n/en.json`** - Englische Übersetzungen (vollständig)
3. **`/client/i18n/i18n.js`** - Helper-Modul für Übersetzungen

---

## 📋 Schritt-für-Schritt Integration

### Schritt 1: i18n-Dateien nach /public kopieren

```bash
# In CMD/PowerShell:
cd C:\Users\Manfred\Documents\MCP-DATA\EFDMLastmanagement\project

# Erstelle i18n-Verzeichnis in public
mkdir public\i18n

# Kopiere JSON-Dateien
copy client\i18n\de.json public\i18n\de.json
copy client\i18n\en.json public\i18n\en.json

# Kopiere Helper-Modul
copy client\i18n\i18n.js public\scripts\i18n.js
```

### Schritt 2: HTML anpassen

**In `/public/index.html` NACH Chart.js, VOR main.js einfügen:**

```html
<!-- i18n Helper laden -->
<script src="/scripts/i18n.js"></script>
```

### Schritt 3: JavaScript initialisieren

**In `/client/scripts/main.js` GANZ AM ANFANG (vor allen anderen Funktionen) einfügen:**

```javascript
// i18n Initialisierung beim Laden
document.addEventListener('DOMContentLoaded', async () => {
    // Lade Übersetzungen
    await window.i18n.initI18n();
    
    // Dann rest der Initialisierung...
    renderStrompreisEditor();
    originalZeitraster = erstelleZeitraster(false);
    updateUI();
});
```

### Schritt 4: Texte übersetzen

**Vorher (Hardcoded):**
```javascript
document.getElementById('title').textContent = '⚡ Energieflexible Produktionsplanung';
```

**Nachher (i18n):**
```javascript
document.getElementById('title').textContent = window.i18n.t('app.title');
```

---

## 🎨 Sprachumschalter-Widget hinzufügen

**HTML in `/public/index.html` nach dem Header einfügen:**

```html
<!-- Sprachumschalter -->
<div class="card" style="display: flex; justify-content: flex-end; padding: 15px;">
    <div style="display: flex; gap: 10px; align-items: center;">
        <span style="color: #718096; font-weight: bold;">🌍 Sprache:</span>
        <button onclick="switchLanguage('de')" id="lang-de" class="lang-btn active">🇩🇪 DE</button>
        <button onclick="switchLanguage('en')" id="lang-en" class="lang-btn">🇬🇧 EN</button>
    </div>
</div>
```

**CSS in `/client/styles/main.css` hinzufügen:**

```css
/* Sprachumschalter */
.lang-btn {
    padding: 8px 16px;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    background: white;
    cursor: pointer;
    font-size: 1em;
    font-weight: bold;
    transition: all 0.3s;
}

.lang-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.lang-btn.active {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-color: #5568d3;
}
```

**JavaScript in `/client/scripts/main.js` hinzufügen:**

```javascript
// Sprachwechsel-Funktion
async function switchLanguage(lang) {
    await window.i18n.setLanguage(lang);
    
    // UI-Buttons aktualisieren
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(`lang-${lang}`).classList.add('active');
    
    // UI neu rendern mit neuer Sprache
    updateUIWithTranslations();
}

// UI mit Übersetzungen aktualisieren
function updateUIWithTranslations() {
    const t = window.i18n.t;
    
    // Titel & Subtitle
    document.querySelector('h1').textContent = t('app.title');
    const subtitles = document.querySelectorAll('.subtitle');
    subtitles[0].textContent = t('app.subtitle');
    subtitles[1].textContent = t('app.batch_info');
    
    // Strompreise
    document.querySelector('h2').textContent = t('strompreise.title');
    
    // Buttons
    document.querySelector('.btn-optimize').innerHTML = t('buttons.optimize');
    document.querySelector('.btn-reset').innerHTML = t('buttons.reset');
    
    // Summary Cards
    const summaryLabels = document.querySelectorAll('.summary-card .label');
    summaryLabels[0].textContent = t('summary.energie.label');
    summaryLabels[1].textContent = t('summary.kosten_original.label');
    summaryLabels[2].textContent = t('summary.kosten_optimiert.label');
    summaryLabels[3].textContent = t('summary.ersparnis.label');
    summaryLabels[4].textContent = t('summary.verguetung.label');
    
    // Chart
    const chartTitle = document.querySelectorAll('h2')[1];
    if (chartTitle) {
        chartTitle.textContent = t('chart.title');
    }
    
    // Timeline
    const timelineTitle = document.querySelector('.timeline-title');
    if (timelineTitle) {
        timelineTitle.textContent = t('timeline.title');
    }
    
    // ... weitere Übersetzungen nach Bedarf
}
```

---

## 📖 Verwendungsbeispiele

### Einfache Übersetzung:
```javascript
const title = window.i18n.t('app.title');
// DE: "⚡ Energieflexible Produktionsplanung"
// EN: "⚡ Energy-Flexible Production Planning"
```

### Mit Platzhaltern:
```javascript
const message = window.i18n.t('alerts.optimization_success', {
    percent: 10.5,
    amount: 5.50
});
// DE: "✅ Optimierung erfolgreich! Energiekosten um 10.5% reduziert (5.50 € gespart)"
// EN: "✅ Optimization successful! Energy costs reduced by 10.5% (5.50 € saved)"
```

### Verschachtelte Keys:
```javascript
const unit = window.i18n.t('auftraege.units.kwh'); // "kWh"
const category = window.i18n.t('popup.kategorie_guenstig'); // "✅ Günstig"
```

### Aktuelle Sprache abfragen:
```javascript
const currentLang = window.i18n.getCurrentLanguage(); // "de" oder "en"
```

### Verfügbare Sprachen anzeigen:
```javascript
const languages = window.i18n.getAvailableLanguages();
// [
//   { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
//   { code: 'en', name: 'English', flag: '🇬🇧' }
// ]
```

---

## 🔥 Quick-Start für Entwickler

**Minimale Integration (2 Zeilen):**

```javascript
// 1. In HTML einbinden
<script src="/scripts/i18n.js"></script>

// 2. Initialisieren & verwenden
await window.i18n.initI18n();
document.getElementById('title').textContent = window.i18n.t('app.title');
```

**Das war's!** 🎉

---

## 🧪 Testen

**Browser-Konsole:**
```javascript
// Sprache wechseln
await window.i18n.setLanguage('en');

// Übersetzung testen
console.log(window.i18n.t('app.title'));

// Aktuelle Sprache
console.log(window.i18n.getCurrentLanguage());
```

---

## 📝 Neue Übersetzungen hinzufügen

1. Öffne `/client/i18n/de.json`
2. Füge neuen Key hinzu:
```json
{
  "neuer_bereich": {
    "mein_text": "Mein deutscher Text"
  }
}
```
3. Gleiches in `/client/i18n/en.json`:
```json
{
  "neuer_bereich": {
    "mein_text": "My english text"
  }
}
```
4. Im Code verwenden:
```javascript
window.i18n.t('neuer_bereich.mein_text')
```

---

## ✅ Checkliste

- [ ] i18n-Dateien nach `/public/i18n/` kopiert
- [ ] `i18n.js` in HTML eingebunden
- [ ] `initI18n()` beim Seitenstart aufgerufen
- [ ] Erste Texte mit `t()` übersetzt
- [ ] Sprachumschalter hinzugefügt (optional)
- [ ] Im Browser getestet

---

## 🎯 Nächste Schritte

1. **Vollständige Integration:** Alle Hardcoded-Texte in `main.js` durch `t()` ersetzen
2. **Chart-Labels:** Chart.js Konfiguration mit Übersetzungen
3. **Weitere Sprachen:** Französisch, Spanisch, etc. hinzufügen
4. **LocalStorage:** Gewählte Sprache speichern

---

**Fragen? Probleme?**
→ Siehe Konsole (F12) für i18n Debug-Meldungen
