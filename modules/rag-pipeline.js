/**
 * innovooClaw · modules/rag-pipeline.js  v1.1
 */
'use strict';

const KB_LIMIT      = 5;
const MEM_LIMIT     = 3;
const MIN_SCORE     = 0.28;
const MAX_CTX_CHARS = 2400;

const PERSONAL_SIGNALS = [
  /\b(mein|meine|meinem|meinen|meiner|unser|unsere|mir|ich)\b/i,
  /\b(dokument|datei|rechnung|vertrag|angebot|notiz|projekt|bericht)\b/i,
  /\b(drive|ordner|google\s*drive)\b/i,
  /\b(gestern|letzte\s*woche|letzten\s*monat|vorhin|früher|damals)\b/i,
  /\b(kosten|preis|betrag|euro|eur|budget|ausgabe|investition)\b/i,
  /\b(solar|pv|photovoltaik|shelly|strom|kunden|kunde|kontakt)\b/i,
  /\b(erinner|gemerkt|gespeichert|notiert|weißt\s*du\s*noch|kennst\s*du)\b/i,
  /\b(my|our|remember|document|file|invoice|contract|project)\b/i,
  /\b(ezhi|aps|apssystems|wechselrichter|balkonkraftwerk|mikro)\b/i,
  /\b(wallbox|pumpe|lüftung|heizung|anlage|gerät|module|panel)\b/i,
];

const WEB_ONLY_SIGNALS = [
  /\b(news|nachrichten|wetter|börse|dax|aktie|bundesliga|sport|politik)\b/i,
  /^(erkl[äa]r\s+mir|was\s+bedeutet|wie\s+funktioniert\s+(?!mein|meine))\b/i,
];

function shouldRetrieve(message, agentKey) {
  if (agentKey !== 'react' && agentKey !== 'otto') return false;
  for (const rx of WEB_ONLY_SIGNALS) { if (rx.test(message)) return false; }
  for (const rx of PERSONAL_SIGNALS)  { if (rx.test(message)) return true;  }
  if (agentKey === 'otto'  && message.trim().split(' ').length <= 8) return true;
  if (agentKey === 'react') return true;
  return false;
}

async function retrieve(userMessage, agentKey = 'react') {
  if (!userMessage || !shouldRetrieve(userMessage, agentKey)) return null;
  let memVec;
  try { memVec = require('./memory-vector'); if (!memVec.status().ready) return null; }
  catch(e) { return null; }
  try {
    const [kbHits, memHits] = await Promise.all([
      memVec.kbSearch(userMessage, KB_LIMIT).catch(() => []),
      memVec.recall(userMessage, null, MEM_LIMIT).catch(() => []),
    ]);
    const relevantKB  = kbHits.filter(h => (h.score || 0) >= MIN_SCORE);
    const relevantMem = memHits.filter(h => (h.score || 0) >= MIN_SCORE && h.layer === 'semantic');
    if (!relevantKB.length && !relevantMem.length) return null;
    const lines = [];
    if (relevantKB.length) {
      lines.push('\n\n[WISSENSBASIS – relevante Dokumente aus Drive/Memory]');
      for (const hit of relevantKB) {
        const src   = hit.source ? hit.source.split(':').slice(2).join(' › ') : 'Drive';
        const score = hit.score != null ? ` (${Math.round(hit.score * 100)}%)` : '';
        lines.push(`• ${src}${score}:\n  ${hit.text.slice(0, 380).replace(/\n/g, ' ')}`);
      }
    }
    if (relevantMem.length) {
      lines.push('\n[GEDÄCHTNIS – gespeicherte Fakten]');
      for (const hit of relevantMem) lines.push(`• ${hit.text.slice(0, 200).replace(/\n/g, ' ')}`);
    }
    const ctx = lines.join('\n').slice(0, MAX_CTX_CHARS);
    if (!ctx.trim()) return null;
    console.log(`\x1b[36m▶ RAG\x1b[0m  ${agentKey.toUpperCase()}: ${relevantKB.length} KB + ${relevantMem.length} Mem Treffer`);
    return ctx;
  } catch(e) { console.warn('[RAG] retrieve Fehler:', e.message); return null; }
}

async function retrieveMulti(queries, agentKey = 'react') {
  if (!queries?.length) return null;
  let memVec;
  try { memVec = require('./memory-vector'); if (!memVec.status().ready) return null; }
  catch(e) { return null; }
  try {
    const hits = await memVec.recallMulti(queries, null, 3).catch(() => []);
    const relevant = hits.filter(h => (h.score || 0) >= MIN_SCORE);
    if (!relevant.length) return null;
    const lines = ['\n\n[WISSENSBASIS – relevante Treffer]'];
    for (const hit of relevant) {
      const src = hit.source ? hit.source.split(':').slice(2).join(' › ') : '';
      lines.push(`• ${src ? src + ': ' : ''}${hit.text.slice(0, 300).replace(/\n/g, ' ')}`);
    }
    return lines.join('\n').slice(0, MAX_CTX_CHARS);
  } catch(e) { return null; }
}

module.exports = { retrieve, retrieveMulti, shouldRetrieve };
