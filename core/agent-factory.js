// ─── innovooClaw · core/agent-factory.js ─────────────────────────────────────
// Lädt alle Agents dynamisch aus /skills/*.md + data/agent-registry.js.
// Stellt eine einheitliche agent.handle(message, context) Schnittstelle bereit.
'use strict';

const fs   = require('fs');
const path = require('path');

const { TOOL_DEFINITIONS, getToolsForAgent } = require('../modules/tool-definitions');
const { executeTool }  = require('../modules/tool-executor');
const { retrieve }     = require('../modules/rag-pipeline');
const { AgentRegistry } = require('../data/agent-registry');

let _agents = null;  // Map<agentId, AgentDef>
let _toolOverrides = {};  // { agentId: string[] } – geladen aus memory/tool-overrides.json

// ── Tool-Override Helpers ─────────────────────────────────────────────────────
function _loadToolOverrides() {
  try {
    const p = path.join(process.env.MEMORY_DIR || path.join(__dirname, '..', 'memory'), 'tool-overrides.json');
    if (fs.existsSync(p)) _toolOverrides = JSON.parse(fs.readFileSync(p, 'utf8')).overrides || {};
  } catch(_) { _toolOverrides = {}; }
}
_loadToolOverrides();

function saveToolOverrides() {
  try {
    const p = path.join(process.env.MEMORY_DIR || path.join(__dirname, '..', 'memory'), 'tool-overrides.json');
    fs.writeFileSync(p, JSON.stringify({ _info: 'Tool-Overrides – live via UI editierbar', _updatedAt: new Date().toISOString(), overrides: _toolOverrides }, null, 2));
  } catch(e) { console.error('[AgentFactory] saveToolOverrides:', e.message); }
}

function setToolOverride(agentId, tools) {
  _toolOverrides[agentId.toLowerCase()] = tools;
  saveToolOverrides();
  reload(agentId);
  console.log(`\x1b[33m⟳ Tool-Override\x1b[0m  ${agentId.toUpperCase()} → [${tools.join(', ')}]`);
}

function getEffectiveTools(agentId, registryTools) {
  const id = agentId.toLowerCase();
  return _toolOverrides[id] !== undefined ? _toolOverrides[id] : registryTools;
}

// ── Initialisierung ───────────────────────────────────────────────────────────
function loadAll() {
  if (_agents) return _agents;
  _agents = new Map();

  const SkillLoader = require('../modules/skill-loader');
  const skills      = SkillLoader.loadAllSync();

  for (const agentId of AgentRegistry.ids()) {
    const regDef  = AgentRegistry.get(agentId);
    const skill   = skills?.[agentId] || null;
    const meta    = skill?.meta   || { agent: agentId, name: agentId.toUpperCase() };
    const prompt  = skill?.prompt || _fallbackPrompt(agentId);

    const effectiveTools = getEffectiveTools(agentId, regDef?.tools || []);
    _agents.set(agentId, {
      id:          agentId,
      name:        meta.name        || agentId.toUpperCase(),
      systemPrompt: prompt,
      meta,
      tools:       effectiveTools,
      dangerousTools: regDef?.dangerousTools || [],
      handle:      _buildHandler(agentId, prompt, effectiveTools),
    });

    console.log(`\x1b[36m▶ AgentFactory\x1b[0m  ${agentId.toUpperCase()} geladen (${regDef?.tools?.length || 0} Tools)`);
  }

  console.log(`\x1b[32m✅ AgentFactory\x1b[0m  ${_agents.size} Agents bereit: ${[..._agents.keys()].join(', ')}`);
  return _agents;
}

// ── Agent per ID abrufen ──────────────────────────────────────────────────────
function get(agentId) {
  if (!_agents) loadAll();
  return _agents.get(agentId.toLowerCase()) || null;
}

function list() {
  if (!_agents) loadAll();
  return [..._agents.keys()];
}

// ── Handler-Builder ───────────────────────────────────────────────────────────
// Erzeugt die handle(message, context) Funktion für jeden Agent.
// Führt den Tool-Use-Loop (max. MAX_ROUNDS Runden) durch.
function _buildHandler(agentId, basePrompt, allowedTools) {
  const MAX_ROUNDS = 5;

  return async function handle(userMessage, context = {}) {
    const { callLLM, memory, llm, extraContext } = context;

    // ── RAG: Wissensbasis-Kontext anhängen ────────────────────────────────
    let ragContext = '';
    try {
      const rag = await retrieve(userMessage, agentId);
      if (rag) ragContext = rag;
    } catch(_) {}

    // ── System-Prompt aufbauen ────────────────────────────────────────────
    let systemPrompt = basePrompt;
    if (extraContext) systemPrompt += `\n\n── KONTEXT ──\n${extraContext}`;
    if (ragContext)   systemPrompt += ragContext;

    // ── Tool-Definitionen für diesen Agent ────────────────────────────────
    const tools = getToolsForAgent(allowedTools);

    // ── Initialen LLM-Call ────────────────────────────────────────────────
    const history = [...(context.history || [])];
    history.push({ role: 'user', content: userMessage });

    let fullReply = '';
    let toolRounds = 0;

    while (toolRounds < MAX_ROUNDS) {
      const result = await callLLM(
        systemPrompt,
        history,
        { tools: tools.length ? tools : undefined, maxTokens: context.maxTokens || 1200 }
      );

      // Text sammeln
      if (result.content) fullReply += result.content;

      // Kein Tool-Use → fertig
      if (!result.toolUseBlocks?.length) break;
      if (result.stopReason !== 'tool_use') break;

      // ── Tool-Use-Loop ─────────────────────────────────────────────────
      toolRounds++;
      const toolResultBlocks = [];

      for (const tu of result.toolUseBlocks) {
        const toolName  = tu.name;
        const toolInput = tu.input || {};

        console.log(`\x1b[35m⚙ Tool\x1b[0m  ${agentId.toUpperCase()} → ${toolName}(${JSON.stringify(toolInput).slice(0, 80)})`);

        let toolResult;
        try {
          toolResult = await executeTool(toolName, toolInput, agentId);
        } catch(e) {
          toolResult = `Tool-Fehler (${toolName}): ${e.message}`;
        }

        // Vision-Ergebnis (Screenshot) behandeln
        if (toolResult?.__visionResult) {
          toolResultBlocks.push({
            type:       'tool_result',
            tool_use_id: tu.id,
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: toolResult.imageB64 } },
              { type: 'text', text: toolResult.text || '' },
            ],
          });
        } else {
          const resultText = typeof toolResult === 'string'
            ? toolResult
            : JSON.stringify(toolResult, null, 2).slice(0, 4000);

          // Olama-Preprocess für große Inhalte
          let processedResult = resultText;
          if (resultText.length > 2000) {
            try {
              const { ollamaPreprocess } = require('../modules/ollama-preprocess');
              processedResult = await ollamaPreprocess(toolName, resultText);
            } catch(_) {}
          }

          toolResultBlocks.push({
            type:        'tool_result',
            tool_use_id: tu.id,
            content:     processedResult,
          });
        }
      }

      // History für nächste Runde
      history.push({ role: 'assistant', content: result.raw?.content || [] });
      history.push({ role: 'user',      content: toolResultBlocks });
    }

    // ── Memory: Fakt-Extraktion async (non-blocking) ──────────────────────
    if (memory?.store && fullReply.length > 30) {
      setImmediate(async () => {
        try {
          await memory.store(
            `[${agentId.toUpperCase()}] User: ${userMessage.slice(0, 150)}\nAntwort: ${fullReply.slice(0, 300)}`,
            { agent: agentId, layer: 'episodic', category: 'dialog' }
          );
        } catch(_) {}
      });
    }

    return {
      ok:     true,
      reply:  fullReply || '(keine Antwort)',
      agent:  agentId,
      rounds: toolRounds,
    };
  };
}

// ── Fallback-Prompt (wenn keine .md-Datei) ────────────────────────────────────
function _fallbackPrompt(agentId) {
  try {
    const { agentPromptBase } = require('../data/agent-prompts');
    return agentPromptBase[agentId] || `Du bist ${agentId.toUpperCase()}, ein hilfreicher KI-Agent. Antworte auf Deutsch.`;
  } catch(_) {
    return `Du bist ${agentId.toUpperCase()}, ein hilfreicher KI-Agent. Antworte auf Deutsch.`;
  }
}

// ── Hot-Reload einzelner Agent ────────────────────────────────────────────────
function reload(agentId) {
  if (_agents) _agents.delete(agentId.toLowerCase());
  const SkillLoader = require('../modules/skill-loader');
  const skills      = SkillLoader.loadAllSync();
  const regDef      = AgentRegistry.get(agentId);
  const skill       = skills?.[agentId] || null;
  const meta        = skill?.meta   || {};
  const prompt      = skill?.prompt || _fallbackPrompt(agentId);
  if (!_agents) _agents = new Map();
  _loadToolOverrides();
  const effectiveToolsR = getEffectiveTools(agentId, regDef?.tools || []);
  _agents.set(agentId.toLowerCase(), {
    id: agentId, name: meta.name || agentId.toUpperCase(),
    systemPrompt: prompt, meta,
    tools:        effectiveToolsR,
    dangerousTools: regDef?.dangerousTools || [],
    handle: _buildHandler(agentId, prompt, effectiveToolsR),
  });
  console.log(`\x1b[36m⟳ AgentFactory\x1b[0m  ${agentId.toUpperCase()} neu geladen`);
}

module.exports = { loadAll, get, list, reload, setToolOverride, getEffectiveTools, getToolOverrides: () => _toolOverrides };
