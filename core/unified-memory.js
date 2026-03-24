// ─── innovooClaw · core/unified-memory.js ────────────────────────────────────
// Einheitlicher Speicherzugriff für alle Layer (episodic, semantic, procedural).
// Ersetzt alle direkten fs.readFileSync/writeFileSync-Aufrufe in proxy.js.
'use strict';

const fs   = require('fs');
const path = require('path');

const MEM_DIR = process.env.MEMORY_DIR
  || path.join(require('os').homedir(), 'Documents', 'MCP-DATA', 'innovooClaw', 'memory');

// ── In-Memory-Cache (vermeidet wiederholtes Lesen) ───────────────────────────
const _cache = {};

// ── JSON-Layer lesen ──────────────────────────────────────────────────────────
function readLayer(layer) {
  if (_cache[layer]) return _cache[layer];
  const filePath = path.join(MEM_DIR, `${layer}.json`);
  try {
    if (fs.existsSync(filePath)) {
      _cache[layer] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } else {
      _cache[layer] = _defaultForLayer(layer);
    }
  } catch(e) {
    console.warn(`[UnifiedMemory] readLayer(${layer}) Fehler:`, e.message);
    _cache[layer] = _defaultForLayer(layer);
  }
  return _cache[layer];
}

// ── JSON-Layer schreiben ──────────────────────────────────────────────────────
function writeLayer(layer, data) {
  _cache[layer] = data;
  const filePath = path.join(MEM_DIR, `${layer}.json`);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch(e) {
    console.warn(`[UnifiedMemory] writeLayer(${layer}) Fehler:`, e.message);
    return false;
  }
}

// ── Cache invalidieren (nach externem Schreiben) ──────────────────────────────
function invalidate(layer) {
  delete _cache[layer];
}

// ── Standardwerte pro Layer ───────────────────────────────────────────────────
function _defaultForLayer(layer) {
  switch(layer) {
    case 'episodic': return { eintraege: [] };
    case 'semantic': return {};
    case 'procedural': return {};
    case 'routing-overrides': return { overrides: [], defaultAgent: 'otto' };
    default: return {};
  }
}

// ── Convenience: Fakt lesen ───────────────────────────────────────────────────
function getFact(category, key) {
  const sem = readLayer('semantic');
  return sem[category]?.[key] ?? null;
}

// ── Convenience: Fakt speichern ───────────────────────────────────────────────
function saveFact(category, key, value) {
  const sem = readLayer('semantic');
  if (!sem[category]) sem[category] = {};
  sem[category][key] = value;
  writeLayer('semantic', sem);
  return true;
}

// ── Episodischen Eintrag hinzufügen ───────────────────────────────────────────
function saveEpisode(agent, aktion, typ = 'user-msg') {
  const epi = readLayer('episodic');
  if (!Array.isArray(epi.eintraege)) epi.eintraege = [];
  const now = new Date();
  epi.eintraege.push({
    datum: now.toISOString().slice(0, 10),
    zeit:  now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
    agent: agent.toUpperCase(),
    typ,
    aktion: String(aktion).slice(0, 120),
  });
  // Maximal 200 Einträge
  if (epi.eintraege.length > 200) epi.eintraege = epi.eintraege.slice(-200);
  writeLayer('episodic', epi);
}

// ── Dialog-History speichern ──────────────────────────────────────────────────
function saveDialogEntry(agent, userMsg, reply) {
  const hist = readLayer('dialog-history');
  if (!Array.isArray(hist.dialogs)) hist.dialogs = [];
  hist.dialogs.push({
    agent,
    user:  userMsg.slice(0, 300),
    reply: reply.slice(0, 800),
    ts:    new Date().toISOString(),
  });
  // Maximal 500 Dialog-Einträge
  if (hist.dialogs.length > 500) hist.dialogs = hist.dialogs.slice(-500);
  writeLayer('dialog-history', hist);
}

// ── Dialog-History lesen (für /api/dialog/history) ───────────────────────────
function getDialogHistory(agent, limit = 5, offset = 0) {
  const hist = readLayer('dialog-history');
  const all  = (hist.dialogs || []).filter(d => d.agent === agent).reverse();
  const page = all.slice(offset, offset + limit);
  return {
    dialogs:  page,
    total:    all.length,
    hasMore:  offset + limit < all.length,
  };
}

// ── Vektorsuche (delegiert an memory-vector.js) ───────────────────────────────
async function recall(query, options = {}) {
  try {
    const memVec = require('../modules/memory-vector');
    if (!memVec.status().ready) await memVec.init();
    if (!memVec.status().ready) return [];
    return await memVec.recall(query, options.agent || null, options.limit || 5);
  } catch(e) {
    console.warn('[UnifiedMemory] recall Fehler:', e.message);
    return [];
  }
}

// ── Vektor speichern ──────────────────────────────────────────────────────────
async function store(text, meta = {}) {
  try {
    const memVec = require('../modules/memory-vector');
    if (!memVec.status().ready) await memVec.init();
    return await memVec.storeVector(text, meta);
  } catch(e) {
    console.warn('[UnifiedMemory] store Fehler:', e.message);
    return false;
  }
}

// ── HTTP-API-Handler (für /api/memory/* Endpoints) ───────────────────────────
async function handleApi(req, res, pathname, urlObj) {
  const json = (obj, status = 200) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(obj));
  };

  // GET /api/memory/read?file=semantic
  if (req.method === 'GET' && pathname === '/api/memory/read') {
    const file = urlObj.searchParams.get('file') || 'semantic';
    return json(readLayer(file));
  }

  // POST /api/memory/write?file=semantic
  if (req.method === 'POST' && pathname.startsWith('/api/memory/write')) {
    const file = urlObj.searchParams.get('file') || 'semantic';
    const body = await _readBody(req);
    try {
      const data = JSON.parse(body);
      writeLayer(file, data);
      return json({ ok: true });
    } catch { return json({ error: 'Invalid JSON' }, 400); }
  }

  // GET /api/memory/search?q=...&agent=...&limit=5
  if (req.method === 'GET' && pathname === '/api/memory/search') {
    const q     = urlObj.searchParams.get('q') || '';
    const agent = urlObj.searchParams.get('agent') || null;
    const limit = parseInt(urlObj.searchParams.get('limit') || '5');
    const hits  = await recall(q, { agent, limit });
    return json({ hits });
  }

  // POST /api/memory/vector
  if (req.method === 'POST' && pathname === '/api/memory/vector') {
    const body = await _readBody(req);
    try {
      const { text, agent, layer, category, source } = JSON.parse(body);
      const ok = await store(text, { agent, layer, category, source });
      return json({ ok });
    } catch { return json({ error: 'Invalid JSON' }, 400); }
  }

  // POST /api/memory/save-fact
  if (req.method === 'POST' && pathname === '/api/memory/save-fact') {
    const body = await _readBody(req);
    try {
      const { kategorie, schluessel, wert } = JSON.parse(body);
      saveFact(kategorie, schluessel, wert);
      return json({ ok: true });
    } catch { return json({ error: 'Invalid JSON' }, 400); }
  }

  // GET /api/dialog/history?agent=otto&limit=5&offset=0
  if (req.method === 'GET' && pathname === '/api/dialog/history') {
    const agent  = urlObj.searchParams.get('agent') || 'otto';
    const limit  = parseInt(urlObj.searchParams.get('limit')  || '5');
    const offset = parseInt(urlObj.searchParams.get('offset') || '0');
    return json(getDialogHistory(agent, limit, offset));
  }

  // POST /api/dialog/save
  if (req.method === 'POST' && pathname === '/api/dialog/save') {
    const body = await _readBody(req);
    try {
      const { agent, user, reply } = JSON.parse(body);
      saveDialogEntry(agent, user || '', reply || '');
      return json({ ok: true });
    } catch { return json({ error: 'Invalid JSON' }, 400); }
  }

  res.writeHead(404); res.end('Not found');
}

function _readBody(req) {
  return new Promise(r => { let d = ''; req.on('data', c => d += c); req.on('end', () => r(d)); });
}

module.exports = {
  readLayer, writeLayer, invalidate,
  getFact, saveFact,
  saveEpisode, saveDialogEntry, getDialogHistory,
  recall, store,
  handleApi,
  MEM_DIR,
};
