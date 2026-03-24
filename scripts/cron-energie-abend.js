// innovooClaw · scripts/cron-energie-abend.js  v3
// Täglich 21:00 Uhr: Shelly /power direkt → c_act_power + Energiezähler → MINA
'use strict';

const http = require('http');
const PORT = parseInt(process.env.PORT || '3000');

function get(path) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: 'localhost', port: PORT, path, method: 'GET' },
      res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({ raw: d }); } }); }
    );
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout GET ' + path)); });
    req.on('error', reject); req.end();
  });
}

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req  = http.request({
      hostname: 'localhost', port: PORT, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({ raw: d }); } }); });
    req.setTimeout(60000, () => { req.destroy(); reject(new Error('Timeout POST ' + path)); });
    req.on('error', reject); req.write(data); req.end();
  });
}

async function run() {
  const now   = new Date();
  const ts    = now.toLocaleString('de-DE', { timeZone: 'Europe/Berlin' });
  const datum = now.toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' }); // YYYY-MM-DD
  console.log(`\n[${ts}] ⚡ Energie-Abendroutine gestartet`);

  // ── Schritt 1: Shelly /power → c_act_power + Energiezähler ──────────────
  let kwh = null;
  try {
    const data = await get('/api/shelly/power');
    if (data.error) throw new Error(data.error);

    const raw  = data.raw || {};
    const cPow = raw.c_act_power ?? null;
    console.log(`[Shelly] c_act_power=${cPow}W | total_w=${data.total_w}W | einspeisung=${data.einspeisung}`);

    // Alle verfügbaren Felder mit "energy" loggen – hilft beim Ermitteln der richtigen Feldnamen
    const eFelder = Object.keys(raw).filter(k => /energy/i.test(k));
    if (eFelder.length) {
      console.log('[Shelly] Energie-Felder:', eFelder.map(k => `${k}=${raw[k]}`).join(' | '));
    } else {
      console.log('[Shelly] Keine Energie-Felder im raw-Objekt – nur Momentanwerte verfügbar');
    }

    // Kumulierten Energiezähler suchen (Einspeisung = act_ret = rückwärts = PV ins Netz)
    const cRet = raw.c_total_act_ret_energy   // Phase C Einspeisung kumuliert (Wh)
              ?? raw.total_act_ret_energy      // Gesamt-Einspeisung kumuliert (Wh)
              ?? null;

    if (cRet !== null) {
      // ── Tagesdelta via gesterngespeichertem Zählerstand ──────────────────
      const zaehlerKey = 'energie_zaehler_ret_wh';
      const faktRes    = await get('/api/memory/facts?kategorie=energie').catch(() => ({}));
      const gestriger  = parseFloat(faktRes?.energie?.[zaehlerKey] || '0') || 0;

      // Zählerstand für morgen speichern
      await post('/api/memory/save-fact', { kategorie: 'energie', schluessel: zaehlerKey, wert: String(cRet) });

      if (gestriger === 0) {
        console.log(`[Shelly] Erster Lauf – Zählerstand ${cRet} Wh gespeichert. Morgen gibt es das erste Delta.`);
        kwh = 0;
      } else if (cRet >= gestriger && (cRet - gestriger) < 100000) {
        kwh = Math.round((cRet - gestriger) / 100) / 10;
        console.log(`[Shelly] ✅ Tagesertrag: ${kwh} kWh  (Zähler: ${cRet} Wh, gestern: ${gestriger} Wh)`);
      } else {
        console.warn(`[Shelly] Delta unplausibel (${cRet - gestriger} Wh) – überspringe`);
      }

    } else if (cPow !== null) {
      // ── Fallback: c_act_power Momentanwert (21:00 Uhr → kaum PV) ────────
      // Stattdessen: Tagessumme aus gemerkten Samples approximieren
      // Einfachste Näherung: Wert bei Sonnenaufgang bis jetzt integrieren
      // Da wir nur 1 Sample haben → nicht möglich. Log + Hinweis.
      console.warn(`[Shelly] Keine kumulierten Energiezähler in EM.GetStatus.`);
      console.warn(`[Shelly] c_act_power=${cPow}W ist nur Momentanwert – nicht für Tagessumme nutzbar.`);
      console.warn(`[Shelly] Lösung: SHELLY_IP prüfen + /rpc/EMData.GetStatus?id=0 direkt testen`);
      console.warn(`[Shelly] URL: http://${process.env.SHELLY_IP || '192.168.0.120'}/rpc/EMData.GetStatus?id=0`);
    } else {
      console.error('[Shelly] Weder c_act_power noch Energiezähler gefunden. Raw:', JSON.stringify(raw).slice(0, 300));
    }

  } catch(e) {
    console.error('[Shelly] Fehler:', e.message);
  }

  if (!kwh || kwh === 0) {
    console.log(`[${ts}] ⚠️  Kein Ertrag gespeichert (kwh=${kwh})`);
    process.exit(0);
  }

  // ── Schritt 2: EUR berechnen ──────────────────────────────────────────────
  let eurProKwh = 0.082;
  try {
    const faktRes = await get('/api/memory/facts?kategorie=mina').catch(() => ({}));
    const gesetzt = parseFloat(faktRes?.mina?.einspeisung_eur_kwh || '0');
    if (gesetzt > 0) eurProKwh = gesetzt;
  } catch(_) {}

  const eur   = Math.round(kwh * eurProKwh * 100) / 100;
  const zeile = `${datum};${kwh};${eur}`;
  console.log(`[Berechnung] ${kwh} kWh × ${eurProKwh} €/kWh = ${eur} € → Zeile: "${zeile}"`);

  // ── Schritt 3: Direkt in Drive speichern (kein LLM-Umweg) ────────────────
  try {
    const r = await post('/api/drive/append', { name: 'Energieertrag.csv', line: zeile, folder: 'MINA' });
    if (r.ok) {
      console.log(`[${ts}] ✅ Drive gespeichert: ${r.name} (${r.zeilen} Zeilen gesamt)`);
    } else {
      console.error(`[${ts}] ❌ Drive Fehler: ${r.error}`);
    }
  } catch(e) {
    console.error(`[${ts}] ❌ Drive Fehler: ${e.message}`);
  }
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
