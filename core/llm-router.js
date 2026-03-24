// ─── innovooClaw · core/llm-router.js ────────────────────────────────────────
// Zentraler LLM-Entscheidungspunkt: Ollama vs. Anthropic.
// Ersetzt alle verteilten if(_ollamaMode === ...) Konstrukte aus proxy.js.
'use strict';

const OLLAMA_URL   = process.env.OLLAMA_URL   || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b';

const ANTHROPIC_HAIKU  = 'claude-haiku-4-5-20251001';
const ANTHROPIC_SONNET = 'claude-sonnet-4-5-20251001';

// ── Entscheidungslogik ────────────────────────────────────────────────────────
// Gibt zurück welcher Provider + Model für diese Anfrage verwendet werden soll.
function decideLLM(userMessage, context = {}) {
  const len          = (userMessage || '').length;
  const hasTools     = context.toolsAvailable > 0;
  const agentKey     = (context.agent || 'otto').toLowerCase();
  const forceCloud   = context.forceCloud === true;
  const ollamaMode   = process.env.OLLAMA_MODE || 'hybrid'; // hybrid | off | only

  // Ollama deaktiviert → immer Claude
  if (ollamaMode === 'off' || forceCloud) {
    return _claude(len > 1200 ? ANTHROPIC_SONNET : ANTHROPIC_HAIKU, 'Ollama off / forceCloud');
  }

  // Ollama only → immer Ollama (kein Tool-Use möglich)
  if (ollamaMode === 'only') {
    return _ollama('ollama:only Modus');
  }

  // ── Hybrid-Modus (default) ────────────────────────────────────────────────
  // Tool-Use, Agents, lange Nachrichten → Claude
  if (hasTools || agentKey !== 'otto') {
    const model = len > 1200 ? ANTHROPIC_SONNET : ANTHROPIC_HAIKU;
    return _claude(model, hasTools ? 'Tool-Use benötigt' : `Spezialist-Agent ${agentKey}`);
  }

  // Tool-Keywords → Claude Haiku
  const TOOL_KEYWORDS = /kalender|termin|drive|gmail|pdf|konto|strom|shelly|browser|vvs|bahn|bus|schwimm|hrv|schlaf|wetter|solar|wechselrichter/i;
  if (TOOL_KEYWORDS.test(userMessage)) {
    return _claude(ANTHROPIC_HAIKU, 'Tool-Keyword erkannt');
  }

  // Lange Nachrichten → Claude Haiku (für Kontext)
  if (len > 300) {
    return _claude(ANTHROPIC_HAIKU, `Länge ${len} > 300`);
  }

  // Kurze, einfache Konversation → Ollama (kostenfrei, lokal)
  return _ollama('Kurze Nachricht ohne Tool-Hinweis');
}

function _claude(model, reason) {
  return { provider: 'anthropic', model, reason };
}
function _ollama(reason) {
  return { provider: 'ollama', model: OLLAMA_MODEL, reason };
}

// ── LLM aufrufen ──────────────────────────────────────────────────────────────
async function callLLM(provider, model, systemPrompt, messages, options = {}) {
  if (provider === 'ollama') {
    return _callOllama(model, systemPrompt, messages, options);
  }
  if (provider === 'anthropic') {
    return _callAnthropic(model, systemPrompt, messages, options);
  }
  throw new Error(`Unbekannter LLM-Provider: ${provider}`);
}

// ── Ollama ────────────────────────────────────────────────────────────────────
async function _callOllama(model, systemPrompt, messages, options = {}) {
  const ollamaMessages = [
    { role: 'system', content: systemPrompt || '' },
    ...messages.map(m => ({
      role:    m.role,
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    })),
  ];

  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages:   ollamaMessages,
      stream:     false,
      options:    { num_predict: options.maxTokens || 800, temperature: options.temperature ?? 0.7 },
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
  const data = await res.json();

  const text = data.message?.content || '';

  // Hybrid-Fallback-Signal: Ollama gibt "##TOOL_NEEDED##" zurück
  if (text.includes('##TOOL_NEEDED##')) {
    return { content: '', needsToolFallback: true, raw: data };
  }

  return { content: text, provider: 'ollama', model, raw: data };
}

// ── Anthropic ─────────────────────────────────────────────────────────────────
async function _callAnthropic(model, systemPrompt, messages, options = {}) {
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
  if (!ANTHROPIC_KEY) throw new Error('ANTHROPIC_API_KEY fehlt in .env');

  const body = {
    model,
    max_tokens: options.maxTokens || 1200,
    system:     systemPrompt || '',
    messages,
  };

  // Tool-Definitionen anhängen wenn vorhanden
  if (options.tools?.length) body.tools = options.tools;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Anthropic ${res.status}: ${err?.error?.message || JSON.stringify(err)}`);
  }

  const data = await res.json();

  // Tool-Use-Block extrahieren
  const toolUseBlocks = (data.content || []).filter(b => b.type === 'tool_use');
  const textContent   = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');

  return {
    content:      textContent,
    toolUseBlocks,
    stopReason:   data.stop_reason,
    provider:     'anthropic',
    model,
    raw:          data,
  };
}

// ── Streaming Proxy (für /v1/messages SSE-Durchleitung) ───────────────────────
async function streamToResponse(model, systemPrompt, messages, options, res) {
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
  if (!ANTHROPIC_KEY) { res.writeHead(500); res.end('ANTHROPIC_API_KEY fehlt'); return; }

  const body = JSON.stringify({
    model,
    max_tokens: options.maxTokens || 1000,
    system:     systemPrompt || '',
    messages,
    stream:     true,
    ...(options.tools?.length ? { tools: options.tools } : {}),
  });

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body,
  });

  if (!upstream.ok) {
    res.writeHead(upstream.status, { 'Content-Type': 'application/json' });
    const errBody = await upstream.text();
    res.end(errBody);
    return;
  }

  res.writeHead(200, {
    'Content-Type':  'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection':    'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  const reader = upstream.body.getReader();
  const dec    = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(dec.decode(value, { stream: true }));
    }
  } finally {
    res.end();
  }
}

module.exports = { decideLLM, callLLM, streamToResponse, ANTHROPIC_HAIKU, ANTHROPIC_SONNET };
