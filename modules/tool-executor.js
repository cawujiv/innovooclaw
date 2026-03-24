// ─── innovooClaw · modules/tool-executor.js ──────────────────────────────────
'use strict';

const http  = require('http');
const https = require('https');

const PORT = parseInt(process.env.PORT || '3000');

// ── Interne HTTP-Helfer ───────────────────────────────────────────────────────
function fetchInternal(urlPath, timeoutMs = 10000) {
  return new Promise((resolve) => {
    const req = http.request(
      { hostname: 'localhost', port: PORT, path: urlPath, method: 'GET',
        headers: { 'x-api-key': process.env.API_SECRET || '' } },
      (res) => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({ error: 'JSON parse error', raw: d.slice(0, 200) }); } });
      }
    );
    req.on('error', e => resolve({ error: e.message }));
    req.setTimeout(timeoutMs, () => { req.destroy(); resolve({ error: 'Timeout' }); });
    req.end();
  });
}

function postInternal(urlPath, body, timeoutMs = 10000) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body);
    const req  = http.request({
      hostname: 'localhost', port: PORT, path: urlPath, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data),
                 'x-api-key': process.env.API_SECRET || '' },
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({ error: 'JSON parse error' }); } });
    });
    req.on('error', e => resolve({ error: e.message }));
    req.setTimeout(timeoutMs, () => { req.destroy(); resolve({ error: 'Timeout' }); });
    req.write(data); req.end();
  });
}

// ── Haupt-Funktion ────────────────────────────────────────────────────────────
async function executeTool(toolName, toolInput, agentKey) {
  agentKey = (agentKey || 'otto').toLowerCase();
  const isOtto = agentKey === 'otto';
  const WRITE_TOOLS = ['driveUpload','driveDelete','gmailSend','gcalWrite','gcalDelete'];
  if (WRITE_TOOLS.includes(toolName) && !isOtto) {
    return `❌ Keine Schreibberechtigung: Agent ${agentKey.toUpperCase()} darf "${toolName}" nicht ausführen (nur OTTO).`;
  }
  try {
    switch (toolName) {

      // ── Gmail ────────────────────────────────────────────────────────────
      case 'gmailRead': {
        const limit = toolInput.limit || 10;
        const q     = toolInput.q     || 'in:inbox';
        const r = await fetchInternal(`/api/gmail?limit=${limit}&q=${encodeURIComponent(q)}&agent=${agentKey}`, 15000);
        if (r.error) return `Gmail Fehler: ${r.error}`;
        if (!r.mails?.length) return 'Keine E-Mails gefunden.';
        return r.mails.map(m => `📧 ${m.datum?.slice(0,16) || '?'} | Von: ${m.von} | Betreff: ${m.betreff}\n   ${m.snippet?.slice(0,100) || ''}`).join('\n\n');
      }

      case 'gmailSend': {
        const r = await postInternal('/api/gmail/send', { an: toolInput.an, betreff: toolInput.betreff, text: toolInput.text }, 15000);
        if (r.error) return `Gmail Senden Fehler: ${r.error}`;
        return `✅ Mail gesendet an ${toolInput.an}: "${toolInput.betreff}"`;
      }

      // ── VVS ──────────────────────────────────────────────────────────────
      case 'vvsVerbindung': {
        const von  = encodeURIComponent(toolInput.von  || '');
        const nach = encodeURIComponent(toolInput.nach || '');
        const wann = toolInput.zeit ? `&wann=${encodeURIComponent(toolInput.zeit)}` : '';
        const r = await fetchInternal(`/api/vvs/verbindung?von=${von}&nach=${nach}${wann}`);
        if (r.error) return `VVS Fehler: ${r.error}`;
        if (r.verbindungen?.length) {
          return r.verbindungen.slice(0, 3).map(v =>
            `${v.abfahrt} → ${v.ankunft} (${v.dauer}) | ${v.umstiege} Umstieg(e) | ${v.linien?.join(', ') || ''}`
          ).join('\n');
        }
        return JSON.stringify(r, null, 2).slice(0, 2000);
      }

      case 'vvsAbfahrten': {
        const hs = encodeURIComponent(toolInput.haltestelle || '');
        const r  = await fetchInternal(`/api/vvs/abfahrten?stop=${hs}&limit=8`);
        if (r.error) return `VVS Abfahrten Fehler: ${r.error}`;
        if (r.abfahrten?.length) {
          return r.abfahrten.slice(0, 8).map(d => {
            const delay = d.verspaetung_min > 0 ? ` (+${d.verspaetung_min}min)` : '';
            return `${d.zeit}${delay} | ${d.typ} ${d.linie} → ${d.richtung}`;
          }).join('\n');
        }
        return JSON.stringify(r, null, 2).slice(0, 2000);
      }

      // ── A2A Delegation ────────────────────────────────────────────────────
      case 'delegateToAgent': {
        const targetAgent = (toolInput.agent || '').toLowerCase();
        const message     = toolInput.message || '';
        const context     = toolInput.context ? `[Kontext: ${toolInput.context}]\n` : '';
        const VALID = ['otto','mina','vera','leo','sam','cleo','shellyem','react'];
        if (!VALID.includes(targetAgent)) return `❌ Unbekannter Agent: "${targetAgent}". Verfügbar: ${VALID.join(', ')}`;
        if (!message) return '❌ Kein message-Parameter angegeben';
        console.log(`\x1b[35m⟶ A2A\x1b[0m OTTO → ${targetAgent.toUpperCase()}: ${message.slice(0,60)}`);
        const r = await postInternal('/api/agent/' + targetAgent, { message: context + message, maxTokens: 1200 }, 30000);
        if (r.error) return `❌ ${targetAgent.toUpperCase()} Fehler: ${r.error}`;
        return `[${targetAgent.toUpperCase()}]: ${r.reply || '(keine Antwort)'}`;
      }

      // ── Wetter ───────────────────────────────────────────────────────────
      case 'wetterAktuell': {
        const r = await fetchInternal('/api/weather?lat=48.7758&lon=9.1829&city=Stuttgart');
        if (r.error) return `Wetter nicht abrufbar: ${r.error}`;
        const a = r.aktuell || {};
        let result = `Stuttgart aktuell: ${a.temperatur || '?'}, ${a.wetter || '?'}\n`;
        result    += `Wind: ${a.wind || '?'}, Niederschlag: ${a.niederschlag || '0mm'}, Feuchtigkeit: ${a.feuchtigkeit || '?'}\n`;
        if (r.woche?.length) result += '\nVorhersage 5 Tage:\n' + r.woche.slice(0, 5).map(d => `  ${d.datum}: ${d.min}–${d.max}, ${d.wetter}, Regen: ${d.regen}`).join('\n');
        return result;
      }

      // ── Garmin ───────────────────────────────────────────────────────────
      case 'garminSleep':
      case 'garminHrv':
      case 'garminSteps': {
        const r = await fetchInternal('/api/garmin/today', 15000);
        if (r.error || r.configured === false) return `Garmin nicht konfiguriert: ${r.hint || r.error || ''}`;
        return JSON.stringify(r, null, 2).slice(0, 2000);
      }

      // ── Web ──────────────────────────────────────────────────────────────
      case 'webFetch': {
        const url    = encodeURIComponent(toolInput.url || '');
        const r = await fetchInternal(`/api/fetch?url=${url}&maxlen=50000`, 15000);
        if (r.error) return `Fetch Fehler: ${r.error}`;
        return (r.content || r.text || JSON.stringify(r));
      }

      case 'browserFetch': {
        const targetUrl = toolInput.url || '';
        if (!targetUrl) return 'browserFetch Fehler: url fehlt';
        const maxlen  = toolInput.maxlen || 15000;
        const timeout = toolInput.timeout || 20000;
        const statusRes = await fetchInternal('/api/browser/status', 3000);
        if (!statusRes?.connected) {
          const fallback = await fetchInternal(`/api/fetch?url=${encodeURIComponent(targetUrl)}&maxlen=${maxlen}`, 15000);
          if (fallback?.error) return `browserFetch (Fallback) Fehler: ${fallback.error}`;
          return (fallback?.text || '').slice(0, maxlen);
        }
        try {
          const navRes = await postInternal('/api/browser/execute', { action: 'navigate', url: targetUrl, timeoutMs: timeout }, timeout + 2000);
          if (!navRes?.ok) return `browserFetch Fehler beim Navigieren: ${navRes?.error || 'unbekannt'}`;
          const pageRes = await postInternal('/api/browser/execute', { action: 'readPage', timeoutMs: 10000 }, 12000);
          if (!pageRes?.ok) return `browserFetch Fehler beim Lesen: ${pageRes?.error || 'unbekannt'}`;
          return (pageRes?.data?.text || '').slice(0, maxlen);
        } catch(e) { return `browserFetch Fehler: ${e.message}`; }
      }

      // ── Google Drive ─────────────────────────────────────────────────────
      case 'driveSearch': {
        const q = encodeURIComponent(toolInput.query || '');
        const r = await fetchInternal(`/api/drive/search?q=${q}&agent=${agentKey}`);
        if (r.error) return `Drive Suche Fehler: ${r.error}`;
        return JSON.stringify(r, null, 2).slice(0, 2000);
      }

      case 'driveRead': {
        const id = encodeURIComponent(toolInput.id || toolInput.fileId || '');
        const r  = await fetchInternal(`/api/drive/read?fileId=${id}&agent=${agentKey}`, 15000);
        if (r.error) return `Drive Lesen Fehler: ${r.error}`;
        return (r.text || r.content || JSON.stringify(r));
      }

      case 'driveList': {
        const folder = encodeURIComponent(toolInput.ordner || toolInput.folder || '');
        const limit  = toolInput.limit || 20;
        const r = await fetchInternal(`/api/drive/list?folder=${folder}&limit=${limit}&agent=${agentKey}`);
        if (r.error) return `Drive List Fehler: ${r.error}`;
        if (r.dateien?.length) return r.dateien
          .map(f => `${f.typ === 'Ordner' ? '📁' : '📄'} id=${f.id} | ${f.name} | ${f.geaendert || ''}`)
          .join('\n');
        return JSON.stringify(r, null, 2).slice(0, 2000);
      }

      case 'driveUpload': {
        const r = await postInternal('/api/drive/upload', { name: toolInput.dateiname, content: toolInput.inhalt, folder: toolInput.ordner || 'innovooClaw' });
        if (r.error) return `Drive Upload Fehler: ${r.error}`;
        return `Datei gespeichert: ${toolInput.dateiname} (ID: ${r.id || '?'})`;
      }

      case 'driveAppend': {
        // Zeile an bestehende Datei anhängen (oder neu erstellen)
        const r = await postInternal('/api/drive/append', {
          name:   toolInput.dateiname || toolInput.name,
          line:   toolInput.zeile    || toolInput.line,
          folder: toolInput.ordner   || toolInput.folder || 'MINA',
        });
        if (r.error) return `Drive Append Fehler: ${r.error}`;
        return `✅ ${r.aktion}: ${r.name} (${r.zeilen} Zeilen gesamt)`;
      }

      // ── Memory ───────────────────────────────────────────────────────────
      case 'saveFact': {
        const r = await postInternal('/api/memory/save-fact', { kategorie: toolInput.kategorie || 'allgemein', schluessel: toolInput.schluessel || 'fakt', wert: String(toolInput.wert || '') });
        if (r?.error) return `saveFact Fehler: ${r.error}`;
        return `✓ Gespeichert: ${toolInput.kategorie}.${toolInput.schluessel} = ${toolInput.wert}`;
      }

      case 'recallMemory': {
        const r = await fetchInternal(`/api/memory/search?q=${encodeURIComponent(toolInput.query || '')}&limit=${toolInput.limit || 5}`);
        if (!r?.hits?.length) return 'Keine passenden Einträge im Gedächtnis gefunden.';
        return r.hits.map(h => `[Score ${h.score}] ${h.text}`).join('\n');
      }

      // ── Shelly ───────────────────────────────────────────────────────────
      case 'shellyStatus':   { const r = await fetchInternal('/api/shelly/status');  if (r.error) return `Shelly Fehler: ${r.error}`; return JSON.stringify(r, null, 2); }
      case 'shellyPower':    { const r = await fetchInternal('/api/shelly/power');   if (r.error) return `Shelly Power Fehler: ${r.error}`; return JSON.stringify(r, null, 2); }
      case 'shellyHistory':  { const r = await fetchInternal('/api/shelly/history', 12000); if (r.error) return `Shelly History Fehler: ${r.error}`; return JSON.stringify(r, null, 2).slice(0, 4000); }
      case 'shellySwitch':   { const r = await postInternal('/api/shelly/switch', { channel: toolInput.kanal, state: toolInput.status }); return JSON.stringify(r); }
      case 'shellyScene':    { const r = await postInternal('/api/shelly/scene', { scene: toolInput.szene }); return JSON.stringify(r); }

      // ── Kalender ─────────────────────────────────────────────────────────
      case 'gcalRead': {
        const r = await fetchInternal(`/api/calendar?range=${toolInput.zeitraum || 'week'}`);
        if (r.error) return `Kalender Fehler: ${r.error}`;
        if (!r.events?.length) return 'Keine Termine gefunden.';
        return r.events.slice(0, 15).map(e => `${(e.start || '').slice(0, 16)}: ${e.summary}${e.location ? ' @ ' + e.location : ''}`).join('\n');
      }

      // ── Agents / Cron ─────────────────────────────────────────────────────
      case 'agentsRead': {
        try {
          const { AGENTS } = require('../data/agent-registry');
          const overviews = Object.values(AGENTS).map(a =>
            `${a.icon || '🤖'} ${a.name} (/${a.id}) – ${a.description || ''}\n   Tools: ${(a.tools || []).join(', ')}\n   Delegiert an: ${(a.delegates || []).join(', ') || '–'}`
          ).join('\n\n');
          return `Verfügbare Agents (${Object.keys(AGENTS).length}):\n\n${overviews}`;
        } catch(e) { return `agentsRead Fehler: ${e.message}`; }
      }
      case 'cronAdd': {
        const r = await postInternal('/api/cron/add', { name: toolInput.name, schedule: toolInput.schedule, action: toolInput.action });
        if (r.error) return `CronJob Fehler: ${r.error}`;
        return `CronJob angelegt: "${toolInput.name}" @ ${toolInput.schedule}`;
      }

      // ── Browser Task ──────────────────────────────────────────────────────
      case 'browserTask': {
        const task = toolInput.task || toolInput.url || '';
        const maxSteps = Math.min(toolInput.maxSteps || 12, 20);
        if (!task) return 'browserTask Fehler: task fehlt';
        const statusRes = await fetchInternal('/api/browser/status', 3000);
        if (!statusRes?.connected) return 'browserTask Fehler: Browser-Relay nicht verbunden!';
        const r = await postInternal('/api/browser/task', { task, maxSteps, agentKey }, 120000);
        if (r?.error) return `browserTask Fehler: ${r.error}`;
        if (r?.screenshot) return { __visionResult: true, imageB64: r.screenshot, text: `browserTask (${r.steps} Schritte):\n${r.result || ''}` };
        return `browserTask (${r?.steps||'?'} Schritte):\n${r?.result||r?.error||'(kein Ergebnis)'}`;
      }

      // ── Telegram ──────────────────────────────────────────────────────────
      case 'telegramNotify': {
        const text = toolInput.text || toolInput.message || '';
        if (!text) return 'telegramNotify Fehler: text fehlt';
        const r = await postInternal('/api/telegram/send', { text, silent: toolInput.silent || false }, 10000);
        if (r?.ok === false) return `Telegram Fehler: ${r.error || JSON.stringify(r)}`;
        return '✅ Telegram-Nachricht gesendet';
      }

      // ── Wissensbasis ──────────────────────────────────────────────────────
      case 'kbSearch': {
        const query = toolInput.query || toolInput.q || '';
        if (!query) return 'kbSearch Fehler: query fehlt';
        const limit = Math.min(toolInput.limit || 6, 15);
        const r = await fetchInternal(`/api/kb/search?q=${encodeURIComponent(query)}&limit=${limit}`, 15000);
        if (r?.error) return `kbSearch Fehler: ${r.error}`;
        if (!r?.results?.length) return `Keine relevanten Dokumente für: "${query}"`;
        return r.results.map((h, i) => `[${i+1}] ${h.source ? h.source.split(':').slice(2).join(':') : 'Memory'} (Score: ${h.score ?? '?'})\n${h.text.slice(0, 400)}`).join('\n\n');
      }

      default:
        return `Unbekanntes Tool: ${toolName}`;
    }
  } catch(e) {
    return `Tool-Fehler (${toolName}): ${e.message}`;
  }
}

// Vereinheitlichter API-Handler für Special-Endpoints (aus proxy.js delegiert)
async function handleSpecialApi(req, res, pathname, urlObj) {
  res.writeHead(501, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'handleSpecialApi: Noch nicht implementiert – direkt in proxy.js' }));
}

module.exports = { executeTool, handleSpecialApi };
