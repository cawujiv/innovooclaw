// ─── innovooClaw · proxy.js v2.0 ─────────────────────────────────────────────
// Schlanker Orchestrations-Layer – keine OpenClaw-Abhängigkeit mehr.
// Start: node proxy.js
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

// ── Externe Secrets nachladen ─────────────────────────────────────────────────
{
  const _path = require('path');
  const _fs   = require('fs');
  // Secrets-Datei: aus SECRETS_FILE env var, sonst default-Pfad
  const _secretsFile = process.env.SECRETS_FILE
    || _path.join(__dirname, '..', 'secrets', 'secrets.env');
  if (_fs.existsSync(_secretsFile)) {
    try {
      // dotenv für die secrets.env verwenden (override: false = bestehende Vars nicht überschreiben)
      require('dotenv').config({ path: _secretsFile, override: false });
      console.log('\x1b[32m✅ Secrets\x1b[0m geladen:', _secretsFile);
    } catch(e) { console.warn('[secrets] dotenv fehlgeschlagen:', e.message); }
  } else {
    console.warn('\x1b[33m⚠️  Secrets\x1b[0m nicht gefunden:', _secretsFile);
  }
}

const http   = require('http');
const https  = require('https');
const fs     = require('fs');
const path   = require('path');

// ── Core-Module ───────────────────────────────────────────────────────────────
const { decideLLM, callLLM, streamToResponse } = require('./core/llm-router');
const unifiedMemory = require('./core/unified-memory');
const agentFactory  = require('./core/agent-factory');
const skillLoader   = require('./modules/skill-loader');
const { resolveAgent } = require('./data/routing-rules');

// ── Pfade ─────────────────────────────────────────────────────────────────────
const PUBLIC_DIR      = path.join(__dirname, 'public');
const GOOGLE_TOKEN_DIR = process.env.GOOGLE_TOKEN_DIR
  || path.join(__dirname, 'secrets', 'tokens');

// ── MIME ──────────────────────────────────────────────────────────────────────
const MIME = { '.html':'text/html; charset=utf-8', '.js':'application/javascript; charset=utf-8', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.ico':'image/x-icon', '.md':'text/plain; charset=utf-8' };
function getMime(fp) { return MIME[path.extname(fp).toLowerCase()] || 'text/plain'; }
function serveFile(res, fp) {
  if (!fs.existsSync(fp)) return false;
  res.writeHead(200, { 'Content-Type': getMime(fp), 'Cache-Control': 'no-cache' });
  fs.createReadStream(fp).pipe(res);
  return true;
}

// ── Google Token Helpers ──────────────────────────────────────────────────────
async function getGoogleToken(agentKey) {
  const file    = 'google_token.json'; // alle Agents nutzen denselben Token
  const tokPath = path.join(GOOGLE_TOKEN_DIR, file);
  if (!fs.existsSync(tokPath)) throw new Error('Google nicht verbunden – Token fehlt in ' + tokPath);
  let tok = JSON.parse(fs.readFileSync(tokPath, 'utf-8'));
  // Token auffrischen wenn abgelaufen
  if (Date.now() > tok.saved_at + (tok.expires_in * 1000) - 60000) {
    const cid = process.env.GOOGLE_CLIENT_ID || '';
    const sec = process.env.GOOGLE_CLIENT_SECRET || '';
    if (!tok.refresh_token || !cid || !sec) throw new Error('Token abgelaufen – bitte neu einloggen');
    const pd  = new URLSearchParams({ refresh_token: tok.refresh_token, client_id: cid, client_secret: sec, grant_type: 'refresh_token' }).toString();
    const ref = await new Promise((res, rej) => {
      const rq = https.request({ hostname:'oauth2.googleapis.com', path:'/token', method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'} }, r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>{ try{res(JSON.parse(d));}catch{rej(new Error('parse'));} }); });
      rq.on('error', rej); rq.write(pd); rq.end();
    });
    if (ref.error) throw new Error('Token-Refresh fehlgeschlagen');
    ref.saved_at = Date.now(); ref.refresh_token = ref.refresh_token || tok.refresh_token; ref.email = tok.email || '';
    fs.writeFileSync(tokPath, JSON.stringify(ref, null, 2));
    tok = ref;
  }
  return tok;
}

async function googleGet(token, apiPath) {
  return new Promise((res, rej) => {
    const rq = https.request({ hostname:'www.googleapis.com', path:apiPath, method:'GET', headers:{ Authorization: 'Bearer ' + token } }, r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => { try { res(JSON.parse(d)); } catch { rej(new Error('JSON parse')); } });
    });
    rq.on('error', rej); rq.end();
  });
}

function fetchExternal(url) {
  return new Promise((res, rej) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, { headers: { 'User-Agent': 'innovooClaw/2.0' } }, r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(d));
    }).on('error', rej);
  });
}

// ── Routing Overrides ─────────────────────────────────────────────────────────
let _routingOverrides = [];
function _loadRoutingOverrides() {
  try { const d = unifiedMemory.readLayer('routing-overrides'); _routingOverrides = Array.isArray(d.overrides) ? d.overrides : []; } catch(_) {}
}
_loadRoutingOverrides();
const _ovDir = process.env.MEMORY_DIR || '';
if (_ovDir && fs.existsSync(_ovDir)) {
  fs.watchFile(path.join(_ovDir, 'routing-overrides.json'), { interval: 2000 }, () => {
    unifiedMemory.invalidate('routing-overrides'); _loadRoutingOverrides();
    console.log('\x1b[33m⟳ routing-overrides neu geladen\x1b[0m');
  });
}
function _applyRoutingOverride(text) {
  if (!text || !_routingOverrides.length) return null;
  const lo = text.toLowerCase();
  const sorted = [..._routingOverrides].sort((a,b) => (a.priority||99)-(b.priority||99));
  for (const ov of sorted) {
    if (!ov.pattern || !ov.agent) continue;
    try { if (new RegExp(ov.pattern,'i').test(lo)) return { agent: ov.agent.toLowerCase(), reason: ov.reason }; } catch(_) {}
  }
  return null;
}

// ── TLS ───────────────────────────────────────────────────────────────────────
const PORT       = parseInt(process.env.PORT       || '3000');
const HTTPS_PORT = parseInt(process.env.HTTPS_PORT || '3443');
let tlsCreds = null;
try { const cp=path.join(__dirname,'cert.pem'), kp=path.join(__dirname,'key.pem'); if(fs.existsSync(cp)&&fs.existsSync(kp)) tlsCreds={cert:fs.readFileSync(cp),key:fs.readFileSync(kp)}; } catch(_) {}

const _sseClients = new Map();


// ── Slack Konversations-History ───────────────────────────────────────────────
const _slackHistory = {};
const SLACK_HISTORY_MAX = 10;
function _slackHistoryKey(channelId, agentKey) { return channelId + ':' + agentKey; }
function _slackHistoryGet(channelId, agentKey) { return _slackHistory[_slackHistoryKey(channelId, agentKey)] || []; }
function _slackHistoryPush(channelId, agentKey, userMsg, assistantReply) {
  const key = _slackHistoryKey(channelId, agentKey);
  if (!_slackHistory[key]) _slackHistory[key] = [];
  _slackHistory[key].push({ role: 'user',      content: userMsg.slice(0, 400) });
  _slackHistory[key].push({ role: 'assistant', content: assistantReply.slice(0, 800) });
  if (_slackHistory[key].length > SLACK_HISTORY_MAX * 2)
    _slackHistory[key] = _slackHistory[key].slice(-SLACK_HISTORY_MAX * 2);
}

// ── Telegram: Nachricht senden ────────────────────────────────────────────────
function _tgEscape(text) {
  // Telegram MarkdownV2 Sonderzeichen escapen
  return String(text).replace(/[_*[\]()~`>#+\-=|{}.!]/g, c => '\\' + c);
}

async function telegramSend(text, options = {}) {
  const token  = process.env.TELEGRAM_BOT_TOKEN || '';
  const chatId = options.chatId || process.env.TELEGRAM_CHAT_ID || '';
  if (!token || !chatId) return { ok: false, error: 'TELEGRAM_BOT_TOKEN oder TELEGRAM_CHAT_ID fehlt in .env' };
  return new Promise((resolve) => {
    // Kein parse_mode → plain text, keine Parsing-Fehler möglich
    const body = JSON.stringify({
      chat_id:              chatId,
      text:                 text.replace(/<b>/g,'').replace(/<\/b>/g,'').slice(0, 4096),
      disable_notification: options.silent || false,
    });
    const rq = https.request({
      hostname: 'api.telegram.org',
      path:     `/bot${token}/sendMessage`,
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (r) => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({ ok: false, error: 'parse' }); } });
    });
    rq.on('error', e => resolve({ ok: false, error: e.message }));
    rq.setTimeout(8000, () => { rq.destroy(); resolve({ ok: false, error: 'Timeout' }); });
    rq.write(body); rq.end();
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// REQUEST HANDLER
// ═════════════════════════════════════════════════════════════════════════════
async function requestHandler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, anthropic-version, anthropic-beta');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE, PUT');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const urlObj   = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = urlObj.pathname;

  function json(obj, status = 200) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(obj));
  }

  // ── API-Key-Schutz ────────────────────────────────────────────────────────
  const API_SECRET = process.env.API_SECRET || '';
  if (API_SECRET && (pathname.startsWith('/api/') || pathname === '/v1/messages')) {
    // Webhooks von externen Diensten ausnehmen
    const isWebhook = pathname === '/api/telegram/webhook' || pathname === '/api/slack';
    if (!isWebhook) {
      const provided = req.headers['x-api-key'] || urlObj.searchParams.get('key') || '';
      if (provided !== API_SECRET) {
        return json({ error: 'Unauthorized' }, 401);
      }
    }
  }

  // ── Root → innovooclaw.html ───────────────────────────────────────────────
  if (req.method === 'GET' && (pathname === '/' || pathname === '/innovooclaw.html' || pathname === '/innovooclaw-demo.html')) {
    if (serveFile(res, path.join(PUBLIC_DIR, 'innovooclaw.html'))) return;
    // Fallback auf alten Namen
    if (serveFile(res, path.join(PUBLIC_DIR, 'innovooclaw-demo.html'))) return;
  }

  // ── /data/* ───────────────────────────────────────────────────────────────
  if (req.method === 'GET' && pathname.startsWith('/data/')) {
    if (serveFile(res, path.join(__dirname, pathname.slice(1)))) return;
    res.writeHead(404); res.end('Not found: ' + pathname); return;
  }

  // ── /modules/* ────────────────────────────────────────────────────────────
  if (req.method === 'GET' && pathname.startsWith('/modules/')) {
    if (serveFile(res, path.join(__dirname, pathname.slice(1)))) return;
    res.writeHead(404); res.end('Not found: ' + pathname); return;
  }

  // ── /skills/* ─────────────────────────────────────────────────────────────
  if (req.method === 'GET' && pathname.startsWith('/skills/')) {
    if (serveFile(res, path.join(__dirname, pathname.slice(1)))) return;
  }

  // ── Sonstige statische Assets ─────────────────────────────────────────────
  if (req.method === 'GET' && !pathname.startsWith('/api/') && !pathname.startsWith('/auth/')) {
    const file = pathname.slice(1);
    if (file && !file.includes('..')) {
      if (serveFile(res, path.join(PUBLIC_DIR, file))) return;
      if (serveFile(res, path.join(__dirname,  file))) return;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // API ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════════════

  // ── /api/weather ──────────────────────────────────────────────────────────
  if (req.method === 'GET' && pathname.startsWith('/api/weather')) {
    const lat  = urlObj.searchParams.get('lat')  || '48.7758';
    const lon  = urlObj.searchParams.get('lon')  || '9.1829';
    const city = urlObj.searchParams.get('city') || 'Stuttgart';
    try {
      const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&timezone=Europe%2FBerlin&forecast_days=7`;
      const raw  = JSON.parse(await fetchExternal(apiUrl));
      const wmo  = c => c===0?'Sonnig':c<=3?'Teils bewölkt':c<=48?'Bewölkt':c<=67?'Regen':c<=77?'Schnee':c<=82?'Schauer':c<=99?'Gewitter':'Unbekannt';
      const cur  = raw.current; const daily = raw.daily;
      return json({
        city,
        aktuell: { temperatur: Math.round(cur.temperature_2m)+'°C', wetter: wmo(cur.weather_code), feuchtigkeit: cur.relative_humidity_2m+'%', wind: Math.round(cur.wind_speed_10m)+' km/h', niederschlag: cur.precipitation+' mm', code: cur.weather_code },
        woche: (daily.time || []).map((d,i) => ({ datum:d, max:Math.round(daily.temperature_2m_max[i])+'°C', min:Math.round(daily.temperature_2m_min[i])+'°C', wetter:wmo(daily.weather_code[i]), regen:daily.precipitation_sum[i]+' mm' }))
      });
    } catch(e) { return json({ error: e.message, city }, 500); }
  }

  // ── /api/calendar ─────────────────────────────────────────────────────────
  if (req.method === 'GET' && pathname.startsWith('/api/calendar')) {
    // Versuch 1: Google Calendar API
    try {
      const tok  = await getGoogleToken('otto');
      const now  = new Date().toISOString();
      const until = new Date(Date.now() + 30*24*60*60*1000).toISOString();
      const gcal = await googleGet(tok.access_token, `/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(now)}&timeMax=${encodeURIComponent(until)}&singleEvents=true&orderBy=startTime&maxResults=30`);
      if (gcal.error) throw new Error(gcal.error.message);
      const events = (gcal.items || []).map(ev => ({
        summary:     ev.summary || '(kein Titel)',
        start:       ev.start?.dateTime || ev.start?.date || '',
        end:         ev.end?.dateTime   || ev.end?.date   || '',
        location:    ev.location || '',
        description: (ev.description || '').slice(0, 100),
      }));
      return json({ count: events.length, events, quelle: 'Google Calendar API' });
    } catch(e) {
      // Versuch 2: ICS-Datei
      const icsPath = process.env.CALENDAR_ICS_PATH || '';
      if (icsPath && fs.existsSync(icsPath)) {
        try {
          const ics = fs.readFileSync(icsPath, 'utf-8');
          const events = [];
          const blocks = ics.split('BEGIN:VEVENT');
          for (let i = 1; i < blocks.length; i++) {
            const b   = blocks[i];
            const get = key => { const m = b.match(new RegExp(key+'[^:]*:([^\r\n]+)')); return m ? m[1].trim() : ''; };
            const pd  = d => { if(!d) return null; if(d.length===8) return d.slice(0,4)+'-'+d.slice(4,6)+'-'+d.slice(6,8); try{return new Date(d.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/,'$1-$2-$3T$4:$5:$6')).toISOString();}catch{return d;} };
            const summary = get('SUMMARY').replace(/\\n/g,' ');
            if (!summary) continue;
            events.push({ summary, start: pd(get('DTSTART')), end: pd(get('DTEND')), location: get('LOCATION'), description: '' });
          }
          const today = new Date().toISOString().slice(0,10);
          const filtered = events.filter(e => (e.start||'') >= today).sort((a,b)=>(a.start||'')>(b.start||'')?1:-1).slice(0,30);
          return json({ count: filtered.length, events: filtered, quelle: 'ICS-Datei' });
        } catch(e2) { return json({ error: e2.message, quelle: 'ICS-Fehler', connected: false }); }
      }
      return json({ error: e.message, connected: false, hint: 'CALENDAR_ICS_PATH in .env setzen oder Google Calendar verbinden' });
    }
  }

  // ── /api/drive/status ─────────────────────────────────────────────────────
  if (req.method === 'GET' && pathname === '/api/drive/status') {
    try {
      const tok = await getGoogleToken('otto');
      return json({ connected: true, expired: false, email: tok.email || '', user: tok.email || '' });
    } catch(e) {
      return json({ connected: false, expired: false, error: e.message });
    }
  }

  // ── /api/drive/token (intern für drive-indexer) ───────────────────────────
  if (req.method === 'GET' && pathname === '/api/drive/token') {
    const remoteIp = req.socket.remoteAddress;
    if (remoteIp !== '127.0.0.1' && remoteIp !== '::1') {
      return json({ error: 'Forbidden – nur lokal erreichbar' }, 403);
    }
    try { const tok = await getGoogleToken('otto'); return json({ access_token: tok.access_token }); }
    catch(e) { return json({ error: e.message }, 401); }
  }

  // ── /api/skills ───────────────────────────────────────────────────────────
  if (req.method === 'GET' && pathname === '/api/skills') {
    return json(skillLoader.loadAllSync() || {});
  }
  if (req.method === 'GET' && pathname.startsWith('/api/skills/')) {
    const agentKey = pathname.split('/')[3];
    const skills   = skillLoader.loadAllSync();
    return skills?.[agentKey] ? json(skills[agentKey]) : json({ error: 'Skill nicht gefunden' }, 404);
  }

  // ── /api/tool-overrides – GET: aktueller Status, PATCH: Toggle ────────────
  if (req.method === 'GET' && pathname === '/api/tool-overrides') {
    const { AGENTS } = require('./data/agent-registry');
    const overrides  = agentFactory.getToolOverrides();
    const result     = {};
    for (const [id, ag] of Object.entries(AGENTS)) {
      result[id] = {
        name:          ag.name,
        icon:          ag.icon,
        color:         ag.color,
        registryTools: ag.tools,
        effectiveTools: overrides[id] !== undefined ? overrides[id] : ag.tools,
        hasOverride:   overrides[id] !== undefined,
      };
    }
    return json(result);
  }

  if (req.method === 'PATCH' && pathname.match(/^\/api\/agents\/[a-z]+\/tools$/)) {
    const agentId = pathname.split('/')[3];
    const body    = await _readBody(req);
    try {
      const { tools } = JSON.parse(body);
      if (!Array.isArray(tools)) return json({ error: '"tools" muss ein Array sein' }, 400);
      const { TOOL_DEFINITIONS } = require('./modules/tool-definitions');
      const unknown = tools.filter(t => !TOOL_DEFINITIONS[t]);
      if (unknown.length) return json({ error: `Unbekannte Tools: ${unknown.join(', ')}` }, 400);
      agentFactory.setToolOverride(agentId, tools);
      console.log(`\x1b[33m⟳ Tool-Override\x1b[0m  ${agentId.toUpperCase()} → [${tools.join(', ')}] gesetzt via API`);
      return json({ ok: true, agent: agentId, tools, savedAt: new Date().toISOString() });
    } catch(e) { return json({ error: e.message }, 400); }
  }

  if (req.method === 'DELETE' && pathname.match(/^\/api\/agents\/[a-z]+\/tools$/)) {
    const agentId = pathname.split('/')[3];
    const overrides = agentFactory.getToolOverrides();
    delete overrides[agentId];
    // direkt speichern über setToolOverride-Logik
    const { AGENTS } = require('./data/agent-registry');
    const registryTools = AGENTS[agentId]?.tools || [];
    agentFactory.setToolOverride(agentId, registryTools);
    // … dann Override wieder löschen (Reset auf Registry)
    const ov2 = agentFactory.getToolOverrides();
    delete ov2[agentId];
    agentFactory.reload(agentId);
    return json({ ok: true, agent: agentId, reset: true });
  }

  // ── /api/config ───────────────────────────────────────────────────────────
  if (req.method === 'GET' && pathname === '/api/config') {
    return json({ vvs_stammhaltestelle: process.env.VVS_STAMMHALTESTELLE || 'Stuttgart, Libanonstraße' });
  }

  // ── /api/memory/vector-status ─────────────────────────────────────────────
  // WICHTIG: Muss VOR dem allgemeinen /api/memory/* Handler stehen!
  if (req.method === 'GET' && pathname === '/api/memory/vector-status') {
    try { return json(require('./modules/memory-vector').status()); }
    catch(e) { return json({ ready: false, error: e.message }); }
  }
  if (req.method === 'GET' && pathname === '/api/memory/status') {
    try { return json(require('./modules/memory-vector').status()); }
    catch(e) { return json({ ready: false, error: e.message }); }
  }

  // ── /api/memory/init ─────────────────────────────────────────────────────
  if (req.method === 'GET' && pathname === '/api/memory/init') {
    const layers = ['semantic','episodic','procedural','working','dialog-history'];
    const files  = layers.map(l => ({ layer: l, exists: fs.existsSync(path.join(process.env.MEMORY_DIR||'', `${l}.json`)) }));
    return json({ ok: true, files });
  }

  // ── /api/memory/latest-facts ─────────────────────────────────────────────
  if (req.method === 'GET' && pathname === '/api/memory/latest-facts') {
    const n = parseInt(urlObj.searchParams.get('n') || '5');
    try {
      const mv = require('./modules/memory-vector');
      if (mv.status().ready) {
        const facts = await mv.getLatestFacts(n);
        return json({ facts, mode: 'vector' });
      }
    } catch(_) {}
    try {
      const sem   = unifiedMemory.readLayer('semantic');
      const facts = [];
      for (const [cat, vals] of Object.entries(sem)) {
        if (typeof vals === 'object' && !Array.isArray(vals)) {
          for (const [key, val] of Object.entries(vals)) {
            if (key.startsWith('_')) continue;
            facts.push({ text: `${cat}.${key}: ${val}`, category: cat, layer: 'semantic', timestamp: vals._geaendert || null });
          }
        }
      }
      return json({ facts: facts.slice(-n), mode: 'json' });
    } catch(e) { return json({ facts: [], mode: 'error', error: e.message }); }
  }

  // ── /api/memory/* und /api/dialog/* ───────────────────────────────────────
  if (pathname.startsWith('/api/memory/') || pathname.startsWith('/api/dialog/')) {
    return unifiedMemory.handleApi(req, res, pathname, urlObj);
  }

  // ── /auth/google – OAuth2 für Google Drive/Calendar/Gmail ──────────────────
  if (req.method === 'GET' && pathname === '/auth/google') {
    const clientId   = process.env.GOOGLE_CLIENT_ID || '';
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `http://localhost:${PORT}/auth/google/callback`;
    if (!clientId) { res.writeHead(400); res.end('GOOGLE_CLIENT_ID fehlt in secrets.env'); return; }
    const scopes = [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' ');
    const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' +
      new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri,
        response_type: 'code', scope: scopes, access_type: 'offline', prompt: 'consent' }).toString();
    res.writeHead(302, { Location: authUrl }); res.end();
    console.log('\x1b[36m→ Google Auth\x1b[0m Redirect...');
    return;
  }

  if (req.method === 'GET' && pathname === '/auth/google/callback') {
    const code        = urlObj.searchParams.get('code') || '';
    const clientId    = process.env.GOOGLE_CLIENT_ID || '';
    const clientSecret= process.env.GOOGLE_CLIENT_SECRET || '';
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `http://localhost:${PORT}/auth/google/callback`;
    if (!code) { res.writeHead(400); res.end('Kein Auth-Code'); return; }
    try {
      const pd = new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret,
        redirect_uri: redirectUri, grant_type: 'authorization_code' }).toString();
      const tok = await new Promise((resolve, reject) => {
        const rq = https.request({ hostname:'oauth2.googleapis.com', path:'/token', method:'POST',
          headers:{'Content-Type':'application/x-www-form-urlencoded','Content-Length':Buffer.byteLength(pd)} },
          r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>{try{resolve(JSON.parse(d));}catch{reject(new Error('parse'));}}); });
        rq.on('error',reject); rq.write(pd); rq.end();
      });
      if (tok.error) throw new Error(tok.error_description || tok.error);
      // E-Mail ermitteln
      let email = '';
      try {
        const u = await new Promise((resolve,reject) => {
          const rq = https.request({hostname:'www.googleapis.com',path:'/oauth2/v2/userinfo',method:'GET',
            headers:{Authorization:'Bearer '+tok.access_token}}, r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>{try{resolve(JSON.parse(d));}catch{reject(new Error('parse'));}}); });
          rq.on('error',reject); rq.end();
        });
        email = u.email || '';
      } catch(_) {}
      tok.saved_at = Date.now(); tok.email = email;
      // In innovooClaw/secrets/tokens/ speichern
      const tokenDir  = GOOGLE_TOKEN_DIR;
      if (!require('fs').existsSync(tokenDir)) require('fs').mkdirSync(tokenDir, { recursive: true });
      const tokenPath = path.join(tokenDir, 'google_token.json');
      require('fs').writeFileSync(tokenPath, JSON.stringify(tok, null, 2));
      console.log('\x1b[32m✅ Google Token gespeichert\x1b[0m für', email, '→', tokenPath);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!DOCTYPE html><html><head><meta charset="utf-8">
<style>body{font-family:sans-serif;background:#0d0d1a;color:#e0e0ff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
.box{text-align:center;background:#1a1a2e;border:1px solid #6ee7b7;border-radius:16px;padding:40px}
h2{color:#6ee7b7}.sub{color:#888;font-size:.85rem;margin-top:8px}
.btn{display:inline-block;margin-top:24px;padding:12px 28px;background:#6ee7b7;color:#0d0d1a;border-radius:8px;text-decoration:none;font-weight:bold}</style></head>
<body><div class="box"><h2>✅ Google verbunden!</h2>
<p class="sub">${email}</p>
<p class="sub">Drive · Gmail · Calendar</p>
<a class="btn" href="/">← Zurück zu innovooClaw</a></div></body></html>`);
    } catch(e) {
      res.writeHead(500, {'Content-Type':'text/html'});
      res.end(`<h2 style="font-family:sans-serif;padding:30px;color:#f55">❌ ${e.message}</h2><a href="/auth/google">Nochmal versuchen</a>`);
    }
    return;
  }

  if (req.method === 'GET' && pathname === '/auth/google/status') {
    const tokenPath = path.join(GOOGLE_TOKEN_DIR, 'google_token.json');
    if (!fs.existsSync(tokenPath)) { return json({ connected: false }); }
    try {
      const tok = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
      const expired = Date.now() > tok.saved_at + (tok.expires_in * 1000);
      return json({ connected: true, email: tok.email || '', expired, has_refresh: !!tok.refresh_token });
    } catch(e) { return json({ connected: false, error: e.message }); }
  }

  // ── /v1/messages – Anthropic-Proxy ────────────────────────────────────────
  if (req.method === 'POST' && pathname === '/v1/messages') {
    const body = await _readBody(req);
    let payload;
    try { payload = JSON.parse(body); } catch { return json({ error: 'Invalid JSON' }, 400); }
    const model = payload.model || 'claude-haiku-4-5-20251001';
    const opts  = { maxTokens: payload.max_tokens || 1000, tools: payload.tools };
    if (payload.stream) return streamToResponse(model, payload.system||'', payload.messages||[], opts, res);
    try {
      const result = await callLLM('anthropic', model, payload.system||'', payload.messages||[], opts);
      return json(result.raw || { content: [{ type:'text', text: result.content }] });
    } catch(e) { return json({ error: { message: e.message } }, 500); }
  }

  // ── /api/agent/:agentId ───────────────────────────────────────────────────
  if (req.method === 'POST' && pathname.match(/^\/api\/agent\/[a-z]+$/)) {
    const agentKey = pathname.split('/')[3];
    const body     = await _readBody(req);
    let payload;
    try { payload = JSON.parse(body); } catch { return json({ error: 'Invalid JSON' }, 400); }
    const userMessage = payload.message || '';
    if (!userMessage) return json({ error: 'message fehlt' }, 400);

    const override    = _applyRoutingOverride(userMessage);
    const resolvedKey = override?.agent || agentKey;
    const agent       = agentFactory.get(resolvedKey);
    if (!agent) return json({ error: `Agent '${resolvedKey}' nicht gefunden` }, 404);

    const llmDecision = decideLLM(userMessage, { agent: resolvedKey, toolsAvailable: agent.tools.length, forceCloud: payload.forceCloud });
    try {
      const result = await agent.handle(userMessage, {
        llm: llmDecision, history: payload.history || [], maxTokens: payload.maxTokens || 1200,
        callLLM: (sys, msgs, opts) => callLLM(llmDecision.provider, llmDecision.model, sys, msgs, { maxTokens:1200, ...opts }),
        memory: {
          recall:   (q, o)     => unifiedMemory.recall(q, o),
          store:    (t, m)     => unifiedMemory.store(t, m),
          saveFact: (cat,k,v)  => unifiedMemory.saveFact(cat, k, v),
        },
      });
      setImmediate(() => {
        try { unifiedMemory.saveDialogEntry(resolvedKey, userMessage, result.reply); } catch(_) {}
        try { unifiedMemory.saveEpisode(resolvedKey, userMessage.slice(0,80), 'user-msg'); } catch(_) {}
      });
      return json({ ok: true, reply: result.reply, agent: resolvedKey, llm: llmDecision.reason });
    } catch(e) {
      console.error(`[Agent ${resolvedKey}] Fehler:`, e.message);
      return json({ ok: false, error: e.message }, 500);
    }
  }

  // ── /api/agent/resolve ────────────────────────────────────────────────────
  if (req.method === 'POST' && pathname === '/api/agent/resolve') {
    const body = await _readBody(req);
    try {
      const { text, currentAgent } = JSON.parse(body);
      const ov = _applyRoutingOverride(text);
      if (ov) return json({ ...ov, method: 'override' });
      return json(resolveAgent(text, currentAgent));
    } catch(e) { return json({ error: e.message }, 400); }
  }

  // ── /api/kb/search ────────────────────────────────────────────────────────
  if (req.method === 'GET' && pathname === '/api/kb/search') {
    const q     = urlObj.searchParams.get('q') || '';
    const limit = parseInt(urlObj.searchParams.get('limit') || '6');
    try {
      const mv = require('./modules/memory-vector');
      if (!mv.status().ready) await mv.init();
      return json({ results: await mv.kbSearch(q, limit) });
    } catch(e) { return json({ error: e.message }, 500); }
  }

  // ── /api/drive/pdf-analyze ───────────────────────────────────────────────────
  // GET  ?fileId=...            → einzelne Drive-PDF analysieren
  // POST body: { fileId, name } → Drive-PDF via ID analysieren
  // GET  ?status=1              → Cache-Status anzeigen
  // DELETE ?clear=1             → Cache leeren
  if ((req.method === 'GET' || req.method === 'POST' || req.method === 'DELETE') && pathname === '/api/drive/pdf-analyze') {
    const pdfIntel = require('./modules/pdf-intelligence');

    // Status
    if (urlObj.searchParams.get('status') === '1') {
      return json(pdfIntel.cacheStatus());
    }
    // Cache löschen
    if (req.method === 'DELETE' || urlObj.searchParams.get('clear') === '1') {
      return json(pdfIntel.clearCache());
    }

    // Datei-ID aus Query oder Body
    let fileId = urlObj.searchParams.get('fileId') || '';
    let fileName = urlObj.searchParams.get('name')  || 'Dokument.pdf';
    if (req.method === 'POST') {
      const body = await _readBody(req);
      try { const p = JSON.parse(body); fileId = p.fileId || fileId; fileName = p.name || fileName; } catch(_) {}
    }
    if (!fileId) return json({ error: 'fileId fehlt' }, 400);

    try {
      const tok  = await getGoogleToken('otto');

      // Drive-Metadaten abrufen
      const meta = await new Promise((resolve, reject) => {
        const rq = require('https').request({
          hostname: 'www.googleapis.com',
          path:     `/drive/v3/files/${fileId}?fields=id,name,mimeType,modifiedTime,size`,
          method:   'GET',
          headers:  { Authorization: 'Bearer ' + tok.access_token },
        }, r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>{ try{resolve(JSON.parse(d));}catch{reject(new Error('parse'));} }); });
        rq.on('error', reject); rq.end();
      });

      if (meta.error) return json({ error: meta.error.message || JSON.stringify(meta.error) }, 500);
      if (!meta.mimeType?.includes('pdf')) return json({ error: `Datei ist kein PDF: ${meta.mimeType}` }, 400);

      const result = await pdfIntel.analyzeDrivePdf(tok.access_token, {
        id:           meta.id,
        name:         meta.name || fileName,
        modifiedTime: meta.modifiedTime || '',
      });

      return json(result);
    } catch(e) { return json({ error: e.message }, 500); }
  }

  // ── /api/pdf/status ───────────────────────────────────────────────────────
  if (req.method === 'GET' && pathname === '/api/pdf/status') {
    try {
      const pdfIntel = require('./modules/pdf-intelligence');
      const [cacheInfo, embedStatus] = await Promise.all([
        pdfIntel.cacheStatus(),
        pdfIntel.embedAvailable(),
      ]);
      return json({ ok: true, ...cacheInfo, embedAvailable: embedStatus });
    } catch(e) { return json({ error: e.message }, 500); }
  }

  // ── /api/drive/index ──────────────────────────────────────────────────────
  if (req.method === 'POST' && pathname === '/api/drive/index') {
    const body  = await _readBody(req);
    const delta = JSON.parse(body||'{}').delta === true;
    const di    = require('./modules/drive-indexer');
    json({ ok: true, message: 'Indexierung gestartet' });
    (delta ? di.runDelta() : di.run()).catch(e => console.error('[DriveIndex]', e.message));
    return;
  }
  if (req.method === 'GET' && pathname === '/api/drive/index/status') {
    return json(require('./modules/drive-indexer').status());
  }

  // ── /api/ollama/* ─────────────────────────────────────────────────────────
  if (req.method === 'GET' && pathname === '/api/ollama/stats') {
    return json(require('./modules/ollama-preprocess').getStats());
  }
  if (req.method === 'POST' && pathname === '/api/ollama/mode') {
    const body = await _readBody(req);
    try {
      const { mode } = JSON.parse(body);
      if (['hybrid','off','only'].includes(mode)) { process.env.OLLAMA_MODE = mode; return json({ ok:true, mode }); }
      return json({ error: 'Ungültiger Modus' }, 400);
    } catch(e) { return json({ error: e.message }, 400); }
  }
  if (req.method === 'POST' && pathname === '/api/ollama/process') {
    const body = await _readBody(req);
    try {
      const { toolName, content } = JSON.parse(body);
      return json({ result: await require('./modules/ollama-preprocess').ollamaPreprocess(toolName, content) });
    } catch(e) { return json({ error: e.message }, 500); }
  }

  // ── /api/vvs/* ────────────────────────────────────────────────────────────
  function vvsGet(apiPath) {
    return new Promise((resolve, reject) => {
      const opts = { hostname:'efastatic.vvs.de', path:'/OpenVVSDay/'+apiPath, method:'GET', headers:{'User-Agent':'innovooClaw/2.0','Accept':'application/json'} };
      const rq = http.request(opts, r => {
        let d = ''; r.on('data', c => d+=c);
        r.on('end', () => {
          if (d.trim().startsWith('<')) { reject(new Error('VVS antwortet mit HTML')); return; }
          if (!d.trim()) { reject(new Error('VVS leere Antwort')); return; }
          try { resolve(JSON.parse(d)); } catch(e) { reject(new Error('VVS parse: '+d.slice(0,80))); }
        });
      });
      rq.setTimeout(10000, () => { rq.destroy(); reject(new Error('VVS Timeout')); });
      rq.on('error', reject); rq.end();
    });
  }

  if (req.method === 'GET' && pathname.startsWith('/api/vvs/abfahrten')) {
    try {
      const stop        = urlObj.searchParams.get('stop') || 'Hauptbahnhof, Stuttgart';
      const limit       = Math.min(parseInt(urlObj.searchParams.get('limit') || '8'), 20);
      const stopIdParam = urlObj.searchParams.get('id') || '';
      let stopId, stopName;
      if (stopIdParam && /^\d+$/.test(stopIdParam)) {
        stopId = stopIdParam; stopName = stop;
      } else {
        const finder = await vvsGet(`XML_STOPFINDER_REQUEST?outputFormat=JSON&type_sf=any&name_sf=${encodeURIComponent(stop)}&coordOutputFormat=WGS84[dd.ddddd]&doNotSearchForStops_sf=0&anyObjFilter_sf=2`);
        const punkte  = finder?.stopFinder?.points;
        const stopObj = Array.isArray(punkte) ? punkte[0] : (punkte?.point ? punkte.point : punkte);
        if (!stopObj) return json({ error: `Haltestelle nicht gefunden: "${stop}"` }, 404);
        stopId   = stopObj.ref?.id || stopObj.id || '';
        stopName = stopObj.name || stop;
      }
      const now  = new Date();
      const date = now.getFullYear().toString() + String(now.getMonth()+1).padStart(2,'0') + String(now.getDate()).padStart(2,'0');
      const time = now.getHours().toString().padStart(2,'0') + now.getMinutes().toString().padStart(2,'0');
      const dm   = await vvsGet(`XML_DM_REQUEST?outputFormat=JSON&type_dm=stop&name_dm=${encodeURIComponent(stopId)}&itdDate=${date}&itdTime=${time}&departureMonitorMacro=true&limit=${limit}&mode=direct`);
      const abfahrten = (dm?.departureList || []).slice(0, limit).map(d => ({
        linie:    d.servingLine?.symbol || d.servingLine?.number || '?',
        richtung: d.servingLine?.direction || '?',
        zeit:     d.dateTime ? `${String(d.dateTime.hour).padStart(2,'0')}:${String(d.dateTime.minute).padStart(2,'0')}` : '?',
        steig:    d.platform || null,
      }));
      return json({ haltestelle: stopName, stop_id: stopId, abfahrten, anzahl: abfahrten.length, zeitpunkt: new Date().toISOString() });
    } catch(e) { return json({ error: e.message }, 500); }
  }

  if (req.method === 'GET' && pathname.startsWith('/api/vvs/verbindung')) {
    try {
      const von  = urlObj.searchParams.get('von')  || '';
      const nach = urlObj.searchParams.get('nach') || '';
      if (!von || !nach) return json({ error: 'Parameter von und nach erforderlich' }, 400);
      const wann = urlObj.searchParams.get('wann') || 'jetzt';
      const now  = wann === 'jetzt' ? new Date() : new Date(wann);
      const date = now.getFullYear().toString() + String(now.getMonth()+1).padStart(2,'0') + String(now.getDate()).padStart(2,'0');
      const time = now.getHours().toString().padStart(2,'0') + now.getMinutes().toString().padStart(2,'0');
      const trip = await vvsGet(`XML_TRIP_REQUEST2?outputFormat=JSON&language=de&type_origin=any&name_origin=${encodeURIComponent(von)}&type_destination=any&name_destination=${encodeURIComponent(nach)}&itdDate=${date}&itdTime=${time}&itdTripDateTimeDepArrMacro=dep&calcNumberOfTrips=3`);
      const routen   = trip?.trips?.trip || [];
      const routeArr = Array.isArray(routen) ? routen : (routen ? [routen] : []);
      const verbindungen = routeArr.slice(0,3).map(route => {
        const legArr = Array.isArray(route?.legs) ? route.legs : (route?.legs ? [route.legs] : []);
        const fp = legArr[0]?.points || []; const lp = legArr[legArr.length-1]?.points || [];
        const fpA = Array.isArray(fp) ? fp : [fp]; const lpA = Array.isArray(lp) ? lp : [lp];
        const fahrtLegs = legArr.filter(l => l?.mode && l.mode.type !== '100' && l.mode.type !== 100);
        return { abfahrt: fpA[0]?.dateTime?.time||'?', ankunft: lpA[lpA.length-1]?.dateTime?.time||'?', umstiege: Math.max(0,fahrtLegs.length-1), linien: fahrtLegs.map(l=>`${l.mode?.symbol||''}${l.mode?.destination?' \u2192 '+l.mode.destination:''}`).filter(Boolean) };
      }).filter(v => v.abfahrt !== '?');
      return json({ von, nach, verbindungen, anzahl: verbindungen.length });
    } catch(e) { return json({ error: e.message }, 500); }
  }

  if (req.method === 'GET' && pathname.startsWith('/api/vvs/haltestellen')) {
    try {
      const q = urlObj.searchParams.get('q') || '';
      if (!q) return json({ error: 'Parameter q erforderlich' }, 400);
      const finder = await vvsGet(`XML_STOPFINDER_REQUEST?outputFormat=JSON&type_sf=any&name_sf=${encodeURIComponent(q)}&coordOutputFormat=WGS84[dd.ddddd]&doNotSearchForStops_sf=0&anyObjFilter_sf=2`);
      const punkte = finder?.stopFinder?.points;
      const arr    = Array.isArray(punkte) ? punkte : (punkte?.point ? [punkte.point] : []);
      return json({ suchanfrage: q, haltestellen: arr.slice(0,10).map(p=>({name:p.name||'?',id:p.ref?.id||p.id||'',ort:p.ref?.place||''})), anzahl: Math.min(arr.length,10) });
    } catch(e) { return json({ error: e.message }, 500); }
  }

  // ── /api/shelly/* ─────────────────────────────────────────────────────────
  if (req.method === 'GET' && pathname.startsWith('/api/shelly')) {
    const shellyIp = process.env.SHELLY_IP || '';
    if (!shellyIp) return json({ error: 'SHELLY_IP nicht konfiguriert', configured: false });
    const subpath = pathname.replace('/api/shelly','').split('?')[0] || '/power';
    const rpcMap  = { '/power':'/rpc/EM.GetStatus?id=0', '/status':'/rpc/Shelly.GetStatus', '/data':'/rpc/EMData.GetStatus?id=0', '/history':'/rpc/EMData.GetStatus?id=0' };
    const rpcPath = rpcMap[subpath] || rpcMap['/power'];
    try {
      const shellyData = await new Promise((resolve, reject) => {
        const auth = process.env.SHELLY_AUTH || '';
        const headers = { 'Accept':'application/json' };
        if (auth) headers['Authorization'] = 'Basic ' + Buffer.from(auth).toString('base64');
        const rq = http.request({ hostname:shellyIp, port:80, path:rpcPath, method:'GET', headers, timeout:5000 }, r => {
          const chunks = []; r.on('data',c=>chunks.push(c)); r.on('end',()=>resolve({status:r.statusCode,body:Buffer.concat(chunks).toString()}));
        });
        rq.setTimeout(5000,()=>{rq.destroy();reject(new Error('Shelly Timeout'));}); rq.on('error',reject); rq.end();
      });
      if (shellyData.status !== 200) return json({ error:`Shelly HTTP ${shellyData.status}`, ip:shellyIp });
      const raw = JSON.parse(shellyData.body);
      if (subpath === '/power') {
        const pa=Math.round((raw.a_act_power||0)*10)/10, pb=Math.round((raw.b_act_power||0)*10)/10, pc=Math.round((raw.c_act_power||0)*10)/10, total=Math.round((raw.total_act_power||0)*10)/10;
        return json({ zeitstempel:new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}), ip:shellyIp, gesamt_w:total, total_w:total, einspeisung:total<0, phase_a_w:pa, phase_b_w:pb, phase_c_w:pc, phasen:[{phase:'A',w:pa},{phase:'B',w:pb},{phase:'C',w:pc}], raw });
      } else if (subpath === '/status') {
        const sys=raw.sys||{}, wifi=raw.wifi||{};
        return json({ zeitstempel:new Date().toISOString(), ip:shellyIp, online:true, name:sys.device?.name||'Shelly Pro 3EM', wifi_ssid:wifi.ssid||'?', wifi_rssi:wifi.rssi||null, firmware:sys.fw_id||'?', uptime_h:sys.uptime!=null?Math.round(sys.uptime/3600*10)/10:null, raw });
      } else { return json({ zeitstempel:new Date().toISOString(), ip:shellyIp, raw }); }
    } catch(e) { return json({ error:e.message, ip:shellyIp, configured:true }); }
  }

  // ── /api/search ───────────────────────────────────────────────────────────
  if (req.method === 'GET' && pathname.startsWith('/api/search')) {
    const q     = urlObj.searchParams.get('q') || '';
    const count = Math.min(parseInt(urlObj.searchParams.get('count') || '5'), 10);
    if (!q) return json({ error: 'Parameter q fehlt' }, 400);
    const httpsReqFn = (opts, body) => new Promise((resolve, reject) => {
      const rq = https.request(opts, r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>{try{resolve({status:r.statusCode,data:JSON.parse(d)});}catch{reject(new Error('parse'));}}); });
      rq.on('error',reject); rq.setTimeout(10000,()=>{rq.destroy();reject(new Error('Timeout'));}); if(body) rq.write(body); rq.end();
    });
    const braveKey = process.env.BRAVE_API_KEY || '';
    if (braveKey) {
      try {
        const { data } = await httpsReqFn({ hostname:'api.search.brave.com', path:`/res/v1/web/search?q=${encodeURIComponent(q)}&count=${count}`, method:'GET', headers:{'Accept':'application/json','X-Subscription-Token':braveKey} });
        return json({ ok:true, source:'brave', q, count:(data.web?.results||[]).length, results:(data.web?.results||[]).slice(0,count).map(r=>({title:r.title||'',url:r.url||'',description:r.description||'',age:r.age||''})) });
      } catch(e) { console.warn('[Search] Brave fehlgeschlagen:', e.message); }
    }
    try {
      const { data: ddg } = await httpsReqFn({ hostname:'api.duckduckgo.com', path:`/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`, method:'GET', headers:{'User-Agent':'innovooClaw/2.0'} });
      const results = [];
      if (ddg.AbstractText) results.push({ title:ddg.Heading||q, url:ddg.AbstractURL||'', description:ddg.AbstractText.slice(0,300), age:'' });
      for (const t of (ddg.RelatedTopics||[])) { if(results.length>=count) break; if(t.Text&&t.FirstURL) results.push({title:t.Text.split(' - ')[0]?.slice(0,80)||t.FirstURL,url:t.FirstURL,description:t.Text.slice(0,200),age:''}); }
      return json({ ok:true, source:'duckduckgo', q, count:results.length, results });
    } catch(e) { return json({ error:e.message }, 500); }
  }

  // ── /api/fetch ────────────────────────────────────────────────────────────
  if (req.method === 'GET' && pathname.startsWith('/api/fetch')) {
    const target = urlObj.searchParams.get('url') || '';
    const maxLen = Math.min(parseInt(urlObj.searchParams.get('maxlen') || '8000'), 20000);
    if (!target || !target.startsWith('http')) return json({ error: 'Parameter url fehlt oder ungueltig' }, 400);
    try {
      const targetUrl = new URL(target);
      const lib = targetUrl.protocol === 'https:' ? https : http;
      const html = await new Promise((resolve, reject) => {
        const opts = { hostname:targetUrl.hostname, path:targetUrl.pathname+(targetUrl.search||''), method:'GET', headers:{'User-Agent':'Mozilla/5.0','Accept':'text/html,*/*;q=0.8','Accept-Language':'de-DE,de;q=0.9'} };
        const rq = lib.request(opts, r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>{if(r.statusCode===403||r.statusCode===401){reject(new Error('HTTP '+r.statusCode+' - Bot-Schutz'));}else resolve(d);}); });
        rq.setTimeout(10000,()=>{rq.destroy();reject(new Error('Timeout'));}); rq.on('error',reject); rq.end();
      });
      const text = html.replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<style[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g,' ').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim().slice(0,maxLen);
      return json({ url:target, domain:targetUrl.hostname, zeichen:text.length, text });
    } catch(e) { return json({ error:e.message, url:target }, 500); }
  }

  // ── /api/exchange ─────────────────────────────────────────────────────────
  if (req.method === 'GET' && pathname.startsWith('/api/exchange')) {
    const symbols = (urlObj.searchParams.get('symbols') || 'USD,CHF,GBP').split(',');
    try {
      const data = JSON.parse(await fetchExternal('https://data-api.ecb.europa.eu/service/data/EXR/D.'+symbols.join('.')+'.EUR.SP00.A?format=jsondata&lastNObservations=1'));
      const series=data.dataSets?.[0]?.series||{}, dims=data.structure?.dimensions?.series||[];
      const currIdx=dims.findIndex(d=>d.id==='CURRENCY'), result={};
      for (const [key,val] of Object.entries(series)) {
        const parts=key.split(':'), currency=dims[currIdx]?.values?.[parseInt(parts[currIdx])]?.id, obs=Object.values(val.observations||{})[0];
        if(currency&&obs) result[currency]=Math.round(obs[0]*10000)/10000;
      }
      return json({ base:'EUR', kurse:result, datum:new Date().toISOString().slice(0,10) });
    } catch(e) { return json({ error:e.message }, 500); }
  }

  // ── /api/drive/* (List, Search, Read, Upload) ─────────────────────────────
  if (req.method === 'GET' && pathname.startsWith('/api/drive/list')) {
    try {
      const tok      = await getGoogleToken(urlObj.searchParams.get('agent') || 'otto');
      const folderQ  = urlObj.searchParams.get('folder') || null;
      const folderId = urlObj.searchParams.get('folderId') || null;
      const limit    = Math.min(parseInt(urlObj.searchParams.get('limit') || '50'), 200);
      let parentId = 'root';
      if (folderId) { parentId = folderId; }
      else if (folderQ) {
        const found = await googleGet(tok.access_token, `/drive/v3/files?q=${encodeURIComponent("name='" + folderQ + "' and mimeType='application/vnd.google-apps.folder' and trashed=false")}&fields=files(id,name)&pageSize=5`);
        if (found.files?.[0]) parentId = found.files[0].id;
      }
      const data = await googleGet(tok.access_token, `/drive/v3/files?q=${encodeURIComponent("'" + parentId + "' in parents and trashed=false")}&fields=files(id,name,mimeType,size,modifiedTime)&pageSize=${limit}&orderBy=folder,name`);
      const dateien = (data.files||[]).map(f=>({id:f.id,name:f.name,typ:f.mimeType==='application/vnd.google-apps.folder'?'Ordner':'Datei',mime:f.mimeType,groesse:f.size?Math.round(f.size/1024)+'KB':'',geaendert:(f.modifiedTime||'').slice(0,10)}));
      return json({ ordner:folderQ||folderId||'My Drive', parentId, anzahl:dateien.length, dateien });
    } catch(e) { return json({ error:e.message }, 500); }
  }

  if (req.method === 'GET' && pathname.startsWith('/api/drive/search')) {
    try {
      const tok   = await getGoogleToken(urlObj.searchParams.get('agent') || 'otto');
      const q     = urlObj.searchParams.get('q') || '';
      const limit = Math.min(parseInt(urlObj.searchParams.get('limit') || '10'), 50);
      if (!q) return json({ error: 'Parameter q fehlt' }, 400);
      const data = await googleGet(tok.access_token, `/drive/v3/files?q=${encodeURIComponent("name contains '" + q + "' and trashed=false")}&fields=${encodeURIComponent('files(id,name,mimeType,modifiedTime,size)')}&pageSize=${limit}&orderBy=modifiedTime+desc`);
      return json({ suchanfrage:q, treffer:(data.files||[]).length, dateien:(data.files||[]).map(f=>({id:f.id,name:f.name,typ:f.mimeType.includes('folder')?'ordner':'datei',geaendert:(f.modifiedTime||'').slice(0,10)})) });
    } catch(e) { return json({ error:e.message }, 500); }
  }

  if (req.method === 'GET' && pathname.startsWith('/api/drive/read')) {
    try {
      const tok    = await getGoogleToken(urlObj.searchParams.get('agent') || 'otto');
      const fileId = urlObj.searchParams.get('fileId') || '';
      if (!fileId) return json({ error: 'Parameter fileId fehlt' }, 400);
      const meta = await googleGet(tok.access_token, `/drive/v3/files/${fileId}?fields=id,name,mimeType,size,modifiedTime`);
      if (meta.error) throw new Error(meta.error.message || JSON.stringify(meta.error));
      const mime = meta.mimeType || '';
      const dlGet = p => new Promise((res, rej) => {
        const rq = https.request({ hostname:'www.googleapis.com', path:p, method:'GET', headers:{Authorization:'Bearer '+tok.access_token} }, r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>res(d)); });
        rq.on('error',rej); rq.end();
      });
      let text = '';
      if      (mime.includes('google-apps.document'))    text = await dlGet(`/drive/v3/files/${fileId}/export?mimeType=text%2Fplain`);
      else if (mime.includes('google-apps.spreadsheet')) text = await dlGet(`/drive/v3/files/${fileId}/export?mimeType=text%2Fcsv`);
      else if (!mime.includes('google-apps'))            text = await dlGet(`/drive/v3/files/${fileId}?alt=media`);
      else text = '(Dateityp kann nicht exportiert werden)';
      return json({ id:fileId, name:meta.name, mime, zeichen:text.length, text:text.slice(0,8000) });
    } catch(e) { return json({ error:e.message }, 500); }
  }

  // ── /api/drive/append – Zeile an bestehende Datei anhängen (oder neu erstellen) ───────────────
  if (req.method === 'POST' && pathname === '/api/drive/append') {
    const body = await _readBody(req);
    try {
      const { name, line, folder } = JSON.parse(body);
      if (!name || !line) return json({ error: 'name und line erforderlich' }, 400);
      const tok = await getGoogleToken('otto');
      // Ordner-ID ermitteln
      let folderId = null;
      if (folder) {
        const fs2 = await googleGet(tok.access_token, `/drive/v3/files?q=${encodeURIComponent("name='" + folder + "' and mimeType='application/vnd.google-apps.folder' and trashed=false")}&fields=files(id)&pageSize=1`);
        if (fs2.files?.[0]) folderId = fs2.files[0].id;
        else {
          const cb = JSON.stringify({ name: folder, mimeType: 'application/vnd.google-apps.folder' });
          const created = await new Promise((resolve, reject) => { const rq = https.request({ hostname:'www.googleapis.com', path:'/drive/v3/files?fields=id', method:'POST', headers:{ Authorization:'Bearer '+tok.access_token, 'Content-Type':'application/json', 'Content-Length':Buffer.byteLength(cb) } }, r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>{try{resolve(JSON.parse(d));}catch{reject(new Error('parse'));}}); }); rq.on('error',reject); rq.write(cb); rq.end(); });
          folderId = created.id;
        }
      }
      // Datei suchen
      const parentQ = folderId ? `'${folderId}' in parents` : `'root' in parents`;
      const found = await googleGet(tok.access_token, `/drive/v3/files?q=${encodeURIComponent("name='" + name + "' and " + parentQ + " and trashed=false")}&fields=files(id,name)&pageSize=1`);
      let existingContent = '';
      let existingId = null;
      if (found.files?.[0]) {
        existingId = found.files[0].id;
        const dlGet = p => new Promise((res, rej) => { const rq = https.request({ hostname:'www.googleapis.com', path:p, method:'GET', headers:{ Authorization:'Bearer '+tok.access_token } }, r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>res(d)); }); rq.on('error',rej); rq.end(); });
        existingContent = await dlGet(`/drive/v3/files/${existingId}?alt=media`);
      }
      // Zeile anhängen
      const newContent = (existingContent.trimEnd() ? existingContent.trimEnd() + '\n' : '') + line.trimEnd() + '\n';
      if (existingId) {
        // Update
        const buf = Buffer.from(newContent, 'utf-8');
        const updated = await new Promise((resolve, reject) => { const rq = https.request({ hostname:'www.googleapis.com', path:`/upload/drive/v3/files/${existingId}?uploadType=media`, method:'PATCH', headers:{ Authorization:'Bearer '+tok.access_token, 'Content-Type':'text/plain; charset=utf-8', 'Content-Length':buf.length } }, r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>{try{resolve(JSON.parse(d));}catch{reject(new Error('parse'));}}); }); rq.on('error',reject); rq.write(buf); rq.end(); });
        return json({ ok:true, id:existingId, name, aktion:'angehaengt', zeilen: newContent.trim().split('\n').length });
      } else {
        // Neu erstellen
        const boundary = '---innovoo_append_' + Date.now();
        const metadata = { name, mimeType:'text/plain; charset=utf-8', parents: folderId ? [folderId] : [] };
        const mp = '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata) + '\r\n--' + boundary + '\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n' + newContent + '\r\n--' + boundary + '--';
        const mpBuf = Buffer.from(mp, 'utf-8');
        const created = await new Promise((resolve,reject) => { const rq = https.request({ hostname:'www.googleapis.com', path:'/upload/drive/v3/files?uploadType=multipart&fields=id,name', method:'POST', headers:{ Authorization:'Bearer '+tok.access_token, 'Content-Type':'multipart/related; boundary='+boundary, 'Content-Length':mpBuf.length } }, r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>{try{resolve(JSON.parse(d));}catch{reject(new Error('parse'));}}); }); rq.on('error',reject); rq.write(mpBuf); rq.end(); });
        return json({ ok:true, id:created.id, name, aktion:'erstellt', zeilen:1 });
      }
    } catch(e) { return json({ error: e.message }, 500); }
  }

  if (req.method === 'POST' && pathname === '/api/drive/upload') {
    const body = await _readBody(req);
    try {
      const { name, content, folder } = JSON.parse(body);
      if (!name || content == null) return json({ error: 'name und content erforderlich' }, 400);
      const tok = await getGoogleToken('otto');
      let folderId = null;
      if (folder) {
        const fs2 = await googleGet(tok.access_token, `/drive/v3/files?q=${encodeURIComponent("name='" + folder + "' and mimeType='application/vnd.google-apps.folder' and trashed=false")}&fields=files(id)&pageSize=1`);
        if (fs2.files?.[0]) { folderId = fs2.files[0].id; }
        else {
          const cb = JSON.stringify({ name:folder, mimeType:'application/vnd.google-apps.folder' });
          const created = await new Promise((resolve,reject)=>{ const rq=https.request({hostname:'www.googleapis.com',path:'/drive/v3/files?fields=id',method:'POST',headers:{Authorization:'Bearer '+tok.access_token,'Content-Type':'application/json','Content-Length':Buffer.byteLength(cb)}},r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>{try{resolve(JSON.parse(d));}catch{reject(new Error('parse'));}});}); rq.on('error',reject); rq.write(cb); rq.end(); });
          folderId = created.id;
        }
      }
      const boundary = '---innovoo_' + Date.now();
      const metadata = { name, mimeType:'text/plain; charset=utf-8', parents: folderId?[folderId]:[] };
      const mp = '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata) + '\r\n--' + boundary + '\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n' + content + '\r\n--' + boundary + '--';
      const mpBuf = Buffer.from(mp,'utf-8');
      const uploaded = await new Promise((resolve,reject)=>{ const rq=https.request({hostname:'www.googleapis.com',path:'/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',method:'POST',headers:{Authorization:'Bearer '+tok.access_token,'Content-Type':'multipart/related; boundary='+boundary,'Content-Length':mpBuf.length}},r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>{try{resolve(JSON.parse(d));}catch{reject(new Error('parse'));}});}); rq.on('error',reject); rq.write(mpBuf); rq.end(); });
      if (uploaded.error) throw new Error(uploaded.error.message || JSON.stringify(uploaded.error));
      return json({ id:uploaded.id, name:uploaded.name, ordner:folder||'root', aktion:'erstellt', link:uploaded.webViewLink||'' });
    } catch(e) { return json({ error:e.message }, 500); }
  }

  // ── /api/banking ──────────────────────────────────────────────────────────
  if (req.method === 'GET' && pathname.startsWith('/api/banking')) {
    const csvPath = process.env.BANK_CSV_PATH || '';
    if (!csvPath || !fs.existsSync(csvPath)) {
      return json({ error: 'Keine Bankdaten konfiguriert', hint: 'BANK_CSV_PATH in .env setzen', kontostand: 0, transaktionen_gesamt: 0, letzte_10: [], kategorien: {} });
    }
    try {
      const lines = fs.readFileSync(csvPath, 'latin1').split('\n').map(l=>l.trim()).filter(Boolean);
      const sep = lines.find(l=>l.includes(';')) ? ';' : ',';
      let headerIdx = 0;
      for (let i=0;i<Math.min(20,lines.length);i++) { if(/datum|buchung|betrag|amount|date/i.test(lines[i])){headerIdx=i;break;} }
      const headers = lines[headerIdx].split(sep).map(h=>h.replace(/["']/g,'').toLowerCase().trim());
      const dateCol=headers.findIndex(h=>/datum|buchung|date/i.test(h)), amountCol=headers.findIndex(h=>/betrag|amount|umsatz/i.test(h)), descCol=headers.findIndex(h=>/verwendung|beschreibung|purpose|text/i.test(h));
      const transactions=[]; let balance=0;
      for (let i=headerIdx+1;i<lines.length;i++) {
        const cols=lines[i].split(sep).map(c=>c.replace(/["']/g,'').trim()); if(cols.length<3) continue;
        const datum=dateCol>=0?cols[dateCol]:'', betrag=parseFloat((amountCol>=0?cols[amountCol]:'0').replace(/\./g,'').replace(',','.'))||0, verwendung=descCol>=0?cols[descCol]:'';
        if(datum&&betrag!==0) { transactions.push({datum,betrag,verwendung:verwendung.slice(0,80)}); balance+=betrag; }
      }
      const kategorien={};
      for(const tx of transactions) { const lo=tx.verwendung.toLowerCase(); let kat='Sonstiges'; if(/rewe|edeka|lidl|aldi/.test(lo)) kat='Lebensmittel'; else if(/amazon|zalando|otto/.test(lo)) kat='Shopping'; else if(/spotify|netflix|disney|abo/.test(lo)) kat='Abonnements'; else if(/bahn|flug|hotel|booking/.test(lo)) kat='Reise'; else if(/restaurant|cafe|pizza/.test(lo)) kat='Gastronomie'; else if(/apotheke|arzt/.test(lo)) kat='Gesundheit'; else if(/miete|strom|gas/.test(lo)) kat='Wohnen'; else if(/gehalt|lohn|gutschrift/.test(lo)) kat='Einnahmen'; kategorien[kat]=(kategorien[kat]||0)+tx.betrag; }
      return json({ quelle:'CSV', kontostand:Math.round(balance*100)/100, transaktionen_gesamt:transactions.length, letzte_10:transactions.slice(-10).reverse(), kategorien });
    } catch(e) { return json({ error:e.message }, 500); }
  }

  // ── /api/gmail (lesen) ────────────────────────────────────────────────────
  if (req.method === 'GET' && pathname.startsWith('/api/gmail') && !pathname.startsWith('/api/gmail/send')) {
    try {
      const tok   = await getGoogleToken(urlObj.searchParams.get('agent') || 'otto');
      const limit = parseInt(urlObj.searchParams.get('limit') || '10');
      const q     = urlObj.searchParams.get('q') || 'in:inbox';
      const listRes = await new Promise((resolve,reject)=>{ const rq=https.request({hostname:'www.googleapis.com',path:`/gmail/v1/users/me/messages?maxResults=${limit}&q=${encodeURIComponent(q)}`,method:'GET',headers:{Authorization:'Bearer '+tok.access_token}},r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>{try{resolve(JSON.parse(d));}catch{reject(new Error('parse'));}});}); rq.on('error',reject); rq.setTimeout(8000,()=>{rq.destroy();reject(new Error('Timeout'));}); rq.end(); });
      const ids  = (listRes.messages||[]).map(m=>m.id);
      const mails = await Promise.all(ids.map(id => new Promise(resolve => {
        const rq = https.request({ hostname:'www.googleapis.com', path:`/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`, method:'GET', headers:{Authorization:'Bearer '+tok.access_token} }, r => {
          let d=''; r.on('data',c=>d+=c); r.on('end',()=>{ try { const m=JSON.parse(d); const hdr=h=>(m.payload?.headers||[]).find(x=>x.name===h)?.value||'?'; resolve({id:m.id,datum:hdr('Date'),von:hdr('From'),betreff:hdr('Subject'),snippet:m.snippet||''}); } catch { resolve({id,fehler:'parse'}); } });
        });
        rq.on('error',()=>resolve({id,fehler:'network'})); rq.setTimeout(5000,()=>{rq.destroy();resolve({id,fehler:'timeout'});}); rq.end();
      })));
      return json({ ok:true, anzahl:mails.length, mails });
    } catch(e) { return json({ error:e.message, connected:false }); }
  }

  // ── /api/gmail/send ───────────────────────────────────────────────────────
  if (req.method === 'POST' && pathname === '/api/gmail/send') {
    const body = await _readBody(req);
    try {
      const { an, betreff, text } = JSON.parse(body);
      if (!an || !betreff || !text) return json({ error:'an, betreff, text erforderlich' }, 400);
      const tok = await getGoogleToken('otto');
      const raw = Buffer.from('To: ' + an + '\r\nSubject: ' + betreff + '\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n' + text).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
      const sendBody = JSON.stringify({ raw });
      const sendRes = await new Promise((resolve,reject)=>{ const rq=https.request({hostname:'www.googleapis.com',path:'/gmail/v1/users/me/messages/send',method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tok.access_token,'Content-Length':Buffer.byteLength(sendBody)}},r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>{try{resolve(JSON.parse(d));}catch{reject(new Error('parse'));}});}); rq.on('error',reject); rq.setTimeout(10000,()=>{rq.destroy();reject(new Error('Timeout'));}); rq.write(sendBody); rq.end(); });
      if (sendRes.error) throw new Error(sendRes.error.message || JSON.stringify(sendRes.error));
      return json({ ok:true, id:sendRes.id, an, betreff });
    } catch(e) { return json({ error:e.message }, 500); }
  }

  
  // ── POST /api/telegram/webhook – eingehende Nachrichten von Telegram ─────────
  if (req.method === 'POST' && pathname === '/api/telegram/webhook') {
    const body = await _readBody(req);
    // Sofort 200 antworten (Telegram erwartet < 5s)
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"ok":true}');

    let update;
    try { update = JSON.parse(body); } catch(e) {
      console.error('[Telegram] JSON-Parse Fehler:', e.message, '| Body:', body.slice(0, 100));
      return;
    }

    const msg  = update.message || update.edited_message;
    if (!msg) {
      console.warn('[Telegram] Update ohne message-Objekt:', JSON.stringify(update).slice(0, 200));
      return;
    }

    const chatId = msg.chat?.id;
    const text   = (msg.text || '').trim();
    const name   = msg.from?.first_name || 'Nutzer';

    console.log(`\x1b[35m→ Telegram\x1b[0m von ${name} (chatId: ${chatId}): "${text.slice(0, 60)}"`);
    console.log(`\x1b[35m   Config\x1b[0m  TELEGRAM_CHAT_ID=${process.env.TELEGRAM_CHAT_ID || '(leer)'} | TOKEN gesetzt: ${!!process.env.TELEGRAM_BOT_TOKEN}`);

    if (!text || !chatId) {
      console.warn('[Telegram] text oder chatId fehlt – ignoriert');
      return;
    }

    // Sicherheit: nur konfigurierte Chat-ID akzeptieren
    const allowedChatId = process.env.TELEGRAM_CHAT_ID || '';
    if (allowedChatId && String(chatId) !== String(allowedChatId)) {
      console.warn(`[Telegram] ⚠️ Chat-ID MISMATCH: eingehend=${chatId} | erwartet=${allowedChatId} – ignoriert`);
      // Trotzdem antworten damit der Absender Feedback bekommt:
      await telegramSend(`⛔ Nicht autorisiert. (Chat-ID: ${chatId})`, { chatId });
      return;
    }

    // /start Kommando – chatId explizit übergeben
    if (text === '/start') {
      const r = await telegramSend(`👋 Hallo ${name}!\n\nInnovooClaw ist verbunden. Schreib mir einfach – ich leite es an den passenden Agenten weiter.\n\nBeispiele:\n• Wie ist das Wetter?\n• Lies meine Mails\n• Kontostand\n• @VERA wie war mein Schlaf?`, { chatId });
      console.log('[Telegram] /start Antwort:', JSON.stringify(r).slice(0, 100));
      return;
    }

    // Agent aus Präfix ermitteln
    let agentKey  = 'otto';
    let cleanText = text;
    const prefixMatch = text.match(/^@(OTTO|MINA|VERA|LEO|SAM|CLEO|SHELLYEM|REACT)\s*/i);
    if (prefixMatch) {
      // @AGENT Syntax
      agentKey  = prefixMatch[1].toLowerCase();
      cleanText = text.slice(prefixMatch[0].length).trim();
    } else {
      // Namentliche Ansprache: 'Mina, ...' / 'Otto:' / 'vera ...' usw.
      const nameMatch = text.match(/^(otto|mina|vera|leo|sam|cleo|shellyem|react)[,:.!?\s]+/i);
      if (nameMatch) {
        agentKey  = nameMatch[1].toLowerCase();
        cleanText = text.slice(nameMatch[0].length).trim() || text;
        console.log(`[Telegram] Namenserkennung: "${nameMatch[1]}" → ${agentKey.toUpperCase()}`);
      } else {
        const ov = _applyRoutingOverride(text);
        if (ov) agentKey = ov.agent;
        else {
          try { const r = resolveAgent(text, 'otto'); if (r?.agentId) agentKey = r.agentId; } catch(_) {}
        }
      }
    }

    console.log(`[Telegram] → Agent: ${agentKey.toUpperCase()} | Text: "${cleanText.slice(0, 60)}"`);

    // Agent anfragen
    try {
      const postBody = JSON.stringify({ message: cleanText, maxTokens: 1200 });
      const agentRes = await new Promise((resolve, reject) => {
        const rq = http.request({
          hostname: 'localhost', port: PORT,
          path: '/api/agent/' + agentKey,
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postBody) }
        }, (r) => {
          let d = ''; r.on('data', c => d += c);
          r.on('end', () => { try { resolve(JSON.parse(d)); } catch { reject(new Error('Agent-Antwort parse-Fehler')); } });
        });
        rq.setTimeout(55000, () => { rq.destroy(); reject(new Error('Agent Timeout (55s)')); });
        rq.on('error', e => reject(new Error('Agent HTTP-Fehler: ' + e.message)));
        rq.write(postBody); rq.end();
      });

      console.log(`[Telegram] Agent-Antwort: ok=${agentRes.ok} | agent=${agentRes.agent} | reply-länge=${(agentRes.reply||'').length}`);

      const reply  = agentRes.reply || agentRes.error || '(keine Antwort)';
      const agent  = (agentRes.agent || agentKey).toUpperCase();
      const sendResult = await telegramSend(`<b>${agent}:</b>\n${reply.slice(0, 4000)}`, { chatId });
      console.log(`[Telegram] ✅ Reply gesendet → ok=${sendResult?.ok} | error=${sendResult?.error||'-'}`);
    } catch(e) {
      console.error('[Telegram] ❌ Fehler in Agent-Kette:', e.message);
      const sendResult = await telegramSend(`⚠️ Fehler: ${e.message}`, { chatId });
      console.log('[Telegram] Fehler-Reply:', JSON.stringify(sendResult).slice(0, 100));
    }
    return;
  }

  // ── /api/telegram/test ───────────────────────────────────────────────────────
  if (req.method === 'GET' && pathname === '/api/telegram/test') {
    const r = await telegramSend('\u2705 <b>innovooClaw</b> ist verbunden!\n\nOTTO, VERA und alle Agents k\u00f6nnen dir jetzt Nachrichten schicken.');
    return json(r);
  }

  // ── /api/telegram/send ────────────────────────────────────────────────────────
  if (req.method === 'POST' && pathname === '/api/telegram/send') {
    const body = await _readBody(req);
    let payload;
    try { payload = JSON.parse(body); } catch { return json({ error: 'JSON ung\u00fcltig' }, 400); }
    const text = (payload.text || payload.message || '').trim();
    if (!text) return json({ error: 'text fehlt' }, 400);
    const r = await telegramSend(text, { silent: payload.silent || false });
    console.log(`\x1b[35m\u2192 Telegram\x1b[0m: ${text.slice(0,60)}`);
    return json(r);
  }

  // ── /api/slack/status ─────────────────────────────────────────────────────────
  if (req.method === 'GET' && pathname === '/api/slack/status') {
    return json({
      configured: !!(process.env.SLACK_BOT_TOKEN && process.env.SLACK_WEBHOOK_URL),
      webhook:    !!process.env.SLACK_WEBHOOK_URL,
      bot_token:  !!process.env.SLACK_BOT_TOKEN,
      channel:    process.env.SLACK_CHANNEL || '#innovooclaw',
    });
  }

  // ── POST /api/slack – Slack Events API ───────────────────────────────────────
  if (req.method === 'POST' && pathname === '/api/slack') {
    const rawBody = await _readBody(req);
    let payload;
    try { payload = JSON.parse(rawBody); } catch { res.writeHead(400); res.end('Bad JSON'); return; }

    // Slack URL-Verification (einmalig beim Setup)
    if (payload.type === 'url_verification') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ challenge: payload.challenge }));
      console.log('\x1b[32m\u2705 Slack URL-Verification\x1b[0m');
      return;
    }

    const event     = payload.event;
    if (!event || event.bot_id) { res.writeHead(200); res.end('ok'); return; }
    const msgText   = (event.text || '').replace(/<@[^>]+>/g, '').trim();
    const channelId = event.channel;
    if (!msgText) { res.writeHead(200); res.end('ok'); return; }

    const botToken  = process.env.SLACK_BOT_TOKEN  || '';
    const webhookUrl = process.env.SLACK_WEBHOOK_URL || '';

    // Antwort sofort senden (Slack erwartet <3s)
    res.writeHead(200); res.end('ok');

    const slackPost = async (channel, msg) => {
      if (botToken) {
        const sb = JSON.stringify({ channel, text: msg });
        await new Promise(resolve => {
          const rq = https.request({ hostname:'slack.com', path:'/api/chat.postMessage', method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+botToken,'Content-Length':Buffer.byteLength(sb)} }, r => { r.resume(); r.on('end', resolve); });
          rq.on('error', () => resolve()); rq.write(sb); rq.end();
        });
      } else if (webhookUrl) {
        const wb = JSON.stringify({ text: msg });
        await new Promise(resolve => {
          const u = new URL(webhookUrl);
          const rq = https.request({ hostname:u.hostname, path:u.pathname, method:'POST', headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(wb)} }, r => { r.resume(); r.on('end', resolve); });
          rq.on('error', () => resolve()); rq.write(wb); rq.end();
        });
      }
    };

    if (!process.env.ANTHROPIC_API_KEY || (!botToken && !webhookUrl)) return;

    // /react [Aufgabe] – REACT-Loop
    if (/^\/react\b/i.test(msgText)) {
      const reactQuery = msgText.replace(/^\/react\s*/i, '').trim();
      if (!reactQuery) { await slackPost(channelId, ':brain: *Nutzung:* `/react [Aufgabe]`'); return; }
      try {
        const body = JSON.stringify({ message: reactQuery, maxTokens: 1500 });
        const agentRes = await new Promise((resolve, reject) => {
          const rq = http.request({ hostname:'localhost', port:PORT, path:'/api/agent/react', method:'POST', headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)} }, r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>{ try{resolve(JSON.parse(d));}catch{reject(new Error('parse'));} }); });
          rq.setTimeout(120000,()=>{rq.destroy();reject(new Error('Timeout'));}); rq.on('error',reject); rq.write(body); rq.end();
        });
        await slackPost(channelId, (agentRes.reply||agentRes.error||'(keine Antwort)').slice(0,2800));
      } catch(e) { await slackPost(channelId, '\u26a0\ufe0f REACT-Fehler: ' + e.message); }
      return;
    }

    // Auto-Routing per Override oder Keyword
    let agentKey = 'otto';
    const ovSlack = _applyRoutingOverride(msgText);
    if (ovSlack) {
      agentKey = ovSlack.agent;
    } else {
      try { const r = resolveAgent(msgText, 'otto'); if(r?.agentId) agentKey = r.agentId; } catch(_) {}
    }

    const slackHist = _slackHistoryGet(channelId, agentKey);
    try {
      const postBody = JSON.stringify({ message: msgText, history: slackHist, maxTokens: 1500 });
      const agentRes = await new Promise((resolve, reject) => {
        const rq = http.request({ hostname:'localhost', port:PORT, path:'/api/agent/'+agentKey, method:'POST', headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(postBody)} }, r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>{ try{resolve(JSON.parse(d));}catch{reject(new Error('parse'));} }); });
        rq.setTimeout(30000,()=>{rq.destroy();reject(new Error('Timeout nach 30s'));}); rq.on('error',reject); rq.write(postBody); rq.end();
      });
      const reply = agentRes.reply || agentRes.error || '(keine Antwort)';
      _slackHistoryPush(channelId, agentKey, msgText, reply);
      await slackPost(channelId, reply);
      console.log(`\x1b[35m\u2192 Slack\x1b[0m ${(agentRes.agent||agentKey).toUpperCase()} [hist:${Math.floor(slackHist.length/2)}]: ${reply.slice(0,80)}`);
    } catch(e) { console.error('\x1b[31m\u274c Slack Agent Fehler:\x1b[0m', e.message); await slackPost(channelId, '\u26a0\ufe0f Fehler: ' + e.message); }
    return;
  }

  // ── /api/status ───────────────────────────────────────────────────────────
  if (req.method === 'GET' && pathname === '/api/status') {
    return json({
      version: '2.0.0', agents: agentFactory.list(),
      memory: (() => { try { return require('./modules/memory-vector').status(); } catch { return { ready:false }; } })(),
      timestamp: new Date().toISOString(),
    });
  }

  // ── SSE – /api/events ─────────────────────────────────────────────────────
  if (req.method === 'GET' && pathname === '/api/events') {
    const clientId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    res.writeHead(200, { 'Content-Type':'text/event-stream', 'Cache-Control':'no-cache', 'Connection':'keep-alive' });
    res.write(`data: ${JSON.stringify({ type:'connected', clientId })}\n\n`);
    _sseClients.set(clientId, res);
    req.on('close', () => _sseClients.delete(clientId));
    return;
  }

  // ── 404 ───────────────────────────────────────────────────────────────────
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found', path: pathname }));
}

function _readBody(req) {
  return new Promise(r => { let d=''; req.on('data', c => d+=c); req.on('end', () => r(d)); });
}

function _listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once('error', e => {
      if (e.code === 'EADDRINUSE') console.error(`\x1b[31m❌ Port ${port} belegt!\x1b[0m  → taskkill /F /IM node.exe /T`);
      reject(e);
    });
    server.listen(port, resolve);
  });
}

async function start() {
  console.log('\x1b[36m⟳ innovooClaw v2.0 startet...\x1b[0m');

  // ── Caddy-Status prüfen und loggen ───────────────────────────────────────
  setTimeout(() => {
    try {
      const { execSync } = require('child_process');
      const isWin = process.platform === 'win32';
      // Methode 1: PID-Datei prüfen
      const pidFile = path.join(__dirname, 'logs', 'caddy.pid');
      if (fs.existsSync(pidFile)) {
        const pid = fs.readFileSync(pidFile, 'utf8').trim();
        try {
          const cmd   = isWin ? `tasklist /FI "PID eq ${pid}" /NH 2>nul` : `ps -p ${pid} -o comm= 2>/dev/null`;
          const check = execSync(cmd, { encoding: 'utf8', timeout: 3000 });
          if (check.toLowerCase().includes('caddy')) {
            console.log(`\x1b[32m✅ Caddy\x1b[0m      Reverse Proxy läuft (PID ${pid}) → https://${process.env.CADDY_DOMAIN || 'localhost'}`);
            return;
          }
        } catch(_) {}
      }
      // Methode 2: Prozessname suchen
      const cmd2   = isWin ? 'tasklist /FI "IMAGENAME eq caddy.exe" /NH 2>nul' : 'pgrep -x caddy 2>/dev/null';
      const result = execSync(cmd2, { encoding: 'utf8', timeout: 3000 });
      const found  = isWin ? result.toLowerCase().includes('caddy.exe') : result.trim().length > 0;
      if (found) {
        console.log('\x1b[32m✅ Caddy\x1b[0m      Reverse Proxy läuft (Hintergrund) → https://' + (process.env.CADDY_DOMAIN || 'localhost'));
      } else {
        const hint = isWin ? 'innovooclaw-start.bat' : 'caddy start --config Caddyfile';
        console.log(`\x1b[33m⚠️  Caddy\x1b[0m      NICHT aktiv – manuell starten: ${hint}`);
      }
    } catch(_) {}
  }, 6000);

  agentFactory.loadAll();
  require('./modules/memory-vector').init().catch(e => console.warn('\x1b[33m⚠️  VectorMemory\x1b[0m:', e.message));

  const httpServer = http.createServer(requestHandler);
  await _listen(httpServer, PORT);
  console.log(`\x1b[32m✅ HTTP\x1b[0m     http://localhost:${PORT}/`);

  if (tlsCreds) {
    const httpsServer = https.createServer(tlsCreds, requestHandler);
    await _listen(httpsServer, HTTPS_PORT);
    console.log(`\x1b[32m✅ HTTPS\x1b[0m    https://localhost:${HTTPS_PORT}/`);
  } else {
    console.log('\x1b[33m⚠️  HTTPS\x1b[0m deaktiviert (kein cert.pem/key.pem)');
  }

  console.log(`\x1b[32m✅ Bereit\x1b[0m   Agents: ${agentFactory.list().join(', ')}`);
  console.log(`\x1b[32m✅ UI\x1b[0m       http://localhost:${PORT}/innovooclaw.html`);
}

start().catch(e => { console.error('\x1b[31m❌ Startup-Fehler:\x1b[0m', e.message); process.exit(1); });