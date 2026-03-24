/**
 * innovooClaw · modules/memory-indexer.js
 * Indexiert semantic.json + Gmail-Archiv in die Vektor-Wissensbasis.
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const http = require('http');

const MEM_DIR   = process.env.MEMORY_DIR || path.join(require('os').homedir(), 'Documents', 'MCP-DATA', 'innovooClaw', 'memory');
const PORT      = parseInt(process.env.PORT || '3000');
const GMAIL_MAX = 50;

function fetchInternal(urlPath, timeoutMs = 10000) {
  return new Promise((resolve) => {
    const rq = http.request({ hostname: 'localhost', port: PORT, path: urlPath, method: 'GET' },
      (r) => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } }); });
    rq.on('error', () => resolve(null));
    rq.setTimeout(timeoutMs, () => { rq.destroy(); resolve(null); });
    rq.end();
  });
}

function flattenSemantic(obj, prefix = '') {
  const lines = [];
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) lines.push(...flattenSemantic(v, key));
    else if (v !== null && v !== undefined && String(v).trim()) lines.push(`${key}: ${String(v).trim()}`);
  }
  return lines;
}

async function run() {
  let memVec;
  try {
    memVec = require('./memory-vector');
    if (!memVec.status().ready) {
      await memVec.init();
      if (!memVec.status().ready) throw new Error('VectorMemory nicht bereit');
    }
  } catch(e) {
    console.warn('[MemoryIndexer] VectorMemory nicht verfügbar:', e.message);
    return { ok: false, error: e.message };
  }

  const stats = { semantic: 0, emails: 0, errors: 0 };

  try {
    const semPath = path.join(MEM_DIR, 'semantic.json');
    if (fs.existsSync(semPath)) {
      const sem   = JSON.parse(fs.readFileSync(semPath, 'utf-8'));
      const lines = flattenSemantic(sem);
      for (let i = 0; i < lines.length; i += 5) {
        const chunk = lines.slice(i, i + 5).join('\n');
        if (chunk.length < 20) continue;
        await memVec.storeVector(chunk, { agent: 'memory-indexer', layer: 'knowledge', category: 'semantic-facts', source: 'memory:semantic.json' });
        stats.semantic++;
      }
      console.log(`\x1b[36m⟳ MemoryIndexer\x1b[0m  semantic.json: ${stats.semantic} Chunks`);
    }
  } catch(e) { console.warn('[MemoryIndexer] semantic.json:', e.message); stats.errors++; }

  try {
    const gmailData = await fetchInternal(`/api/gmail?limit=${GMAIL_MAX}&q=in:inbox`, 15000);
    if (gmailData?.mails?.length) {
      for (const mail of gmailData.mails) {
        const text = [`Betreff: ${mail.betreff || ''}`, `Von: ${mail.von || ''}`, `Datum: ${(mail.datum || '').slice(0, 10)}`, mail.snippet ? `Inhalt: ${mail.snippet.slice(0, 200)}` : ''].filter(Boolean).join('\n');
        if (text.length < 30) continue;
        await memVec.storeVector(text, { agent: 'memory-indexer', layer: 'knowledge', category: 'email', source: `gmail:${mail.id || ''}:${(mail.betreff || '').slice(0, 50)}` });
        stats.emails++;
      }
      console.log(`\x1b[36m⟳ MemoryIndexer\x1b[0m  Gmail: ${stats.emails} Mails`);
    }
  } catch(e) { console.warn('[MemoryIndexer] Gmail:', e.message); stats.errors++; }

  console.log(`\x1b[32m✅ MemoryIndexer\x1b[0m  ${stats.semantic} Facts + ${stats.emails} Mails indexiert`);
  return { ok: true, stats };
}

module.exports = { run };
