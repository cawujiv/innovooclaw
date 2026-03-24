# ⚡ EFDM Lastmanagement - 5-Tage Wochenplan

**Startdatum:** Montag  
**Vollzeitprojekt:** 09:00 - 17:00  
**Ziel:** Phase 1 + Phase 2 komplett abgeschlossen

---

## 📋 Übersicht

| Tag | Fokus | Ziel |
|-----|-------|------|
| **Montag** | Express Server + Datenquellen | `/api/strompreise` + `/api/auftraege` läuft |
| **Dienstag** | Daten aus HTML extrahieren + MongoDB Setup | Alle Daten in DB, API-Endpunkte verbunden |
| **Mittwoch** | Frontend HTML/CSS modularisieren | CSS separate Datei, HTML in `/public/index.html` |
| **Donnerstag** | React Setup + Komponenten | React komponenten funktionieren, API-Calls laufen |
| **Freitag** | Optimization Services + i18n | Komplettes Projekt funktionsfähig, GitHub Push |

---

## 🚀 MONTAG - Express Server & Datenquellen

### Ziel
- ✅ Express Server läuft auf Port 3000
- ✅ `/api/strompreise` Endpunkt
- ✅ `/api/auftraege` Endpunkt
- ✅ Simulator Daten gepflegt

### TASK 1.1: server/index.js erstellen

**Datei:** `project/server/index.js`

```javascript
const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Import Controllers (später)
// const dataController = require('./controllers/dataController');

// Test Endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// API Endpoints (placeholders)
app.get('/api/strompreise', (req, res) => {
  res.json([]);
});

app.get('/api/auftraege', (req, res) => {
  res.json([]);
});

// Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`🚀 Server läuft auf http://localhost:${PORT}`);
});
```

**Test in CMD:**
```cmd
npm run dev
```

Gehe zu: http://localhost:3000/api/health

Erwartet: `{ "status": "OK", "timestamp": "..." }`

---

### TASK 1.2: server/data/dataSources.js erstellen

**Datei:** `project/server/data/dataSources.js`

```javascript
// Simulierte Strompreise (aus der ursprünglichen HTML)
const simulatedStrompreise = [
  { start: 6, end: 9, preis: 0.18, kategorie: 'guenstig', label: '06:00-09:00' },
  { start: 9, end: 12, preis: 0.22, kategorie: 'guenstig', label: '09:00-12:00' },
  { start: 12, end: 16, preis: 0.38, kategorie: 'teuer', label: '12:00-16:00' },
  { start: 16, end: 20, preis: 0.19, kategorie: 'guenstig', label: '16:00-20:00' },
  { start: 20, end: 24, preis: 0.31, kategorie: 'mittel', label: '20:00-24:00' },
];

// Simulierte Aufträge (später aus HTML)
const simulatedAuftraege = [
  {
    id: 'LS-001',
    kunde: 'ABC Produktion',
    gesamtDauer: 180,
    gesamtEnergie: 45,
    startMinute: 360,
    endMinute: 540,
    zugewiesenesZeitfenster: '06:00-09:00',
    strompreis: 0.18,
    kategorie: 'guenstig',
    prozesse: [
      { name: 'Fräsen', maschine: 'CNC-1', dauer: 90, leistung: 15 },
      { name: 'Schleifen', maschine: 'Schleifer-2', dauer: 90, leistung: 10 },
    ],
  },
];

const dataSources = {
  simulated: {
    strompreise: async () => simulatedStrompreise,
    auftraege: async () => simulatedAuftraege,
  },
  external: {
    strompreise: async () => {
      // Später: Externe API Anbindung
      return simulatedStrompreise;
    },
    auftraege: async () => {
      // Später: Externe API Anbindung
      return simulatedAuftraege;
    },
  },
};

module.exports = function getDataSource(source = 'simulated') {
  return dataSources[source] || dataSources.simulated;
};
```

---

### TASK 1.3: server/config/dataConfig.js erstellen

**Datei:** `project/server/config/dataConfig.js`

```javascript
module.exports = {
  dataSource: process.env.DATA_SOURCE || 'simulated',
};
```

---

### TASK 1.4: server/controllers/dataController.js erstellen

**Datei:** `project/server/controllers/dataController.js`

```javascript
const getDataSource = require('../data/dataSources');
const { dataSource } = require('../config/dataConfig');

exports.getStrompreise = async (req, res) => {
  try {
    const source = getDataSource(dataSource);
    const strompreise = await source.strompreise();
    res.json(strompreise);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAuftraege = async (req, res) => {
  try {
    const source = getDataSource(dataSource);
    const auftraege = await source.auftraege();
    res.json(auftraege);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
```

---

### TASK 1.5: server/index.js aktualisieren

Ersetze in `project/server/index.js`:

```javascript
const { getStrompreise, getAuftraege } = require('./controllers/dataController');

// Ersetze die leeren Endpoints:
app.get('/api/strompreise', getStrompreise);
app.get('/api/auftraege', getAuftraege);
```

---

### ✅ MONTAG CHECKPOINT

**Tests in Browser:**

1. http://localhost:3000/api/health → `{ "status": "OK" }`
2. http://localhost:3000/api/strompreise → JSON Array mit Strompreisen
3. http://localhost:3000/api/auftraege → JSON Array mit Aufträgen

**In CMD:**
```cmd
git add -A
git commit -m "feat: Express server with data endpoints"
git push
```

---

## 📊 DIENSTAG - Datenquellen & MongoDB Vorbereitung

### Ziel
- ✅ HTML-Daten vollständig in dataSources.js übernommen
- ✅ MongoDB Schema definiert
- ✅ Alle Daten von der ursprünglichen HTML geparst

### TASK 2.1: Alle Aufträge aus HTML extrahieren

Öffne die hochgeladene `lastprofil_demand_response.html` und suche nach dem `initialAuftraege` Array im `<script>` Tag.

Kopiere ALLE Aufträge und ersetze in `project/server/data/dataSources.js` das `simulatedAuftraege` Array.

**Beispiel-Struktur:**
```javascript
const simulatedAuftraege = [
  {
    id: 'LS-001',
    kunde: 'Kundenname',
    gesamtDauer: 180,
    gesamtEnergie: 45,
    prozesse: [
      { name: 'Prozessname', maschine: 'Maschine', dauer: 90, leistung: 15 },
    ],
  },
  // ... weitere 15-20 Aufträge
];
```

---

### TASK 2.2: MongoDB Modelle vorbereiten

**Datei:** `project/server/config/database.js`

```javascript
const mongoose = require('mongoose');

const strompreisSchema = new mongoose.Schema({
  start: Number,
  end: Number,
  preis: Number,
  kategorie: String,
  label: String,
  createdAt: { type: Date, default: Date.now },
});

const prozessSchema = new mongoose.Schema({
  name: String,
  maschine: String,
  dauer: Number,
  leistung: Number,
});

const auftragSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  kunde: String,
  gesamtDauer: Number,
  gesamtEnergie: Number,
  startMinute: Number,
  endMinute: Number,
  zugewiesenesZeitfenster: String,
  strompreis: Number,
  kategorie: String,
  prozesse: [prozessSchema],
  createdAt: { type: Date, default: Date.now },
});

module.exports = {
  Strompreis: mongoose.model('Strompreis', strompreisSchema),
  Auftrag: mongoose.model('Auftrag', auftragSchema),
};
```

---

### TASK 2.3: API-Response optimieren

Update `project/server/controllers/dataController.js`:

```javascript
exports.getAllData = async (req, res) => {
  try {
    const source = getDataSource(dataSource);
    const strompreise = await source.strompreise();
    const auftraege = await source.auftraege();
    
    res.json({
      success: true,
      data: {
        strompreise,
        auftraege,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
```

Add in `server/index.js`:
```javascript
app.get('/api/data', getAllData);
```

---

### ✅ DIENSTAG CHECKPOINT

**Test in Browser:**

```
http://localhost:3000/api/data
```

Sollte JSON mit `strompreise` und `auftraege` Arrays zurückgeben.

**In CMD:**
```cmd
git add -A
git commit -m "feat: Complete data sources and MongoDB schema"
git push
```

---

## 🎨 MITTWOCH - Frontend Modularisierung

### Ziel
- ✅ HTML aus der ursprünglichen Datei ins `/public/index.html`
- ✅ CSS in `project/client/styles/main.css`
- ✅ Basis JavaScript in `project/client/scripts/main.js`

### TASK 3.1: public/index.html vorbereiten

**Datei:** `project/public/index.html`

Kopiere den HTML-Body aus der ursprünglichen `lastprofil_demand_response.html`, aber:
- **Entferne** die kompletten `<style>` Tags
- **Entferne** die kompletten `<script>` Tags (außer Chart.js CDN)

```html
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>⚡ Energieflexible Produktionsplanung</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <link rel="stylesheet" href="/styles/main.css">
</head>
<body>
    <!-- Kopiere den kompletten Body Content aus der ursprünglichen HTML -->
    <!-- Aber entferne alle <style> und <script> Tags -->
    
    <script src="/scripts/main.js"></script>
</body>
</html>
```

---

### TASK 3.2: CSS auslagern

**Datei:** `project/client/styles/main.css`

Kopiere **ALLES** aus den `<style>` Tags der ursprünglichen HTML in diese Datei.

---

### TASK 3.3: Basis JavaScript mit API-Calls

**Datei:** `project/client/scripts/main.js`

```javascript
// Globale Variablen
let strompreise = [];
let initialAuftraege = [];
let auftraege = [];
let isOptimized = false;

// API-Aufrufe beim Laden
async function init() {
  try {
    // Daten vom Server laden
    const response = await fetch('/api/data');
    const result = await response.json();
    
    strompreise = result.data.strompreise;
    initialAuftraege = result.data.auftraege;
    auftraege = [...initialAuftraege];
    
    console.log('✅ Daten geladen:', { strompreise, auftraege });
    
    // UI rendern
    renderStrompreisEditor();
    renderAuftragsListe();
    
  } catch (error) {
    console.error('❌ Fehler beim Laden:', error);
  }
}

// UI Update Funktion
function updateUI() {
  renderStrompreisEditor();
  renderAuftragsListe();
}

// Strompreis Editor rendern
function renderStrompreisEditor() {
  const container = document.getElementById('strompreis-editor') || createStrompreisEditorContainer();
  container.innerHTML = strompreise.map((f, i) => `
    <div class="zeitfenster ${f.kategorie}">
      <div class="zeit">${f.label}</div>
      <input 
        type="number" 
        step="0.01" 
        value="${f.preis.toFixed(2)}"
        onchange="updateStrompreis(${i}, this.value)"
      >
      <div class="label">€/kWh</div>
    </div>
  `).join('');
}

// Strompreis Update
function updateStrompreis(index, value) {
  strompreise[index].preis = parseFloat(value);
  updateUI();
}

// Aufträge rendern
function renderAuftragsListe() {
  const container = document.getElementById('auftrags-liste') || createAuftragsListeContainer();
  const auftragsDisplay = isOptimized ? auftraege : initialAuftraege;
  
  container.innerHTML = auftragsDisplay.map((a, i) => `
    <div class="auftrag-item">
      <div class="auftrag-header">
        <div class="auftrag-nummer">#${i + 1}</div>
        <div class="auftrag-info">
          <div class="id">${a.id}</div>
          <div class="kunde">${a.kunde}</div>
        </div>
        <div class="auftrag-stats">
          <div class="energie">${a.gesamtEnergie.toFixed(2)} kWh</div>
        </div>
      </div>
    </div>
  `).join('');
}

// Helper: Container erstellen (falls nicht existieren)
function createStrompreisEditorContainer() {
  const div = document.createElement('div');
  div.id = 'strompreis-editor';
  document.body.appendChild(div);
  return div;
}

function createAuftragsListeContainer() {
  const div = document.createElement('div');
  div.id = 'auftrags-liste';
  document.body.appendChild(div);
  return div;
}

// Seite geladen - init aufrufen
document.addEventListener('DOMContentLoaded', init);
```

---

### ✅ MITTWOCH CHECKPOINT

**Browser Test:**

1. http://localhost:3000 → Seite lädt
2. DevTools Console (F12) → Keine Fehler, Daten geladen ✅
3. Strompreise und Aufträge sichtbar ✅

**In CMD:**
```cmd
git add -A
git commit -m "feat: Frontend modularization with API integration"
git push
```

---

Wochenplan wird fortgesetzt...
