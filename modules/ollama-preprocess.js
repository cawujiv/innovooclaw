// ─── innovooClaw · modules/ollama-preprocess.js ──────────────────────────────
'use strict';

const THRESHOLD  = 200;
const MAX_OUTPUT = 2000;
const HARD_LIMIT = 8000;
const PREPROCESS_TOOLS = new Set(['driveRead', 'webFetch', 'browserFetch']);

const OLLAMA_URL   = process.env.OLLAMA_URL   || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b';

const stats = {
  total: 0, compressed: 0, skipped: 0, failed: 0, savedChars: 0,
  hybridAnswers: 0, hybridSavedChars: 0,
};

async function summarizeWithOllama(content, toolName) {
  const context = toolName === 'driveRead' ? 'Dokument aus Google Drive'
    : (toolName === 'webFetch' || toolName === 'browserFetch') ? 'Webseite' : 'Dateninhalt';
  const prompt = 'Fasse den folgenden ' + context + ' auf Deutsch zusammen. ' +
    'Behalte alle wichtigen Fakten, Zahlen, Namen und Handlungsempfehlungen. ' +
    'Maximal ' + MAX_OUTPUT + ' Zeichen. Antworte NUR mit der Zusammenfassung, kein Kommentar.\n\n' +
    content.slice(0, 30000);
  try {
    const res = await fetch(OLLAMA_URL + '/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false, options: { num_predict: 600 } }),
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.response || '').trim() || null;
  } catch (err) {
    if (!err.message?.includes('ECONNREFUSED') && !err.message?.includes('TimeoutError')) {
      console.warn('\x1b[33m⚠️  Ollama Preprocess Fehler:\x1b[0m', err.message);
    }
    return null;
  }
}

async function ollamaPreprocess(toolName, rawContent) {
  stats.total++;
  if (!PREPROCESS_TOOLS.has(toolName) || rawContent.length <= THRESHOLD) {
    stats.skipped++;
    return rawContent.slice(0, HARD_LIMIT);
  }
  const originalLen = rawContent.length;
  const summary = await summarizeWithOllama(rawContent, toolName);
  if (!summary) {
    stats.failed++;
    return rawContent.slice(0, HARD_LIMIT);
  }
  stats.compressed++;
  stats.savedChars += originalLen - summary.length;
  return '[📋 Ollama-Zusammenfassung von ' + originalLen + ' Zeichen]\n\n' + summary;
}

function getStats() {
  return { ...stats, compressionRate: stats.compressed > 0 ? Math.round((stats.savedChars / (stats.savedChars + stats.compressed * MAX_OUTPUT)) * 100) + '%' : '0%', ollamaModel: OLLAMA_MODEL, ollamaUrl: OLLAMA_URL, threshold: THRESHOLD, maxOutput: MAX_OUTPUT };
}

function trackHybridAnswer(userMessage, ollamaReply) {
  stats.hybridAnswers++;
  const estimatedSaved = Math.round((userMessage.length + 2000) * 0.25) * 4;
  stats.hybridSavedChars += estimatedSaved;
}

module.exports = { ollamaPreprocess, getStats, trackHybridAnswer, PREPROCESS_TOOLS, THRESHOLD };
