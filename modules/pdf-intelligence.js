// ─── innovooClaw · modules/pdf-intelligence.js ───────────────────────────────
// PDF-Extraktion + Ollama-basierte Intelligenz (lokal, kein API-Key nötig)
//
// Features:
//   • PDF-Text-Extraktion via pdf-parse (bereits im package.json)
//   • Lokale Embeddings via Ollama (nomic-embed-text) — kein Voyage AI Key nötig
//   • Ollama-Zusammenfassung für lange Dokumente
//   • Strukturierte Fakten-Extraktion (Datum, Betrag, Personen, Schlüsselbegriffe)
//   • Caching (JSON-Index) um Re-Analyse zu vermeiden
//
// Verwendung:
//   const pdfIntel = require('./modules/pdf-intelligence');
//   const result = await pdfIntel.analyzeBuffer(pdfBuffer, { name: 'Rechnung.pdf' });
//   const embeddings = await pdfIntel.embed(['Text 1', 'Text 2']);
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const https = require('https');
const http  = require('http');
const path  = require('path');
const fs    = require('fs');

const OLLAMA_URL   = process.env.OLLAMA_URL   || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b';
const EMBED_MODEL  = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';

const CACHE_FILE   = path.join(
  process.env.MEMORY_DIR || path.join(require('os').homedir(), 'Documents', 'MCP-DATA', 'innovooClaw', 'memory'),
  'pdf-cache.json'
);

// ── Cache ─────────────────────────────────────────────────────────────────────
let _cache = null;

function _loadCache() {
  if (_cache) return _cache;
  try {
    if (fs.existsSync(CACHE_FILE)) _cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    else _cache = {};
  } catch(_) { _cache = {}; }
  return _cache;
}

function _saveCache() {
  try { fs.writeFileSync(CACHE_FILE, JSON.stringify(_cache, null, 2), 'utf-8'); } catch(_) {}
}

function _cacheKey(fileId, modifiedTime) {
  return `${fileId}__${(modifiedTime || '').replace(/[^0-9]/g, '')}`;
}

// ── PDF Text-Extraktion ───────────────────────────────────────────────────────
async function extractText(buffer) {
  try {
    // pdf-parse erwartet einen Buffer
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer, {
      // Nur Text extrahieren, keine Metadaten
      max: 0,
    });
    return {
      text:      (data.text || '').trim(),
      pages:     data.numpages || 0,
      info:      data.info     || {},
      isScanned: (data.text || '').trim().length < 100 && (data.numpages || 0) > 0,
    };
  } catch(e) {
    console.warn('[PdfIntel] pdf-parse Fehler:', e.message);
    return { text: '', pages: 0, info: {}, isScanned: true, error: e.message };
  }
}

// ── Ollama: lokale Embeddings ─────────────────────────────────────────────────
async function embed(texts) {
  if (!texts || !texts.length) return [];

  // Ollama Embedding Endpoint
  const ollamaHost = new URL(OLLAMA_URL);
  const isHttps    = ollamaHost.protocol === 'https:';
  const lib        = isHttps ? https : http;

  const embeddings = [];

  for (const text of texts) {
    const body = JSON.stringify({ model: EMBED_MODEL, prompt: text.slice(0, 4096) });

    try {
      const embedding = await new Promise((resolve, reject) => {
        const rq = lib.request({
          hostname: ollamaHost.hostname,
          port:     parseInt(ollamaHost.port || (isHttps ? '443' : '80')),
          path:     '/api/embeddings',
          method:   'POST',
          headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        }, (r) => {
          let d = ''; r.on('data', c => d += c);
          r.on('end', () => {
            try {
              const json = JSON.parse(d);
              if (json.embedding) resolve(json.embedding);
              else reject(new Error('Kein Embedding in Antwort: ' + d.slice(0, 100)));
            } catch(e) { reject(new Error('Ollama Embedding parse: ' + d.slice(0, 100))); }
          });
        });
        rq.on('error', reject);
        rq.setTimeout(15000, () => { rq.destroy(); reject(new Error('Ollama Embedding Timeout')); });
        rq.write(body); rq.end();
      });
      embeddings.push(embedding);
    } catch(e) {
      console.warn('[PdfIntel] Embedding fehlgeschlagen für Text-Chunk:', e.message);
      embeddings.push(null); // Null-Embedding → wird beim Flush übersprungen
    }
  }

  return embeddings;
}

// Hilfsfunktion: Ollama verfügbar + Embedding-Modell geladen?
async function isEmbedModelAvailable() {
  try {
    const ollamaHost = new URL(OLLAMA_URL);
    const lib        = (ollamaHost.protocol === 'https:') ? https : http;
    const data = await new Promise((resolve, reject) => {
      const rq = lib.request({
        hostname: ollamaHost.hostname,
        port:     parseInt(ollamaHost.port || '11434'),
        path:     '/api/tags',
        method:   'GET',
      }, r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>{ try{resolve(JSON.parse(d));}catch{reject(new Error('parse'));} }); });
      rq.on('error', reject);
      rq.setTimeout(3000, () => { rq.destroy(); reject(new Error('Timeout')); });
      rq.end();
    });
    const models = (data.models || []).map(m => m.name);
    const found  = models.some(m => m.startsWith(EMBED_MODEL.split(':')[0]));
    return { available: found, models };
  } catch(e) {
    return { available: false, error: e.message };
  }
}

// ── Ollama: Dokument zusammenfassen ──────────────────────────────────────────
async function summarize(text, context = {}) {
  if (!text || text.trim().length < 200) return text.trim();

  const prompt = context.prompt || `Fasse dieses Dokument kurz und strukturiert zusammen. Extrahiere:
1. Dokumenttyp (Rechnung, Vertrag, Brief, Bericht, ...)
2. Datum (falls vorhanden)
3. Wichtigste Parteien/Personen/Organisationen
4. Kerninhalt in 3-5 Sätzen
5. Wichtige Zahlen/Beträge (falls vorhanden)

Dokument:
${text.slice(0, 6000)}

Antworte auf Deutsch, strukturiert und präzise.`;

  const ollamaHost = new URL(OLLAMA_URL);
  const isHttps    = ollamaHost.protocol === 'https:';
  const lib        = isHttps ? https : http;
  const body       = JSON.stringify({
    model:   OLLAMA_MODEL,
    messages: [{ role: 'user', content: prompt }],
    stream:  false,
    options: { num_predict: 600, temperature: 0.3 },
  });

  try {
    const result = await new Promise((resolve, reject) => {
      const rq = lib.request({
        hostname: ollamaHost.hostname,
        port:     parseInt(ollamaHost.port || '11434'),
        path:     '/api/chat',
        method:   'POST',
        headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      }, (r) => {
        let d = ''; r.on('data', c => d += c);
        r.on('end', () => {
          try { resolve(JSON.parse(d).message?.content || ''); }
          catch(e) { reject(new Error('Ollama parse: ' + d.slice(0, 100))); }
        });
      });
      rq.on('error', reject);
      rq.setTimeout(60000, () => { rq.destroy(); reject(new Error('Ollama Summary Timeout')); });
      rq.write(body); rq.end();
    });
    return result.trim();
  } catch(e) {
    console.warn('[PdfIntel] Ollama Zusammenfassung fehlgeschlagen:', e.message);
    return text.slice(0, 800) + ' [Zusammenfassung fehlgeschlagen]';
  }
}

// ── Fakten extrahieren (Datum, Betrag, Personen) ──────────────────────────────
async function extractFacts(text) {
  if (!text || text.length < 100) return {};

  const prompt = `Extrahiere strukturierte Fakten aus diesem Text. Antworte NUR mit einem JSON-Objekt, kein Markdown.

Text:
${text.slice(0, 3000)}

Extrahiere (nur wenn vorhanden, sonst null):
{
  "dokumenttyp": "Rechnung|Vertrag|Brief|Bericht|Kontoauszug|Sonstiges",
  "datum": "YYYY-MM-DD oder null",
  "absender": "Name/Organisation oder null",
  "empfaenger": "Name/Organisation oder null",
  "betrag": "Zahl in EUR oder null",
  "waehrung": "EUR|USD|CHF oder null",
  "betreff": "Kurzbetreff in max. 60 Zeichen",
  "schluessel": ["max. 5 Schlüsselbegriffe"]
}`;

  try {
    const ollamaHost = new URL(OLLAMA_URL);
    const isHttps    = ollamaHost.protocol === 'https:';
    const lib        = isHttps ? https : http;
    const body       = JSON.stringify({
      model:   OLLAMA_MODEL,
      messages: [{ role: 'user', content: prompt }],
      stream:  false,
      options: { num_predict: 300, temperature: 0.1 },
    });
    const raw = await new Promise((resolve, reject) => {
      const rq = lib.request({
        hostname: ollamaHost.hostname,
        port:     parseInt(ollamaHost.port || '11434'),
        path:     '/api/chat',
        method:   'POST',
        headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      }, (r) => {
        let d = ''; r.on('data', c => d += c);
        r.on('end', () => {
          try { resolve(JSON.parse(d).message?.content || '{}'); }
          catch { reject(new Error('parse')); }
        });
      });
      rq.on('error', reject);
      rq.setTimeout(30000, () => { rq.destroy(); reject(new Error('Timeout')); });
      rq.write(body); rq.end();
    });
    const cleaned = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  } catch(e) {
    // Regex-Fallback für die wichtigsten Felder
    const facts = {};
    const dateMatch = text.match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/);
    if (dateMatch) {
      const [, d, m, y] = dateMatch;
      facts.datum = `${y.length === 2 ? '20'+y : y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    }
    const amountMatch = text.match(/(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2}))\s*(?:EUR|€)/i);
    if (amountMatch) facts.betrag = parseFloat(amountMatch[1].replace(/\./g,'').replace(',','.'));
    return facts;
  }
}

// ── Text in Chunks aufteilen ─────────────────────────────────────────────────
function chunkText(text, { chunkSize = 500, overlap = 80, fileName = '', fileId = '' } = {}) {
  if (!text || text.trim().length < 50) return [];
  const clean = text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  const chunks = [];
  let pos = 0;
  while (pos < clean.length) {
    const end   = Math.min(pos + chunkSize, clean.length);
    const chunk = clean.slice(pos, end).trim();
    if (chunk.length > 30) {
      chunks.push({
        text:       fileName ? `[${fileName}]\n${chunk}` : chunk,
        fileId,
        fileName,
        chunkIndex: chunks.length,
      });
    }
    pos += chunkSize - overlap;
  }
  return chunks;
}

// ── Vollständige PDF-Analyse ──────────────────────────────────────────────────
// buffer: Buffer des PDF
// options: { name, fileId, modifiedTime, withSummary, withFacts, withEmbeddings }
async function analyzeBuffer(buffer, options = {}) {
  const {
    name         = 'Dokument.pdf',
    fileId       = '',
    modifiedTime = '',
    withSummary    = true,
    withFacts      = true,
    withEmbeddings = false,
  } = options;

  // Cache prüfen
  if (fileId && modifiedTime) {
    const cache = _loadCache();
    const key   = _cacheKey(fileId, modifiedTime);
    if (cache[key]) {
      console.log(`[PdfIntel] Cache-Hit: ${name}`);
      return { ...cache[key], fromCache: true };
    }
  }

  console.log(`[PdfIntel] Analysiere: ${name} (${Math.round(buffer.length / 1024)} KB)`);
  const startTime = Date.now();

  // 1. Text extrahieren
  const extracted = await extractText(buffer);
  const { text, pages, isScanned, info } = extracted;

  if (isScanned || !text) {
    const result = {
      ok: true, name, fileId, pages,
      isScanned: true,
      text: '',
      summary: `[Gescanntes PDF – ${pages} Seiten – Text nicht direkt extrahierbar]`,
      facts: {},
      chunks: [],
      embeddings: [],
      processingMs: Date.now() - startTime,
    };
    if (fileId && modifiedTime) {
      _loadCache()[_cacheKey(fileId, modifiedTime)] = result;
      _saveCache();
    }
    return result;
  }

  // 2. Parallel: Zusammenfassung + Fakten
  const [summary, facts] = await Promise.all([
    withSummary ? summarize(text, { name })       : Promise.resolve(text.slice(0, 400)),
    withFacts   ? extractFacts(text)               : Promise.resolve({}),
  ]);

  // 3. Chunks erstellen
  const chunks = chunkText(text, { fileName: name, fileId });

  // 4. Optional: Embeddings für alle Chunks
  let embeddings = [];
  if (withEmbeddings && chunks.length) {
    const chunkTexts = chunks.map(c => c.text);
    embeddings = await embed(chunkTexts);
    console.log(`[PdfIntel] ${embeddings.filter(Boolean).length}/${chunks.length} Embeddings erzeugt`);
  }

  const result = {
    ok:     true,
    name,   fileId, pages,
    isScanned: false,
    textLength: text.length,
    text:   text.slice(0, 2000),  // gekürzt für Antwort, voller Text in chunks
    summary,
    facts,
    chunks: chunks.map((c, i) => ({ ...c, embedding: embeddings[i] || null })),
    info:   { title: info?.Title || '', author: info?.Author || '', created: info?.CreationDate || '' },
    processingMs: Date.now() - startTime,
  };

  // Cache speichern
  if (fileId && modifiedTime) {
    // Embeddings nicht im Cache (zu groß) — nur Metadaten
    const cacheEntry = { ...result, chunks: chunks.map(c => ({ ...c, embedding: null })) };
    _loadCache()[_cacheKey(fileId, modifiedTime)] = cacheEntry;
    _saveCache();
  }

  console.log(`[PdfIntel] ✅ ${name}: ${pages}S, ${text.length}Z, ${chunks.length} Chunks, ${Date.now()-startTime}ms`);
  return result;
}

// ── Drive PDF laden + analysieren (über Drive API) ────────────────────────────
async function analyzeDrivePdf(accessToken, file) {
  const { id: fileId, name, modifiedTime } = file;

  // Cache prüfen
  const cache = _loadCache();
  const key   = _cacheKey(fileId, modifiedTime);
  if (cache[key]) {
    console.log(`[PdfIntel] Cache-Hit Drive: ${name}`);
    return { ...cache[key], fromCache: true };
  }

  // PDF-Binary von Drive herunterladen
  const buffer = await new Promise((resolve, reject) => {
    const rq = https.request({
      hostname: 'www.googleapis.com',
      path:     `/drive/v3/files/${fileId}?alt=media`,
      method:   'GET',
      headers:  { Authorization: 'Bearer ' + accessToken },
    }, (r) => {
      const chunks = []; r.on('data', c => chunks.push(c));
      r.on('end', () => resolve(Buffer.concat(chunks)));
    });
    rq.on('error', reject);
    rq.setTimeout(30000, () => { rq.destroy(); reject(new Error('Drive Download Timeout')); });
    rq.end();
  });

  return analyzeBuffer(buffer, { name, fileId, modifiedTime, withSummary: true, withFacts: true, withEmbeddings: true });
}

// ── Status ────────────────────────────────────────────────────────────────────
function cacheStatus() {
  const cache = _loadCache();
  const entries = Object.entries(cache);
  return {
    cachedPdfs: entries.length,
    totalChunks: entries.reduce((s, [, v]) => s + (v.chunks?.length || 0), 0),
    embedModel: EMBED_MODEL,
    ollamaModel: OLLAMA_MODEL,
    files: entries.slice(-10).map(([k, v]) => ({
      name: v.name, pages: v.pages, textLength: v.textLength, facts: v.facts,
    })),
  };
}

function clearCache() {
  _cache = {};
  try { fs.writeFileSync(CACHE_FILE, '{}', 'utf-8'); } catch(_) {}
  return { ok: true };
}

module.exports = {
  extractText,
  embed,
  embedAvailable: isEmbedModelAvailable,
  summarize,
  extractFacts,
  chunkText,
  analyzeBuffer,
  analyzeDrivePdf,
  cacheStatus,
  clearCache,
  EMBED_MODEL,
  OLLAMA_MODEL,
};
