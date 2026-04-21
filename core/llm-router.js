// innovooClaw - core/llm-router.js
// Vereinfacht: Nur Anthropic Claude - kein Ollama.
'use strict';
const ANTHROPIC_HAIKU  = 'claude-haiku-4-5-20251001';
const ANTHROPIC_SONNET = 'claude-sonnet-4-5-20251001';

function decideLLM(userMessage, context = {}) {
  const len = (userMessage || '').length;
  const model = len > 1200 ? ANTHROPIC_SONNET : ANTHROPIC_HAIKU;
  return { provider: 'anthropic', model, reason: 'Claude only' };
}

async function callLLM(providerOrSys, modelOrMsgs, sysOrOpts, msgsOrUndef, optsOrUndef) {
  // Kompatibel mit alter Signatur (provider, model, sys, msgs, opts) und neuer (sys, msgs, opts)
  let systemPrompt, messages, options;
  if (typeof providerOrSys === 'string' && Array.isArray(msgsOrUndef)) {
    // Alte Signatur: (provider, model, systemPrompt, messages, options)
    systemPrompt = sysOrOpts;
    messages     = msgsOrUndef;
    options      = optsOrUndef || {};
  } else if (Array.isArray(modelOrMsgs)) {
    // Neue Signatur: (systemPrompt, messages, options)
    systemPrompt = providerOrSys;
    messages     = modelOrMsgs;
    options      = sysOrOpts || {};
  } else {
    systemPrompt = providerOrSys;
    messages     = modelOrMsgs;
    options      = sysOrOpts || {};
  }
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
  if (!ANTHROPIC_KEY) throw new Error('ANTHROPIC_API_KEY fehlt in .env');
  const { model } = decideLLM(messages[messages.length - 1]?.content || '', options);
  const body = {
    model,
    system: systemPrompt,
    messages,
    max_tokens: options.maxTokens || 1200,
  };
  if (options.tools?.length) { body.tools = options.tools; body.tool_choice = options.forceTool ? { type: 'any' } : { type: 'auto' }; }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error('Anthropic ' + res.status + ': ' + (data?.error?.message || JSON.stringify(data)));
  const textBlock     = data.content?.find(b => b.type === 'text');
  const toolUseBlocks = data.content?.filter(b => b.type === 'tool_use') || [];
  return {
    content:       textBlock?.text || '',
    toolUseBlocks,
    provider:      'anthropic',
    model,
    stopReason:    data.stop_reason,
    raw:           data,
  };
}

module.exports = { decideLLM, callLLM };
