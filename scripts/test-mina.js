// test-mina.js — testet Namenserkennung und MINA Drive-Zugriff
'use strict';
const http = require('http');

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost', port: 3000, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({ raw: d }); } });
    });
    req.setTimeout(60000, () => { req.destroy(); reject(new Error('Timeout 60s')); });
    req.on('error', reject);
    req.write(data); req.end();
  });
}

async function run() {
  console.log('\n══════════════════════════════════════════');
  console.log(' MINA Test – Namenserkennung + Kontostand');
  console.log('══════════════════════════════════════════\n');

  // Test 1: Webhook-Routing "Mina, mein Kontostand?"
  console.log('TEST 1: Webhook → "Mina, mein Kontostand?"');
  const w = await post('/api/telegram/webhook', {
    update_id: 999100,
    message: {
      message_id: 10,
      from: { id: 8557984309, first_name: 'Manfred' },
      chat: { id: 8557984309, type: 'private' },
      text: 'Mina, mein Kontostand?'
    }
  });
  console.log('  Webhook Antwort:', JSON.stringify(w));
  console.log('  → Warte 45s auf Telegram-Nachricht...\n');
  await new Promise(r => setTimeout(r, 45000));

  // Test 2: MINA direkt
  console.log('TEST 2: MINA direkt → driveList("MINA")');
  const r = await post('/api/agent/mina', { message: 'Kontostand bitte', maxTokens: 1200 });
  console.log(`  ok=${r.ok} | agent=${r.agent}`);
  console.log(`  reply (${(r.reply||'').length} Zeichen):\n  ${(r.reply||'').slice(0, 300)}`);

  console.log('\n══════════════════════════════════════════\n');
}

run().catch(console.error);
