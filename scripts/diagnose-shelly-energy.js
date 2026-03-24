// innovooClaw · diagnose-shelly-energy.js
// Zeigt alle Shelly-Energiefelder im Rohformat
'use strict';
const http = require('http');

function get(path) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname:'localhost', port:3000, path, method:'GET' }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({ raw: d }); } });
    });
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.on('error', reject); req.end();
  });
}

async function run() {
  console.log('\n=== Shelly EMData (alle Energiefelder) ===\n');

  const data = await get('/api/shelly/data');
  const raw = data.raw || {};

  console.log('Alle Felder mit "energy" oder "ret" im Namen:');
  for (const [k, v] of Object.entries(raw)) {
    if (/energy|ret|kwh|total/i.test(k)) {
      console.log(`  ${k}: ${v}`);
    }
  }

  console.log('\nAlle numerischen Felder:');
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'number') {
      console.log(`  ${k}: ${v}`);
    }
  }

  console.log('\nVollständige raw-Antwort:');
  console.log(JSON.stringify(raw, null, 2));

  console.log('\n=== Power (Echtzeit) ===');
  const power = await get('/api/shelly/power');
  console.log(JSON.stringify(power, null, 2));
}

run().catch(console.error);
