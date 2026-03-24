/**
 * innovooClaw · modules/memory-vector.js  v2
 * ─────────────────────────────────────────────────────────────────────────────
 * Vektor-Gedächtnis-Layer mit Voyage AI als primärem Embedder.
 *
 * Priorität:
 *   1. Voyage AI  (VOYAGE_API_KEY gesetzt)  → voyage-3-lite, 512 Dim
 *   2. @xenova/transformers (Fallback lokal) → all-MiniLM-L6-v2, 384 Dim
 *   3. JSON-Fallback (kein LanceDB)
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const path  = require('path');
const fs    = require('fs');
const https = require('https');

const DB_DIR     = process.env.VECTOR_DB_DIR
  || path.join(process.env.MEMORY_DIR
     || path.join(require('os').homedir(), 'Documents', 'MCP-DATA', 'innovooClaw', 'memory'),
     'lancedb');
const TABLE_NAME  = 'oc_memory';
const MAX_ENTRIES = 5000;
const VOYAGE_MODEL = 'voyage-3-lite';
const VOYAGE_DIM   = 512;
const XENOVA_MODEL = 'Xenova/all-MiniLM-L6-v2';
const XENOVA_DIM   = 384;

let _db = null, _table = null, _embedder = null;
let _useVoyage = false, _embedDim = null, _ready = false, _initErr = null;

async function _voyageEmbed(texts) {
  const apiKey = process.env.VOYAGE_API_KEY || '';
  if (!apiKey) throw new Error('VOYAGE_API_KEY nicht gesetzt');
  const body = JSON.stringify({ model: VOYAGE_MODEL, input: Array.isArray(texts) ? texts : [texts] });
  return new Promise((resolve, reject) => {
    const rq = https.request({
      hostname: 'api.voyageai.com', path: '/v1/embeddings', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}`, 'Content-Length': Buffer.byteLength(body) },
    }, (r) => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => {
        try {
          const json = JSON.parse(d);
          if (json.error) return reject(new Error(json.error.message || JSON.stringify(json.error)));
          resolve(json.data.map(e => e.embedding));
        } catch(e) { reject(new Error('Voyage API parse error: ' + d.slice(0, 200))); }
      });
    });
    rq.on('error', reject);
    rq.setTimeout(15000, () => { rq.destroy(); reject(new Error('Voyage API Timeout')); });
    rq.write(body); rq.end();
  });
}

async function _embed(text) {
  const clean = String(text).slice(0, 2000);
  if (_useVoyage) { const results = await _voyageEmbed([clean]); return results[0]; }
  if (!_embedder) throw new Error('Embedder nicht initialisiert');
  const out = await _embedder(clean, { pooling: 'mean', normalize: true });
  return Array.from(out.data || out[0]?.data || out);
}

async function _createTable() {
  const dummy = {
    vector: new Array(_embedDim).fill(0), text: '__init__', agent: 'system',
    layer: 'semantic', category: 'init', source: '',
    timestamp: new Date().toISOString(), id: 'init-0',
  };
  return await _db.createTable(TABLE_NAME, [dummy]);
}

async function _ensureTable() {
  const tables = await _db.tableNames();
  if (tables.includes(TABLE_NAME)) {
    _table = await _db.openTable(TABLE_NAME);
    try {
      const schema   = await _table.schema();
      const fields   = schema.fields.map(f => f.name);
      const vecField = schema.fields.find(f => f.name === 'vector');
      const currentDim = vecField?.type?.listSize || vecField?.type?.valueType?.listSize;
      const needsRebuild = !fields.includes('source') || (currentDim && currentDim !== _embedDim);
      if (needsRebuild) {
        const reason = !fields.includes('source') ? 'source-Feld fehlt' : `Dimension ${currentDim} → ${_embedDim}`;
        console.log(`\x1b[33m⟳ LanceDB\x1b[0m  Schema-Migration: ${reason}`);
        await _db.dropTable(TABLE_NAME);
        _table = await _createTable();
      } else {
        console.log(`\x1b[32m✅ LanceDB\x1b[0m  Tabelle "${TABLE_NAME}" geöffnet (Dim: ${_embedDim})`);
      }
    } catch(e) { console.warn('[LanceDB] Schema-Check übersprungen:', e.message); }
  } else {
    _table = await _createTable();
    console.log(`\x1b[32m✅ LanceDB\x1b[0m  Tabelle "${TABLE_NAME}" erstellt (Dim: ${_embedDim})`);
  }
}

async function init() {
  if (_ready) return true;
  if (_initErr) return false;
  try {
    const lancedb  = require('@lancedb/lancedb');
    const voyageKey = process.env.VOYAGE_API_KEY || '';
    if (voyageKey) {
      try { await _voyageEmbed(['test']); _useVoyage = true; _embedDim = VOYAGE_DIM; console.log(`\x1b[32m✅ Voyage AI\x1b[0m  ${VOYAGE_MODEL} (${VOYAGE_DIM} Dim) aktiv`); }
      catch(e) { console.warn(`\x1b[33m⚠️  Voyage AI\x1b[0m  ${e.message} → Xenova Fallback`); _useVoyage = false; _embedDim = XENOVA_DIM; }
    } else {
      _useVoyage = false; _embedDim = XENOVA_DIM;
    }
    if (!_useVoyage) {
      const { pipeline } = require('@xenova/transformers');
      _embedder = await pipeline('feature-extraction', XENOVA_MODEL);
    }
    if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
    _db = await lancedb.connect(DB_DIR);
    await _ensureTable();
    _ready = true;
    console.log(`\x1b[32m✅ VectorMemory\x1b[0m  Bereit | ${_useVoyage ? 'Voyage AI' : 'Xenova'} | DB: ${DB_DIR}`);
    return true;
  } catch(e) {
    _initErr = e.message;
    console.warn('\x1b[33m⚠️  VectorMemory\x1b[0m  Nicht verfügbar – Fallback auf JSON.\n   Fehler:', e.message);
    return false;
  }
}

async function storeVector(text, metadata = {}) {
  if (!_ready || !text || typeof text !== 'string') return false;
  const sanitized = _sanitize(text);
  if (!sanitized) return false;
  try {
    const vector = await _embed(sanitized);
    const entry  = {
      vector, text: sanitized.slice(0, 1200),
      agent:     (metadata.agent    || 'system').toLowerCase(),
      layer:     (metadata.layer    || 'episodic'),
      category:  (metadata.category || 'general'),
      source:    (metadata.source   || ''),
      timestamp: new Date().toISOString(),
      id:        `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    };
    await _table.add([entry]);
    try { const count = await _table.countRows(); if (count > MAX_ENTRIES) await _table.delete(`id = 'init-0'`); } catch(_) {}
    return true;
  } catch(e) { console.warn('[VectorMemory] storeVector Fehler:', e.message); return false; }
}

async function recall(query, agent = null, limit = 5) {
  if (!_ready || !query) return [];
  try {
    const qVector = await _embed(query);
    const results = await _table.vectorSearch(qVector).limit(limit * 2).toArray();
    let filtered = results.filter(r => r.text !== '__init__' && r.id !== 'init-0');
    if (agent) filtered = filtered.filter(r => r.agent === agent.toLowerCase() || r.layer === 'semantic');
    return filtered.slice(0, limit).map(r => ({
      text: r.text, agent: r.agent, layer: r.layer, category: r.category,
      source: r.source || '', timestamp: r.timestamp,
      score: r._distance != null ? Math.round((1 - r._distance) * 100) / 100 : null,
    }));
  } catch(e) { console.warn('[VectorMemory] recall Fehler:', e.message); return []; }
}

async function recallMulti(queries, agent = null, limitPerQuery = 3) {
  if (!_ready || !queries?.length) return [];
  try {
    let embeddings;
    if (_useVoyage) embeddings = await _voyageEmbed(queries.map(q => String(q).slice(0, 2000)));
    else            embeddings = await Promise.all(queries.map(q => _embed(q)));
    const allResults = [];
    for (let i = 0; i < queries.length; i++) {
      const results = await _table.vectorSearch(embeddings[i]).limit(limitPerQuery * 2).toArray();
      allResults.push(...results.filter(r => r.text !== '__init__').slice(0, limitPerQuery));
    }
    const seen = new Set();
    return allResults
      .filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; })
      .sort((a, b) => (a._distance || 0) - (b._distance || 0))
      .map(r => ({ text: r.text, agent: r.agent, layer: r.layer, category: r.category, source: r.source || '', timestamp: r.timestamp, score: r._distance != null ? Math.round((1 - r._distance) * 100) / 100 : null }));
  } catch(e) { console.warn('[VectorMemory] recallMulti Fehler:', e.message); return []; }
}

async function kbSearch(query, limit = 8) {
  if (!_ready || !query) return [];
  try {
    const qVector = await _embed(query);
    const results = await _table.vectorSearch(qVector).limit(limit * 3).toArray();
    return results
      .filter(r => r.text !== '__init__' && r.id !== 'init-0' && (r.layer === 'knowledge' || r.layer === 'semantic'))
      .slice(0, limit)
      .map(r => ({ text: r.text, source: r.source || '', category: r.category, timestamp: r.timestamp, score: r._distance != null ? Math.round((1 - r._distance) * 100) / 100 : null }));
  } catch(e) { console.warn('[VectorMemory] kbSearch Fehler:', e.message); return []; }
}

async function getLatestFacts(n = 5) {
  if (!_ready) return [];
  try {
    const all = await _table.query().where(`layer = 'semantic' AND text != '__init__'`).limit(200).toArray();
    return all.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, n)
      .map(r => ({ text: r.text, agent: r.agent, category: r.category, timestamp: r.timestamp }));
  } catch(e) { console.warn('[VectorMemory] getLatestFacts Fehler:', e.message); return []; }
}

function status() {
  return { ready: _ready, error: _initErr || null, embedder: _useVoyage ? `voyage-ai:${VOYAGE_MODEL}` : `xenova:${XENOVA_MODEL}`, dim: _embedDim, dbDir: DB_DIR };
}

function _getTable() { return _table || null; }

const _SENSITIVE_RX = [
  /sk-ant-[\w-]{10,}/gi, /xoxb-[\w-]{10,}/gi, /xoxp-[\w-]{10,}/gi,
  /GOCSPX-[\w-]{10,}/gi, /AIza[\w-]{30,}/gi, /ghp_[\w]{30,}/gi,
  /pa-[\w-]{20,}/gi, /pplx-[\w-]{20,}/gi, /BSA[\w-]{20,}/gi,
  /password\s*[:=]\s*\S+/gi, /passwort\s*[:=]\s*\S+/gi,
  /api[_-]?key\s*[:=]\s*\S+/gi, /secret\s*[:=]\s*\S+/gi,
  /token\s*[:=]\s*[A-Za-z0-9_-]{16,}/gi,
];

function _sanitize(text) {
  let t = text;
  for (const rx of _SENSITIVE_RX) t = t.replace(rx, '[REDACTED]');
  if ((t.match(/\[REDACTED\]/g) || []).length > 3) return null;
  return t.trim();
}

module.exports = { init, storeVector, recall, recallMulti, kbSearch, getLatestFacts, status, _getTable };
