/**
 * innovooClaw · modules/drive-indexer.js  v2.0
 * ─────────────────────────────────────────────────────────────────────────────
 * Google Drive → Vektor-Index (RAG-Pipeline Stufe 2)
 *
 * NEU in v2.0:
 *   • PDF-Support via pdf-intelligence.js (Extraktion + Ollama-Zusammenfassung)
 *   • Lokale Embeddings via Ollama (nomic-embed-text) — kein Voyage API-Key nötig
 *   • Voyage AI als optionaler Fallback (wenn VOYAGE_API_KEY gesetzt)
 *   • Fakten-Extraktion pro Dokument (Datum, Betrag, Absender, Typ)
 *
 * Embedding-Priorisierung:
 *   1. Ollama nomic-embed-text (lokal, kostenlos)
 *   2. Voyage AI voyage-3-lite (wenn VOYAGE_API_KEY gesetzt)
 *   3. Textbasierter Fallback (kein Embedding, nur Metadaten)
 * ─────────────────────────────────────────────────────────────────────────────
 */
'use strict';

const https = require('https');
const path  = require('path');
const fs    = require('fs');

// ── Konfiguration ─────────────────────────────────────────────────────────────
const CHUNK_SIZE     = 500;
const CHUNK_OVERLAP  = 80;
const BATCH_SIZE     = 32;   // Kleiner als vorher (Ollama ist langsamer als Voyage)
const MAX_FILE_CHARS = 50000;

const SUPPORTED_MIME = [
  'application/vnd.google-apps.document',
  'application/vnd.google-apps.spreadsheet',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/pdf',  // NEU: PDFs jetzt unterstützt
];

// ── Zustand ───────────────────────────────────────────────────────────────────
let _running    = false;
let _lastRun    = null;
let _lastStats  = null;
let _progress   = { phase: 'idle', current: 0, total: 0, file: '' };
let _embedMode  = 'unknown'; // 'ollama' | 'voyage' | 'none'

// ── Drive API GET ─────────────────────────────────────────────────────────────
function driveGet(accessToken, apiPath) {
  return new Promise((resolve, reject) => {
    const rq = https.request({
      hostname: 'www.googleapis.com', path: apiPath, method: 'GET',
      headers:  { Authorization: 'Bearer ' + accessToken },
    }, (r) => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => { try { resolve(JSON.parse(d)); } catch { reject(new Error('Drive parse: ' + d.slice(0,100))); } });
    });
    rq.on('error', reject);
    rq.setTimeout(20000, () => { rq.destroy(); reject(new Error('Drive Timeout')); });
    rq.end();
  });
}

async function listAllFiles(accessToken) {
  const files = [];
  let pageToken = '';
  const mimeQuery = SUPPORTED_MIME.map(m => `mimeType='${m}'`).join(' or ');
  const query = `(${mimeQuery}) and trashed=false`;
  do {
    const pageParam = pageToken ? `&pageToken=${pageToken}` : '';
    const url = `/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,modifiedTime,size),nextPageToken&pageSize=100${pageParam}`;
    const res = await driveGet(accessToken, url);
    if (res.error) throw new Error('Drive List: ' + (res.error.message || JSON.stringify(res.error)));
    files.push(...(res.files || []));
    pageToken = res.nextPageToken || '';
  } while (pageToken);
  return files;
}

// ── Dateiinhalt lesen ─────────────────────────────────────────────────────────
async function readFileContent(accessToken, file) {
  const { id, mimeType, name } = file;

  const dlGet = (p) => new Promise((resolve, reject) => {
    const rq = https.request({
      hostname: 'www.googleapis.com', path: p, method: 'GET',
      headers:  { Authorization: 'Bearer ' + accessToken },
    }, (r) => { let d = ''; r.on('data', c => d += c); r.on('end', () => resolve(d)); });
    rq.on('error', reject);
    rq.setTimeout(30000, () => { rq.destroy(); reject(new Error('Timeout')); });
    rq.end();
  });

  const dlBinary = (p) => new Promise((resolve, reject) => {
    const rq = https.request({
      hostname: 'www.googleapis.com', path: p, method: 'GET',
      headers:  { Authorization: 'Bearer ' + accessToken },
    }, (r) => {
      const chunks = []; r.on('data', c => chunks.push(c));
      r.on('end', () => resolve(Buffer.concat(chunks)));
    });
    rq.on('error', reject);
    rq.setTimeout(30000, () => { rq.destroy(); reject(new Error('Download Timeout')); });
    rq.end();
  });

  try {
    // ── PDF: Binär herunterladen + pdf-intelligence nutzen ──────────────────
    if (mimeType === 'application/pdf') {
      const pdfIntel  = require('./pdf-intelligence');
      const buffer    = await dlBinary(`/drive/v3/files/${id}?alt=media`);
      const extracted = await pdfIntel.extractText(buffer);

      if (extracted.isScanned || !extracted.text) {
        console.log(`[DriveIndexer] Gescanntes PDF übersprungen: ${name}`);
        return null;
      }

      // Für indexierbare PDFs: Zusammenfassung voranstellen
      let fullText = extracted.text.slice(0, MAX_FILE_CHARS);
      if (fullText.length > 2000) {
        try {
          const summary = await pdfIntel.summarize(fullText, { name });
          if (summary && summary.length > 50) {
            fullText = `[ZUSAMMENFASSUNG]\n${summary}\n\n[VOLLTEXT]\n${fullText.slice(0, MAX_FILE_CHARS - summary.length - 100)}`;
          }
        } catch(e) { /* Zusammenfassung optional */ }
      }

      return fullText;
    }

    // ── Google Docs ──────────────────────────────────────────────────────────
    if (mimeType.includes('google-apps.document'))
      return (await dlGet(`/drive/v3/files/${id}/export?mimeType=text%2Fplain`)).slice(0, MAX_FILE_CHARS);

    // ── Google Sheets ────────────────────────────────────────────────────────
    if (mimeType.includes('google-apps.spreadsheet'))
      return (await dlGet(`/drive/v3/files/${id}/export?mimeType=text%2Fcsv`)).slice(0, MAX_FILE_CHARS);

    // ── Alle anderen (txt, md, csv, json, docx) ──────────────────────────────
    return (await dlGet(`/drive/v3/files/${id}?alt=media`)).slice(0, MAX_FILE_CHARS);

  } catch(e) {
    console.warn(`[DriveIndexer] "${name}" nicht lesbar: ${e.message}`);
    return null;
  }
}

// ── Chunking ──────────────────────────────────────────────────────────────────
function chunkText(text, fileId, fileName) {
  if (!text || text.trim().length < 50) return [];
  const clean = text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  const chunks = [];
  let pos = 0;
  while (pos < clean.length) {
    const end   = Math.min(pos + CHUNK_SIZE, clean.length);
    const chunk = clean.slice(pos, end).trim();
    if (chunk.length > 30) chunks.push({ text: `[${fileName}]\n${chunk}`, fileId, fileName, chunkIndex: chunks.length });
    pos += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks;
}

// ── Embeddings: Ollama → Voyage → Keines ─────────────────────────────────────
async function _detectEmbedMode() {
  if (_embedMode !== 'unknown') return _embedMode;

  // 1. Ollama prüfen
  try {
    const pdfIntel = require('./pdf-intelligence');
    const { available } = await pdfIntel.embedAvailable();
    if (available) { _embedMode = 'ollama'; console.log('\x1b[36m✅ Embeddings\x1b[0m  Ollama (lokal, kostenlos)'); return 'ollama'; }
    else { console.log('\x1b[33m⚠️  Embeddings\x1b[0m  nomic-embed-text nicht in Ollama gefunden → versuche Voyage'); }
  } catch(_) {}

  // 2. Voyage prüfen
  if (process.env.VOYAGE_API_KEY) { _embedMode = 'voyage'; console.log('\x1b[36m✅ Embeddings\x1b[0m  Voyage AI (API-Key gefunden)'); return 'voyage'; }

  // 3. Fallback
  _embedMode = 'none';
  console.log('\x1b[33m⚠️  Embeddings\x1b[0m  Kein Embedding verfügbar – nur Metadaten-Index');
  return 'none';
}

async function _getEmbeddings(texts, mode) {
  if (!texts.length) return [];

  if (mode === 'ollama') {
    const pdfIntel = require('./pdf-intelligence');
    return pdfIntel.embed(texts);
  }

  if (mode === 'voyage') {
    const apiKey = process.env.VOYAGE_API_KEY;
    const body   = JSON.stringify({ model: 'voyage-3-lite', input: texts });
    return new Promise((resolve, reject) => {
      const rq = https.request({
        hostname: 'api.voyageai.com', path: '/v1/embeddings', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey, 'Content-Length': Buffer.byteLength(body) },
      }, (r) => {
        let d = ''; r.on('data', c => d += c);
        r.on('end', () => {
          try {
            const json = JSON.parse(d);
            if (json.error) return reject(new Error(json.error.message));
            resolve(json.data.map(e => e.embedding));
          } catch(e) { reject(new Error('Voyage parse: ' + d.slice(0,100))); }
        });
      });
      rq.on('error', reject);
      rq.setTimeout(30000, () => { rq.destroy(); reject(new Error('Voyage Timeout')); });
      rq.write(body); rq.end();
    });
  }

  // 'none': Null-Embeddings (kein Vektor-Suche möglich, aber Metadaten gespeichert)
  return texts.map(() => null);
}

// ── Batch in LanceDB speichern ────────────────────────────────────────────────
async function _flushBatch(chunks, files, memVec, embedMode) {
  const texts      = chunks.map(c => c.text);
  const embeddings = await _getEmbeddings(texts, embedMode);

  try {
    const tbl = memVec._getTable ? memVec._getTable() : null;
    if (tbl) {
      const entries = chunks
        .map((chunk, i) => {
          const emb = embeddings[i];
          if (!emb) return null; // Überspringen wenn kein Embedding
          return {
            vector:    emb,
            text:      chunk.text.slice(0, 1200),
            agent:     'drive-indexer',
            layer:     'knowledge',
            category:  'drive',
            source:    `drive:${files[i].id}:${chunk.fileName}`,
            timestamp: new Date().toISOString(),
            id:        `drive-${files[i].id}-${chunk.chunkIndex}-${Date.now()}-${i}`,
          };
        })
        .filter(Boolean);

      if (entries.length) await tbl.add(entries);
    } else {
      // Fallback: memory-vector.storeVector ohne Embedding
      for (let i = 0; i < chunks.length; i++) {
        await memVec.storeVector(chunks[i].text, {
          agent: 'drive-indexer', layer: 'knowledge', category: 'drive',
          source: `drive:${files[i].id}:${chunks[i].fileName}`,
        });
      }
    }
  } catch(e) {
    console.warn('[DriveIndexer] Batch speichern fehlgeschlagen:', e.message);
  }
}

// ── Index-Metadaten ───────────────────────────────────────────────────────────
function getIndexPath() {
  const memDir = process.env.MEMORY_DIR || path.join(require('os').homedir(), 'Documents', 'MCP-DATA', 'innovooClaw', 'memory');
  return path.join(memDir, 'drive-index.json');
}
function loadIndexMeta() {
  try { const p = getIndexPath(); if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch(_) {}
  return { indexed: {}, lastRun: null, embedMode: null };
}
function saveIndexMeta(meta) {
  try { fs.writeFileSync(getIndexPath(), JSON.stringify(meta, null, 2), 'utf-8'); } catch(_) {}
}

// ── Haupt-Indexierung ─────────────────────────────────────────────────────────
async function run(options = {}) {
  if (_running) return { ok: false, error: 'Indexierung läuft bereits' };
  _running = true;
  _progress = { phase: 'start', current: 0, total: 0, file: '' };

  const deltaOnly = options.delta || false;
  const stats = {
    files: 0, pdfs: 0, chunks: 0, skipped: 0, errors: 0,
    embedMode: 'unknown',
    startedAt: new Date().toISOString(),
  };

  try {
    // 1. VectorMemory initialisieren
    const memVec = require('./memory-vector');
    if (!memVec.status().ready) {
      await memVec.init();
      if (!memVec.status().ready) throw new Error('VectorMemory nicht bereit');
    }

    // 2. Embedding-Modus bestimmen
    const embedMode = await _detectEmbedMode();
    stats.embedMode = embedMode;

    // 3. Drive-Token holen (intern via localhost)
    const http = require('http');
    const PORT = process.env.PORT || 3000;
    const accessToken = await new Promise((resolve, reject) => {
      const rq = http.request(
        { hostname: 'localhost', port: PORT, path: '/api/drive/token', method: 'GET' },
        (r) => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>{ try{const j=JSON.parse(d);resolve(j.access_token||'');}catch{reject(new Error('Token parse'));} }); }
      );
      rq.on('error', reject);
      rq.setTimeout(5000, () => { rq.destroy(); reject(new Error('Token Timeout')); });
      rq.end();
    });
    if (!accessToken) throw new Error('Kein Drive-Token – Google verbinden: http://localhost:'+PORT+'/auth/google');

    // 4. Dateien auflisten
    _progress.phase = 'listing';
    const allFiles = await listAllFiles(accessToken);
    _progress.total = allFiles.length;

    const indexMeta = loadIndexMeta();
    const filesToProcess = deltaOnly
      ? allFiles.filter(f => {
          const prev = indexMeta.indexed[f.id];
          return !prev || prev.modifiedTime !== f.modifiedTime;
        })
      : allFiles;

    stats.skipped    = allFiles.length - filesToProcess.length;
    _progress.total  = filesToProcess.length;

    // 5. Alten Index löschen (nur bei Vollindexierung)
    if (!deltaOnly) {
      try {
        const tbl = memVec._getTable ? memVec._getTable() : null;
        if (tbl) await tbl.delete(`layer = 'knowledge' AND category = 'drive'`);
      } catch(e) { console.warn('[DriveIndexer] Alten Index löschen:', e.message); }
    }

    // 6. Dateien verarbeiten
    _progress.phase = 'indexing';
    const allChunks  = [];
    const chunkFiles = [];

    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i];
      _progress.current = i + 1;
      _progress.file    = file.name;

      const isPdf = file.mimeType === 'application/pdf';

      try {
        const text = await readFileContent(accessToken, file);
        if (!text) { stats.errors++; continue; }

        const chunks = chunkText(text, file.id, file.name);
        if (!chunks.length) { stats.skipped++; continue; }

        allChunks.push(...chunks);
        for (const c of chunks) chunkFiles.push(file);

        stats.files++;
        if (isPdf) stats.pdfs++;

        indexMeta.indexed[file.id] = {
          name:         file.name,
          mimeType:     file.mimeType,
          modifiedTime: file.modifiedTime,
          chunks:       chunks.length,
          isPdf,
          indexedAt:    new Date().toISOString(),
        };

        // Batch flush
        if (allChunks.length >= BATCH_SIZE) {
          await _flushBatch(allChunks, chunkFiles, memVec, embedMode);
          stats.chunks += allChunks.length;
          allChunks.length  = 0;
          chunkFiles.length = 0;
          console.log(`[DriveIndexer] ${i+1}/${filesToProcess.length} – ${stats.chunks} Chunks gespeichert`);
        }

      } catch(e) {
        console.warn(`[DriveIndexer] "${file.name}": ${e.message}`);
        stats.errors++;
      }
    }

    // Letzten Batch schreiben
    if (allChunks.length) {
      await _flushBatch(allChunks, chunkFiles, memVec, embedMode);
      stats.chunks += allChunks.length;
    }

    indexMeta.lastRun   = new Date().toISOString();
    indexMeta.embedMode = embedMode;
    saveIndexMeta(indexMeta);

    stats.finishedAt = new Date().toISOString();
    _lastStats = stats;
    _lastRun   = new Date();
    _progress  = { phase: 'done', current: filesToProcess.length, total: filesToProcess.length, file: '' };

    console.log(`\x1b[32m✅ DriveIndexer\x1b[0m  ${stats.files} Dateien (${stats.pdfs} PDFs), ${stats.chunks} Chunks [${embedMode}], ${stats.errors} Fehler`);
    return { ok: true, stats };

  } catch(e) {
    _progress = { phase: 'error', current: 0, total: 0, file: e.message };
    console.error('[DriveIndexer] Fehler:', e.message);
    return { ok: false, error: e.message };
  } finally {
    _running = false;
  }
}

async function runDelta() { return run({ delta: true }); }

function status() {
  return {
    running:   _running,
    lastRun:   _lastRun?.toISOString() || null,
    stats:     _lastStats,
    progress:  _progress,
    embedMode: _embedMode,
    indexed:   loadIndexMeta().indexed,
  };
}

module.exports = { run, runDelta, status };
