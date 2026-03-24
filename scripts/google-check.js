// google-check.js — prüft Gmail, Drive und Kalender
// Ausführen: node google-check.js
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
require('dotenv').config({ path: 'C:\\Users\\Manfred\\Documents\\MCP-DATA\\secrets\\secrets.env', override: false });

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const TOKEN_PATH = path.join(__dirname, '..', 'secrets', 'tokens', 'google_token.json');

// ── Token laden + ggf. refreshen ─────────────────────────────────────────────
async function getToken() {
  const tok = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
  const now = Date.now();
  const expiresAt = tok.saved_at + (tok.expires_in * 1000) - 60000;

  if (now > expiresAt) {
    console.log('⟳  Token abgelaufen – refreshe...');
    const pd = new URLSearchParams({
      refresh_token: tok.refresh_token,
      client_id:     process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      grant_type:    'refresh_token',
    }).toString();
    const fresh = await httpsPost('oauth2.googleapis.com', '/token', pd, 'application/x-www-form-urlencoded');
    if (fresh.error) throw new Error('Refresh fehlgeschlagen: ' + fresh.error_description);
    fresh.saved_at      = Date.now();
    fresh.refresh_token = fresh.refresh_token || tok.refresh_token;
    fresh.email         = tok.email;
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(fresh, null, 2));
    console.log('✅  Token refresht');
    return fresh.access_token;
  }

  const restMin = Math.round((expiresAt - now) / 60000);
  console.log(`✅  Token gültig  (noch ~${restMin} Minuten) | ${tok.email}`);
  return tok.access_token;
}

function httpsGet(token, apiPath) {
  return new Promise((res, rej) => {
    const rq = https.request({
      hostname: 'www.googleapis.com', path: apiPath, method: 'GET',
      headers: { Authorization: 'Bearer ' + token }
    }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch { rej(new Error('parse')); } }); });
    rq.on('error', rej);
    rq.setTimeout(10000, () => { rq.destroy(); rej(new Error('Timeout')); });
    rq.end();
  });
}

function httpsPost(host, p, body, ct) {
  return new Promise((res, rej) => {
    const rq = https.request({
      hostname: host, path: p, method: 'POST',
      headers: { 'Content-Type': ct, 'Content-Length': Buffer.byteLength(body) }
    }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch { rej(new Error('parse')); } }); });
    rq.on('error', rej); rq.write(body); rq.end();
  });
}

async function run() {
  console.log('\n════════════════════════════════════════════');
  console.log(' Google-Zugriff Diagnose');
  console.log('════════════════════════════════════════════\n');

  let token;
  try { token = await getToken(); }
  catch(e) { console.error('❌  Token-Fehler:', e.message); process.exit(1); }

  // ── Gmail ──────────────────────────────────────────────────────────────────
  console.log('\n── Gmail ────────────────────────────────────');
  try {
    const r = await httpsGet(token, '/gmail/v1/users/me/profile');
    if (r.error) throw new Error(r.error.message);
    console.log(`✅  Verbunden  | ${r.emailAddress} | ${r.messagesTotal} Nachrichten`);

    const inbox = await httpsGet(token, '/gmail/v1/users/me/messages?maxResults=3&q=in:inbox');
    const count = inbox.messages?.length || 0;
    console.log(`✅  Posteingang | ${count} neueste Mails abrufbar`);
    if (inbox.messages?.length) {
      for (const m of inbox.messages.slice(0,3)) {
        const detail = await httpsGet(token, `/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`);
        const subj = detail.payload?.headers?.find(h => h.name === 'Subject')?.value || '(kein Betreff)';
        const from = detail.payload?.headers?.find(h => h.name === 'From')?.value || '?';
        console.log(`   📧 ${subj.slice(0,50)} | ${from.slice(0,40)}`);
      }
    }
  } catch(e) { console.error('❌  Gmail Fehler:', e.message); }

  // ── Google Drive ───────────────────────────────────────────────────────────
  console.log('\n── Google Drive ─────────────────────────────');
  try {
    const r = await httpsGet(token, '/drive/v3/about?fields=user,storageQuota');
    if (r.error) throw new Error(r.error.message);
    const used  = Math.round((r.storageQuota?.usage || 0) / 1024 / 1024);
    const total = Math.round((r.storageQuota?.limit  || 0) / 1024 / 1024 / 1024);
    console.log(`✅  Verbunden  | ${r.user?.displayName} | ${used} MB von ${total} GB genutzt`);

    const files = await httpsGet(token, '/drive/v3/files?pageSize=5&orderBy=modifiedTime+desc&fields=files(id,name,modifiedTime,mimeType)');
    if (files.error) throw new Error(files.error.message);
    console.log(`✅  Dateien    | ${files.files?.length || 0} zuletzt geänderte:`);
    for (const f of (files.files || []).slice(0,5)) {
      const typ = f.mimeType?.includes('folder') ? '📁' : '📄';
      console.log(`   ${typ} ${f.name.slice(0,50)} | ${(f.modifiedTime||'').slice(0,10)}`);
    }
  } catch(e) { console.error('❌  Drive Fehler:', e.message); }

  // ── Google Calendar ────────────────────────────────────────────────────────
  console.log('\n── Google Calendar ──────────────────────────');
  try {
    const now   = new Date().toISOString();
    const until = new Date(Date.now() + 14*24*60*60*1000).toISOString();
    const r = await httpsGet(token,
      `/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(now)}&timeMax=${encodeURIComponent(until)}&singleEvents=true&orderBy=startTime&maxResults=5`);
    if (r.error) throw new Error(r.error.message);
    console.log(`✅  Verbunden  | ${r.items?.length || 0} Termine in den nächsten 14 Tagen:`);
    for (const ev of (r.items || []).slice(0,5)) {
      const start = (ev.start?.dateTime || ev.start?.date || '').slice(0,16);
      console.log(`   📅 ${start} | ${(ev.summary||'(kein Titel)').slice(0,50)}`);
    }
  } catch(e) { console.error('❌  Calendar Fehler:', e.message); }

  console.log('\n════════════════════════════════════════════\n');
}

run().catch(console.error);
