// ─── telegram-debug.js ───────────────────────────────────────────────────────
// Direkt ausführen: node telegram-debug.js
// Zeigt exakt was passiert ohne Telegram dazwischen
'use strict';

const http  = require('http');
const https = require('https');

const PORT    = 3000;
const TOKEN   = '8674561606:AAF374rGFoFuHid6IyqgqtPFeItxm1dLmmw';
const CHAT_ID = '8557984309';

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────
function postLocal(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req  = http.request({
      hostname: 'localhost', port: PORT, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, body: d }); } });
    });
    req.setTimeout(60000, () => { req.destroy(); reject(new Error('Timeout 60s')); });
    req.on('error', reject);
    req.write(data); req.end();
  });
}

function telegramSend(text) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ chat_id: CHAT_ID, text: text.slice(0, 4096) });
    const rq = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${TOKEN}/sendMessage`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({ raw: d }); } });
    });
    rq.on('error', e => resolve({ ok: false, error: e.message }));
    rq.setTimeout(10000, () => { rq.destroy(); resolve({ ok: false, error: 'Timeout' }); });
    rq.write(body); rq.end();
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────
async function run() {
  console.log('\n════════════════════════════════════════════');
  console.log(' innovooClaw Telegram Debug');
  console.log('════════════════════════════════════════════\n');

  // TEST 1: Server erreichbar?
  console.log('TEST 1: Server localhost:3000 erreichbar?');
  try {
    const r = await postLocal('/api/telegram/webhook', {
      update_id: 999001,
      message: { message_id: 1, from: { id: 8557984309, first_name: 'Debug' },
        chat: { id: 8557984309, type: 'private' }, text: '/start' }
    });
    console.log(`  → HTTP ${r.status} | Body: ${JSON.stringify(r.body)}`);
  } catch(e) {
    console.error(`  ❌ Server NICHT erreichbar: ${e.message}`);
    console.error('  → innovooclaw-start.bat ausführen!');
    process.exit(1);
  }

  // TEST 2: Agent direkt aufrufen
  console.log('\nTEST 2: OTTO direkt /api/agent/otto');
  try {
    const r = await postLocal('/api/agent/otto', { message: 'Kurzer Test', maxTokens: 200 });
    console.log(`  → HTTP ${r.status} | ok=${r.body.ok} | agent=${r.body.agent}`);
    console.log(`  → reply (${(r.body.reply||'').length} Zeichen): ${(r.body.reply||'').slice(0,100)}`);
  } catch(e) {
    console.error(`  ❌ OTTO Fehler: ${e.message}`);
  }

  // TEST 3: Telegram sendMessage direkt
  console.log('\nTEST 3: Telegram sendMessage (ohne Server)');
  const tResult = await telegramSend('🔧 Debug-Test von telegram-debug.js');
  console.log(`  → ok=${tResult.ok} | error=${tResult.error||'-'} | description=${tResult.description||'-'}`);
  if (!tResult.ok) {
    console.error(`  ❌ Telegram-Fehler: ${JSON.stringify(tResult)}`);
  }

  // TEST 4: Webhook simulieren mit "Vera, dein Status"
  console.log('\nTEST 4: Webhook simulieren → "Vera, dein Status"');
  try {
    const r = await postLocal('/api/telegram/webhook', {
      update_id: 999002,
      message: { message_id: 2, from: { id: 8557984309, first_name: 'Manfred' },
        chat: { id: 8557984309, type: 'private' }, text: 'Vera, dein Status' }
    });
    console.log(`  → HTTP ${r.status} | Body: ${JSON.stringify(r.body)}`);
    console.log('  → Warte 30s auf Telegram-Antwort...');
    await new Promise(r => setTimeout(r, 30000));
    console.log('  → 30s vergangen – hat Telegram eine Nachricht erhalten?');
  } catch(e) {
    console.error(`  ❌ Fehler: ${e.message}`);
  }

  console.log('\n════════════════════════════════════════════');
  console.log(' Fertig – prüfe Telegram und Node.js-Konsole');
  console.log('════════════════════════════════════════════\n');
}

run().catch(console.error);
