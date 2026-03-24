// ─── innovooClaw · modules/agent-api.js ────────────────────────────────────
// Agent-Logik, Delegations-Engine, Live-Daten, Drive-Integration
// 1:1 übernommen aus OpenClaw – läuft im Browser, nutzt http://localhost:3000
// ─────────────────────────────────────────────────────────────────────────────

// ─── API-FETCH WRAPPER ───────────────────────────────────────────────────────
// Fügt automatisch x-api-key Header hinzu wenn window.INNOVOO_API_KEY gesetzt.
function _apiFetch(url, opts) {
  opts = opts || {};
  const key = (typeof window !== 'undefined' && window.INNOVOO_API_KEY) || '';
  if (key) {
    opts.headers = Object.assign({}, opts.headers, { 'x-api-key': key });
  }
  return fetch(url, opts);
}

// ─── SKILL STORE ─────────────────────────────────────────────────────────────
// Skills werden aus /skills/*.md geladen.
// Fallback: agentPromptBase aus data/agent-prompts.js

let _loadedSkills = null;

async function initSkills() {
  try {
    if (typeof SkillLoader === 'undefined') {
      await new Promise((resolve) => {
        const s = document.createElement('script');
        s.src = '/modules/skill-loader.js';
        s.onload = resolve;
        s.onerror = () => { console.warn('[Skills] skill-loader.js nicht geladen'); resolve(); };
        document.head.appendChild(s);
      });
    }
    if (typeof SkillLoader !== 'undefined') {
      const skills = await SkillLoader.loadAll();
      if (skills && Object.keys(skills).length > 0) {
        _loadedSkills = skills;
        const summary = SkillLoader.getSkillSummary(skills).map(s => `${s.name} v${s.version}`).join(', ');
        console.log('%c[Skills] Geladen: ' + summary, 'color:#6ee7b7;font-weight:bold');
        return true;
      }
    }
  } catch(e) {
    console.warn('[Skills] Fallback zu agent-prompts.js:', e.message);
  }
  return false;
}

function getSkillPrompt(agent) {
  if (_loadedSkills?.[agent]) return _loadedSkills[agent].prompt;
  if (typeof agentPromptBase !== 'undefined') return agentPromptBase[agent] || '';
  return `Du bist ${agent.toUpperCase()}, ein KI-Assistent.`;
}

function getSkillMeta(agent) {
  return _loadedSkills?.[agent]?.meta || {};
}

// ─── AGENT STATE ─────────────────────────────────────────────────────────────
let activeChannel = 'leben';
const agentSystemPrompts = {};
const channelConfig = {};

function getActiveAgent() {
  return channelConfig[activeChannel]?.agent
    || Object.values(channelConfig).find(c => c.agent === 'otto')?.agent
    || Object.values(channelConfig)[0]?.agent
    || 'otto';
}

const chatHistories = {};

function initSkillState(skills) {
  if (!skills) return;
  const PALETTE = ['#6ee7b7','#fbbf24','#f472b6','#a78bfa','#fb923c','#38bdf8','#4ade80','#f87171'];
  const entries = Object.entries(skills).filter(([, s]) => s.meta?.agent && s.meta?.channel);
  entries.sort(([, a], [, b]) => {
    if (a.meta?.role === 'orchestrator') return -1;
    if (b.meta?.role === 'orchestrator') return 1;
    return 0;
  });
  entries.forEach(([key, skill], i) => {
    const meta = skill.meta;
    const ch   = meta.channel || key;
    const hex  = (meta.color || PALETTE[i % PALETTE.length]).replace(/['"]/g, '');
    channelConfig[ch] = {
      agent: key, label: meta.name || key.toUpperCase(),
      icon:  meta.icon || '🤖', color: hex, title: `# ${ch}`,
      desc:  (meta.description || '').split('–')[1]?.trim().split(',')[0]?.trim() || meta.description || '',
    };
    if (!chatHistories[ch]) chatHistories[ch] = [];
    if (!(key in agentSystemPrompts)) agentSystemPrompts[key] = '';
  });
  const firstOrch = entries.find(([, s]) => s.meta?.role === 'orchestrator');
  if (firstOrch && !channelConfig[activeChannel]) {
    activeChannel = firstOrch[1].meta.channel || firstOrch[0];
  }
  console.log('[initSkillState] Channels:', Object.keys(channelConfig).join(', '));
}

// ─── DIALOG HISTORY ──────────────────────────────────────────────────────────

async function saveDialogHistory(agent, user, reply) {
  try {
    await _apiFetch('http://localhost:3000/api/dialog/save', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent, user: user.slice(0, 300), reply: reply.slice(0, 800) })
    });
  } catch(e) { console.warn('[DialogHistory] Save fehlgeschlagen:', e.message); }
}

const _dlgState = {};

function _dlgBuildMessage(dialog, agent) {
  const _meta = (typeof agentMeta !== 'undefined') ? (agentMeta[agent] || {}) : {};
  const _cfg  = (typeof channelConfig !== 'undefined')
    ? (Object.values(channelConfig).find(c => c.agent === agent) || {}) : {};
  const color = _meta.color || _cfg.color || '#888';
  const ts    = dialog.ts ? new Date(dialog.ts) : null;
  const time  = ts ? ts.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '--:--';
  const date  = ts ? ts.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) : '';
  const label = date ? date + ' ' + time : time;

  const userDiv = document.createElement('div');
  userDiv.className = 'msg visible history-entry'; userDiv.style.cssText = 'opacity:0.65;';
  userDiv.innerHTML = '<div class="msg-avatar avatar-user" style="opacity:0.5">&#128100;</div><div class="msg-content"><div class="msg-header"><span class="msg-name" style="color:#7a88aa">Du</span><span class="msg-time">' + label + '</span></div><div class="msg-text" style="color:#9090b0">' + (dialog.user || '').replace(/</g, '&lt;') + '</div></div>';

  const agentIcon  = _meta.icon  || _cfg.icon  || '🤖';
  const agentLabel = _meta.name  || _cfg.label || agent.toUpperCase();
  const agentCls   = _meta.cls   || 'avatar-a';

  const agentDiv = document.createElement('div');
  agentDiv.className = 'msg visible history-entry'; agentDiv.style.cssText = 'opacity:0.65;';
  agentDiv.innerHTML = '<div class="msg-avatar ' + agentCls + '" style="opacity:0.5">' + agentIcon + '</div><div class="msg-content"><div class="msg-header"><span class="msg-name" style="color:' + color + 'aa">' + agentLabel + '</span><span class="msg-time">' + label + '</span></div><div class="msg-text" style="color:#9090b0">' + (dialog.reply || '').replace(/</g, '&lt;').replace(/\n/g, '<br>').slice(0, 500) + '</div></div>';

  return [userDiv, agentDiv];
}

async function _dlgLoadMore(agent, container, sentinel) {
  const state = _dlgState[agent];
  if (!state || state.loading || !state.hasMore) return;
  state.loading = true; sentinel.textContent = '… lade ältere Chats';
  try {
    const r = await _apiFetch('http://localhost:3000/api/dialog/history?agent=' + agent + '&limit=5&offset=' + state.offset);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    if (!data.dialogs || !data.dialogs.length) { state.hasMore = false; sentinel.textContent = '── Beginn der Chathistorie ──'; return; }
    const prevScrollHeight = container.scrollHeight, prevScrollTop = container.scrollTop;
    const batch = [...data.dialogs].reverse();
    let insertAfter = sentinel;
    for (const dialog of batch) {
      const [uDiv, aDiv] = _dlgBuildMessage(dialog, agent);
      insertAfter.insertAdjacentElement('afterend', uDiv); uDiv.insertAdjacentElement('afterend', aDiv); insertAfter = aDiv;
    }
    container.scrollTop = prevScrollTop + (container.scrollHeight - prevScrollHeight);
    state.offset += data.dialogs.length; state.hasMore = data.hasMore;
    sentinel.textContent = state.hasMore ? '↑ nach oben scrollen für ältere Chats' : '── Beginn der Chathistorie ──';
  } catch(e) { sentinel.textContent = '⚠ Ladefehler'; console.warn('[DialogHistory]', e.message); }
  finally { state.loading = false; }
}

async function loadDialogHistory(channel) {
  const cfg = channelConfig[channel]; const agent = cfg ? cfg.agent : 'otto';
  const container = document.getElementById('chat-messages'); if (!container) return;
  container.querySelectorAll('.history-entry, .history-sep, .history-sep-new, .history-sentinel').forEach(el => el.remove());
  if (container._histScroll) { container.removeEventListener('scroll', container._histScroll); delete container._histScroll; }
  try {
    const r = await _apiFetch('http://localhost:3000/api/dialog/history?agent=' + agent + '&limit=5&offset=0');
    if (!r.ok) return;
    const data = await r.json();
    _dlgState[agent] = { offset: data.dialogs ? data.dialogs.length : 0, hasMore: data.hasMore, loading: false };
    const sentinel = document.createElement('div');
    sentinel.className = 'history-sentinel';
    sentinel.style.cssText = "text-align:center;padding:8px 0 4px;font-family:'Space Mono',monospace;font-size:0.5rem;color:#252540;user-select:none;cursor:default;";
    sentinel.textContent = data.hasMore ? '↑ nach oben scrollen für ältere Chats' : '── Beginn der Chathistorie ──';
    container.insertBefore(sentinel, container.firstChild);
    if (data.dialogs && data.dialogs.length > 0) {
      const dialogs = [...data.dialogs].reverse();
      let insertAfter = sentinel;
      for (let i = 0; i < dialogs.length; i++) {
        const pair = _dlgBuildMessage(dialogs[i], agent);
        insertAfter.insertAdjacentElement('afterend', pair[0]); pair[0].insertAdjacentElement('afterend', pair[1]); insertAfter = pair[1];
      }
      const COLORS = { otto: '#ff6b2b', mina: '#00e5a0', vera: '#6b8aff' };
      const sepNew = document.createElement('div');
      sepNew.className = 'history-sep-new';
      sepNew.style.cssText = "text-align:center;padding:6px 0;font-family:'Space Mono',monospace;font-size:0.5rem;color:" + (COLORS[agent]||'#888') + "40;border-top:1px dashed #181825;border-bottom:1px solid #181825;margin:4px 0 8px;user-select:none;";
      sepNew.textContent = '── neue Session ──';
      insertAfter.insertAdjacentElement('afterend', sepNew);
    }
    setTimeout(() => { container.scrollTop = container.scrollHeight; }, 80);
    if (data.hasMore) {
      const onScroll = function() { if (container.scrollTop < 100 && !_dlgState[agent].loading) _dlgLoadMore(agent, container, sentinel); };
      container._histScroll = onScroll; container.addEventListener('scroll', onScroll);
    }
  } catch(e) { console.warn('[DialogHistory]', e.message); }
}

// ─── VEKTOR-REFLEXION ────────────────────────────────────────────────────────

const _reflectorSeen = new Set();

async function recallForAgent(query, agent, limit = 5) {
  try {
    const r = await _apiFetch(`http://localhost:3000/api/memory/search?q=${encodeURIComponent(query)}&agent=${agent}&limit=${limit}`);
    if (!r.ok) return []; const d = await r.json(); return d.hits || [];
  } catch(e) { return []; }
}

async function reflectAndStore(agent, userMsg, assistantReply) {
  try {
    if (assistantReply.length < 30) return;
    if (userMsg.startsWith('[A2A') || userMsg.startsWith('[TOOL')) return;
    const dedupKey = agent + ':' + assistantReply.slice(0, 80);
    if (_reflectorSeen.has(dedupKey)) return;
    if (_reflectorSeen.size > 200) _reflectorSeen.clear();
    _reflectorSeen.add(dedupKey);
    const response = await _apiFetch('http://localhost:3000/v1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 300,
        messages: [{ role: 'user', content: `Analysiere diesen Dialog und extrahiere die wichtigsten Fakten.\nNur JSON-Array, kein Text drumherum.\n[{"fakt":"...","kategorie":"..."}]\n\nNutzer: ${userMsg.slice(0,300)}\nAgent: ${assistantReply.slice(0,500)}` }] })
    });
    if (!response.ok) return;
    const data = await response.json();
    let facts = [];
    try { facts = JSON.parse((data.content?.[0]?.text || '[]').replace(/```json|```/g,'').trim()); } catch(_) { return; }
    if (!Array.isArray(facts)) return;
    for (const entry of facts) {
      if (!entry?.fakt) continue;
      saveFact('reflector_' + (entry.kategorie || 'allgemein'), Date.now().toString(36), entry.fakt.slice(0, 200));
      try { await _apiFetch('http://localhost:3000/api/memory/vector', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ text: entry.fakt, agent, layer: 'episodic', category: entry.kategorie || 'allgemein' }) }); } catch(_) {}
      try { window.dispatchEvent(new CustomEvent('oc:fact-learned', { detail: { fakt: entry.fakt, kategorie: entry.kategorie, agent, ts: new Date().toISOString() } })); } catch(_) {}
    }
  } catch(e) { console.warn('[Reflector] Fehler:', e.message); }
}

// ─── DELEGATION ──────────────────────────────────────────────────────────────

function detectDelegation(text, currentAgent) {
  const rules = (typeof routingRules !== 'undefined' ? routingRules : [])
    .filter(r => r.fromAgent === currentAgent).sort((a, b) => (a.priority||10)-(b.priority||10));
  for (const rule of rules) { if (rule.pattern.test(text)) return { target: rule.target, reason: rule.reason }; }
  return null;
}

const a2aBroadcast = [];

function broadcastA2A(fromAgent, toAgent, message) {
  const entry = { from: fromAgent, to: toAgent, msg: message, ts: new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}) };
  a2aBroadcast.push(entry); if (a2aBroadcast.length > 20) a2aBroadcast.shift();
  if (typeof renderA2ABroadcast === 'function') renderA2ABroadcast(a2aBroadcast);
}

function showDelegationNotice(fromChannel, toChannel, reason) {
  const fromCfg = channelConfig[fromChannel]; const toCfg = channelConfig[toChannel];
  if (!fromCfg || !toCfg) return;
  broadcastA2A(fromCfg.agent, toCfg.agent, reason);
  if (typeof addDelegationMessage === 'function') addDelegationMessage(fromChannel, toChannel, reason);
}

// ─── AGENT API ───────────────────────────────────────────────────────────────

async function callAgentAPI(channel, userMessage, onToken = null) {
  const cfg = channelConfig[channel]; const agent = cfg?.agent || 'otto';  
  const history = chatHistories[channel] || chatHistories.leben || [];
  const isToolResult = userMessage.startsWith('[TOOL-ERGEBNIS]');

  if (!isToolResult && !onToken) {
    const historyForRest = history.filter(m => typeof m.content === 'string').slice(-10);
    const response = await _apiFetch(`http://localhost:3000/api/agent/${agent}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userMessage, history: historyForRest, maxTokens: 1200 }),
    });
    if (!response.ok) { const err = await response.json().catch(()=>({})); throw new Error(err?.error || `HTTP ${response.status}`); }
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || 'Agent-Fehler');
    const assistantText = data.reply || '(keine Antwort)';
    history.push({ role: 'user', content: userMessage }); history.push({ role: 'assistant', content: assistantText });
    if (history.length > 20) history.splice(0, history.length - 20);
    return assistantText;
  }

  history.push({ role: 'user', content: userMessage }); if (history.length > 20) history.splice(0, history.length - 20);
  const systemPrompt = agentSystemPrompts[agent] || (typeof agentPromptBase !== 'undefined' ? agentPromptBase[agent] : '') || '';
  const body = { model: 'claude-haiku-4-5-20251001', max_tokens: 1000, system: systemPrompt, messages: history.slice(), stream: !!onToken };
  const response = await _apiFetch('http://localhost:3000/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) { const err = await response.json().catch(()=>({})); throw new Error(err?.error?.message || `HTTP ${response.status}`); }

  if (onToken && response.headers.get('content-type')?.includes('event-stream')) {
    const reader = response.body.getReader(); const decoder = new TextDecoder();
    let fullText = '', buffer = '';
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n'); buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim(); if (data === '[DONE]') continue;
        try { const evt = JSON.parse(data); if (evt.type==='content_block_delta'&&evt.delta?.type==='text_delta') { fullText += evt.delta.text; onToken(fullText); } } catch(_) {}
      }
    }
    if (!fullText) fullText = '(keine Antwort)';
    history.push({ role: 'assistant', content: fullText }); return fullText;
  }

  const data = await response.json();
  const assistantText = data.content?.[0]?.text || '(keine Antwort)';
  history.push({ role: 'assistant', content: assistantText }); return assistantText;
}

// ─── INPUT HELPERS ────────────────────────────────────────────────────────────

function autoResize(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px'; }
function handleInputKey(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendUserMsg(); } }
function toggleExpand() {
  const input = document.getElementById('user-input'), btn = document.getElementById('expand-btn'), hint = document.getElementById('expand-hint');
  if (!input) return;
  const isExpanded = input.classList.toggle('expanded');
  input.style.height = isExpanded ? '180px' : 'auto'; input.style.maxHeight = isExpanded ? '180px' : '80px';
  if (hint) hint.style.display = isExpanded ? 'block' : 'none';
  if (btn) btn.title = isExpanded ? 'Verkleinern' : 'Prompt-Fenster vergrößern';
}

// ─── SEND MESSAGE ─────────────────────────────────────────────────────────────

async function sendUserMsg() {
  const input = document.getElementById('user-input'), container = document.getElementById('chat-messages');
  if (!input || !container) return;
  const text = input.value.trim(); if (!text) return;
  input.value = ''; input.style.height = 'auto';

  const prefixMatch = text.match(/^@?(VERA|MINA|OTTO|LEO|SAM|CLEO|SHELLYEM|REACT)\s*:\s*/i);
  let resolvedChannel = activeChannel || 'leben', cleanText = text;
  if (prefixMatch) {
    const prefixAgent = prefixMatch[1].toLowerCase();
    const targetChannel = Object.entries(channelConfig).find(([, v]) => v.agent === prefixAgent)?.[0];
    if (targetChannel && targetChannel !== resolvedChannel) { switchChannel(targetChannel); resolvedChannel = targetChannel; }
    cleanText = text.slice(prefixMatch[0].length).trim();
  }

  const channel = resolvedChannel, cfg = channelConfig[channel], agent = cfg?.agent || 'otto';
  const time = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  const userDiv = document.createElement('div'); userDiv.className = 'msg';
  userDiv.innerHTML = `<div class="msg-avatar avatar-user">👤</div><div class="msg-content"><div class="msg-header"><span class="msg-name" style="color:#8899cc">Du</span><span class="msg-time">${time}</span></div><div class="msg-text">${text.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div></div>`;
  container.appendChild(userDiv); setTimeout(() => userDiv.classList.add('visible'), 30); container.scrollTop = container.scrollHeight;

  const autoRoute = detectDelegation(cleanText, agent);
  if (autoRoute && autoRoute.target !== channel) {
    const routeBanner = document.createElement('div');
    routeBanner.style.cssText = `text-align:center;padding:5px 0;font-family:'Space Mono',monospace;font-size:0.58rem;color:${channelConfig[autoRoute.target]?.color||'#aaa'};border-top:1px solid #1e1e2e;margin:4px 0;`;
    routeBanner.textContent = `⟳ Auto-Route: ${autoRoute.reason}`;
    container.appendChild(routeBanner); switchChannel(autoRoute.target); resolvedChannel = autoRoute.target;
  }

  const finalChannel = resolvedChannel, finalCfg = channelConfig[finalChannel], finalAgent = finalCfg?.agent || agent;

  if (finalChannel === 'react') { await runReActLoop(finalChannel, cleanText, container); return; }

  const typingEl = showTyping(container, finalAgent);
  try {
    const currentReply = await callAgentAPI(finalChannel, cleanText);
    typingEl.remove();
    const replyTime = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    appendMsg(container, finalAgent, currentReply, replyTime);
    saveEpisode(finalAgent.toUpperCase(), cleanText.slice(0, 60), 'user-msg');
    if (typeof updateDataStatusUI === 'function') updateDataStatusUI();
    saveDialogHistory(finalAgent, cleanText, currentReply);
    reflectAndStore(finalAgent, cleanText, currentReply);
    await executeA2ADelegation(currentReply, finalChannel, container);
  } catch (err) {
    typingEl.remove();
    const errDiv = document.createElement('div'); errDiv.className = 'msg visible';
    errDiv.innerHTML = `<div style="padding:8px 12px;color:#ff6b6b;font-family:'Space Mono',monospace;font-size:0.7rem">⚠️ API-Fehler: ${err.message}</div>`;
    container.appendChild(errDiv); container.scrollTop = container.scrollHeight; console.error('[sendUserMsg]', err);
  }
}

// ─── A2A DELEGATION ───────────────────────────────────────────────────────────

async function executeA2ADelegation(replyText, fromChannel, container, depth = 0) {
  const knownLabels = [...new Set(Object.values(channelConfig).filter(c=>c.agent!=='react').map(c=>c.label.toUpperCase()))].join('|');
  if (!knownLabels) return false;
  const delegPattern = new RegExp(`@(${knownLabels})\\s*[:{]\\s*([\\s\\S]{3,800}?)(?=\\n@[A-Z]|$)`, 'gi');
  const matches = [...replyText.matchAll(delegPattern)];
  if (!matches.length) return false;

  const fromCfg = channelConfig[fromChannel], fromAgent = fromCfg?.agent || 'otto';
  const synthResults = [];

  for (const match of matches) {
    const toAgentName = match[1].toUpperCase(), task = match[2].trim();
    if (/ESCALATION/i.test(task)) {
      let esc = {}; try { esc = JSON.parse(task.match(/\{[\s\S]+\}/)?.[0]||'{}'); } catch(_) {}
      const from2 = esc.from||toAgentName, reason = esc.reason||task.slice(0,120);
      const note = document.createElement('div'); note.className = 'msg visible';
      note.innerHTML = '<div style="margin:4px 0 4px 44px;padding:8px 12px;border-radius:7px;background:rgba(251,146,60,0.08);border-left:2px solid #fb923c;font-family:\'Space Mono\',monospace;font-size:0.67rem;color:#fb923c;">⚠️ ESCALATION von '+from2+': '+reason.slice(0,200)+'</div>';
      container.appendChild(note); container.scrollTop = container.scrollHeight;
      synthResults.push(`${from2} (ESCALATION): ${reason}`); continue;
    }
    const toChannel = Object.entries(channelConfig).find(([,v])=>v.agent===toAgentName.toLowerCase())?.[0];
    if (!toChannel) { console.warn(`[A2A] Unbekannter Agent: ${toAgentName}`); continue; }
    const toCfg = channelConfig[toChannel];
    broadcastA2A(fromAgent, toCfg?.agent, task.slice(0,80));
    const sep = document.createElement('div');
    sep.style.cssText = `text-align:center;padding:6px 0;font-family:'Space Mono',monospace;font-size:0.58rem;color:${toCfg.color};border-top:1px solid #1e1e2e;margin:4px 0;opacity:0.8;`;
    sep.textContent = `← A2A-Auftrag: ${fromCfg?.label} → ${toCfg?.label} →`;
    container.appendChild(sep);
    const a2aTyping = showTyping(container, toCfg.agent);
    try {
      let agentReply = await callAgentAPI(toChannel, `[A2A-AUFTRAG von ${fromCfg?.label}]\n${task}`);
      for (let r=0;r<3;r++) { const tr=await executeDriveCalls(agentReply,toChannel,toCfg.agent,container); if(!tr) break; const lt2=showTyping(container,toCfg.agent); agentReply=await callAgentAPI(toChannel,`[TOOL-ERGEBNIS]\n${tr}`); lt2.remove(); }
      a2aTyping.remove();
      const replyTime = new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
      appendMsg(container, toCfg.agent, agentReply, replyTime);
      if ((depth||0) < 2) await executeA2ADelegation(agentReply, toChannel, container, (depth||0)+1);
      synthResults.push(`${toAgentName}: ${agentReply.slice(0,800)}`);
      chatHistories[fromChannel]?.push({ role:'user', content:`[A2A-ANTWORT von ${toCfg.label}]:\n${agentReply.slice(0,800)}` });
    } catch(e) {
      a2aTyping.remove();
      const errDiv = document.createElement('div'); errDiv.className = 'msg visible';
      errDiv.innerHTML = `<div style="padding:6px 12px;color:#ff6b6b;font-family:'Space Mono',monospace;font-size:0.65rem">⚠️ A2A-Fehler (${toAgentName}): ${e.message}</div>`;
      container.appendChild(errDiv); synthResults.push(`${toAgentName}: FEHLER – ${e.message}`);
    }
  }

  if (synthResults.length >= 2 && fromAgent === 'otto') {
    const synthSep = document.createElement('div');
    synthSep.style.cssText = `text-align:center;padding:6px 0;font-family:'Space Mono',monospace;font-size:0.58rem;color:${fromCfg?.color};border-top:1px solid #1e1e2e;margin:4px 0;opacity:0.8;`;
    synthSep.textContent = '← OTTO – Synthese →'; container.appendChild(synthSep);
    const synthTyping = showTyping(container, fromAgent);
    try {
      let synthReply = await callAgentAPI(fromChannel, `[A2A-SYNTHESE]\n${synthResults.join('\n\n')}\n\nFasse kurz zusammen.`);
      synthTyping.remove();
      appendMsg(container, fromAgent, synthReply, new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}));
      saveDialogHistory(fromAgent, '[Synthese]', synthReply);
    } catch(e) { synthTyping.remove(); }
  }
  return true;
}

// ─── TOOL APPROVAL GUARD ─────────────────────────────────────────────────────

const _approvalPending = {};

function _isDangerousTool(toolName, agentKey) {
  const dangerous = _loadedSkills?.[agentKey]?.meta?.dangerous_tools || [];
  return Array.isArray(dangerous) && dangerous.includes(toolName);
}

function _requestApproval(toolName, argsDisplay, agentKey, container) {
  return new Promise((resolve) => {
    const id = 'appr_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
    const agentCfg = Object.values(channelConfig).find(c=>c.agent===agentKey)||{};
    const color = agentCfg.color||'#fb923c', label = agentCfg.label||agentKey.toUpperCase();
    const card = document.createElement('div'); card.id = id; card.className = 'msg visible';
    card.innerHTML = `<div style="margin:8px 0;padding:14px 16px;border-radius:10px;background:rgba(251,146,60,0.07);border:1px solid rgba(251,146,60,0.35);font-family:'Space Mono',monospace;"><div style="font-size:0.68rem;color:#fb923c;margin-bottom:8px">⚠️ FREIGABE ERFORDERLICH</div><div style="font-size:0.75rem;color:#e0e0f0;margin-bottom:4px"><span style="color:${color}">${label}</span> will destruktives Tool aufrufen:</div><div style="font-size:0.72rem;color:#fb923c;background:rgba(0,0,0,.2);padding:6px 10px;border-radius:6px;margin:8px 0;font-weight:bold">${toolName}(${argsDisplay})</div><div style="display:flex;gap:10px;margin-top:10px"><button onclick="__approvalResolve('${id}',true)" style="flex:1;padding:7px;border-radius:6px;border:1px solid rgba(251,146,60,.5);background:rgba(251,146,60,.15);color:#fb923c;font-family:inherit;font-size:.7rem;cursor:pointer">✓ Erlauben</button><button onclick="__approvalResolve('${id}',false)" style="flex:1;padding:7px;border-radius:6px;border:1px solid rgba(255,100,100,.35);background:rgba(255,100,100,.07);color:#ff6b6b;font-family:inherit;font-size:.7rem;cursor:pointer">✕ Ablehnen</button></div></div>`;
    container.appendChild(card); container.scrollTop = container.scrollHeight;
    _approvalPending[id] = { resolve, card };
  });
}

window.__approvalResolve = function(id, approved) {
  const entry = _approvalPending[id]; if (!entry) return;
  entry.card.innerHTML = `<div style="text-align:center;padding:6px 0;font-family:'Space Mono',monospace;font-size:.58rem;color:${approved?'#6ee7b7':'#ff6b6b'};border-top:1px solid #1e1e2e;opacity:.7">${approved?'✓ genehmigt':'✕ abgelehnt'}</div>`;
  delete _approvalPending[id]; entry.resolve(approved);
};

async function _guardTool(toolName, argsDisplay, agentKey, container) {
  if (!_isDangerousTool(toolName, agentKey)) return true;
  if (!container) return true;
  return await _requestApproval(toolName, argsDisplay, agentKey, container);
}

// ─── DRIVE + TOOLS ────────────────────────────────────────────────────────────

async function ensureDriveConnected() {
  if (dataStatus.drive.live) return;
  try {
    const r = await _apiFetch('http://localhost:3000/api/drive/status');
    if (r.ok) { const d = await r.json(); if (d.connected && !d.expired) { dataStatus.drive = { live: true, quelle: 'Google Drive' }; saveFact('drive','verbunden','ja'); saveFact('drive','nutzer',d.email||''); if(typeof rebuildSystemPrompts==='function') rebuildSystemPrompts(); } }
  } catch(_) {}
}

async function executeDriveCalls(replyText, channel, agent, container) {
  const results = [];

  // saveFact()
  const sfRx = /saveFact\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]*)['"]\s*\)/gi;
  for (const sm of [...replyText.matchAll(sfRx)]) {
    const [, cat, key, val] = sm; saveFact(cat, key, val); results.push(`✓ Gespeichert: ${cat}.${key}`);
    try { await _apiFetch('http://localhost:3000/api/memory/write?file=semantic',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(mem.semantic)}); } catch(_) {}
    if(typeof rebuildSystemPrompts==='function') rebuildSystemPrompts();
  }

  // gcalRead()
  const gcalRx = /`{0,3}\s*gcalRead\s*\(([^)\n]{0,100})\)\s*`{0,3}/gi;
  for (const gm of [...replyText.matchAll(gcalRx)]) {
    const arg = gm[1].trim().replace(/^['"](.*)['"]$/,'$1') || 'upcoming';
    try {
      const r = await _apiFetch('http://localhost:3000/api/calendar'); const d = await r.json();
      if (d.error) { results.push(`gcalRead(): ${d.error}`); continue; }
      const now = new Date();
      const filtered = (d.events||[]).filter(e => { if(!e.start) return false; const dt=new Date(e.start); if(arg==='today') return dt.toDateString()===now.toDateString(); return dt>=now; }).slice(0,15);
      results.push(filtered.length ? `Kalender (${arg}):\n${filtered.map(e=>`${e.start?.slice(0,10)||'?'}: ${e.summary}`).join('\n')}` : `gcalRead("${arg}"): Keine Termine`);
    } catch(e) { results.push(`gcalRead(): Fehler – ${e.message}`); }
  }

  // driveList/Search/Read/Upload
  const callRx = /`{0,3}\s*drive(List|Search|Read|Upload)\s*\(([^)\n]{0,500})\)\s*`{0,3}/gi;
  const calls  = [...replyText.matchAll(callRx)];

  // webFetch()
  const wfRx = /`{0,3}\s*webFetch\s*\(([^)\n]{0,500})\)\s*`{0,3}/gi;
  for (const wm of [...replyText.matchAll(wfRx)]) {
    const args = wm[1].split(',').map(s=>s.trim().replace(/^['"](.*)['"]$/,'$1'));
    const target = args[0] || '';
    if (!target || !target.startsWith('http')) { results.push('webFetch(): URL fehlt'); continue; }
    try {
      const r = await _apiFetch(`http://localhost:3000/api/fetch?url=${encodeURIComponent(target)}&maxlen=50000`);
      const d = await r.json(); if (d.error) { results.push(`webFetch(): ${d.error}`); continue; }
      results.push(`Webseite ${d.domain} (${d.zeichen} Zeichen):\n${(d.text||'').slice(0,4000)}`);
    } catch(e) { results.push(`webFetch(): Fehler – ${e.message}`); }
  }

  // braveSearch()
  const bsRx = /`{0,3}\s*braveSearch\s*\(([^)\n]{0,300})\)\s*`{0,3}/gi;
  for (const bm of [...replyText.matchAll(bsRx)]) {
    const args = bm[1].split(',').map(s=>s.trim().replace(/^['"](.*)['"]$/,'$1'));
    const query = args[0]||''; if(!query) { results.push('braveSearch(): Query fehlt'); continue; }
    try {
      const r = await _apiFetch(`http://localhost:3000/api/search?q=${encodeURIComponent(query)}&count=${parseInt(args[1])||5}`);
      const d = await r.json(); if (d.error) { results.push(`braveSearch(): ${d.error}`); continue; }
      results.push(`Brave Search "${query}":\n${(d.results||[]).map((r,i)=>`${i+1}. ${r.title}\n   ${r.url}`).join('\n\n')}`);
    } catch(e) { results.push(`braveSearch(): Fehler – ${e.message}`); }
  }

  // shellyPower/Status
  const shellyRx = /`{0,3}\s*(shellyPower|shellyStatus)\s*\(\s*\)\s*`{0,3}/gi;
  for (const sm of [...replyText.matchAll(shellyRx)]) {
    const fn = sm[1].toLowerCase(); const sub = fn === 'shellystatus' ? '/status' : '/power';
    try {
      const r = await _apiFetch(`http://localhost:3000/api/shelly${sub}`); const d = await r.json();
      if (d.error) { results.push(`${sm[1]}(): ${d.error}`); }
      else if (fn === 'shellypower') { results.push(`shellyPower: Gesamt ${d.gesamt_w}W (${d.einspeisung?'Einspeisung':'Netzbezug'}) | Stand: ${d.zeitstempel}`); }
      else { results.push(`shellyStatus: Online=${d.online?'ja':'nein'}, Firmware=${d.firmware||'?'}`); }
    } catch(e) { results.push(`${sm[1]}(): Fehler – ${e.message}`); }
  }

  if (!calls.length && !results.length) return null;

  await ensureDriveConnected();
  if (!dataStatus.drive.live && calls.length) { results.push('FEHLER: Google Drive nicht verbunden'); return results.join('\n\n'); }

  for (const match of calls) {
    const fn = 'drive' + match[1]; const args = match[2].trim();
    const parseArg = s => { s=s.trim(); if(s==='null'||s==='') return null; if(s==='true') return true; if(s==='false') return false; if(/^\d+$/.test(s)) return parseInt(s); return s.replace(/^['"](.*)['"]$/,'$1'); };
    const argList = args ? args.split(',').map(parseArg) : [];
    if (fn === 'driveUpload' && !await _guardTool('driveUpload', '"'+(argList[0]||'?')+'"', agent, container)) { results.push('driveUpload(): Abgelehnt'); continue; }
    try {
      let result;
      if      (fn==='driveList')   result = await driveList(argList[0],argList[1]);
      else if (fn==='driveSearch') result = await driveSearch(argList[0],argList[1]);
      else if (fn==='driveRead')   { if(!argList[0]){results.push('driveRead(): fileId fehlt');continue;} result = await driveRead(argList[0]); }
      else if (fn==='driveUpload') result = await driveUpload(argList[0],argList[1],argList[2]);
      if (result?.error) { results.push(`${fn}(): Fehler – ${result.error}`); }
      else if (fn==='driveList')   { const o=(result.dateien||[]).filter(f=>f.typ==='ordner'), d2=(result.dateien||[]).filter(f=>f.typ!=='ordner'); let out=`Drive-Inhalt: ${result.anzahl} Einträge`; if(o.length) out+='\nOrdner: '+o.map(f=>f.name).join(', '); if(d2.length) out+='\nDateien: '+d2.map(f=>f.name).join(', '); results.push(out); }
      else if (fn==='driveSearch') results.push(`Suche "${result.suchanfrage}": ${result.treffer} Treffer\n${(result.dateien||[]).map(f=>`${f.name} (${f.geaendert})`).join('\n')}`);
      else if (fn==='driveRead')   results.push(`Inhalt "${result.name}" (${result.zeichen} Zeichen):\n${(result.text||'').slice(0,2000)}`);
      else if (fn==='driveUpload') results.push(`Hochgeladen: "${result.name}" → ${result.ordner}`);
    } catch(e) { results.push(`${fn}(): Fehler – ${e.message}`); }
  }

  return results.length ? results.join('\n\n') : null;
}

// ─── REACT ────────────────────────────────────────────────────────────────────

function parseReActBlock(text) {
  return {
    thought:  (text.match(/Thought:\s*([\s\S]*?)(?=\nAction:|\nErgebnis:|$)/)?.[1]||'').trim(),
    action:   (text.match(/Action:\s*(.+?)(?=\n|$)/s)?.[1]||'').trim(),
    ergebnis: (text.match(/## [\s\S]+/)?.[0]||'').trim(),
  };
}
function classifyAction(action, fullText) {
  const fertigRx = /\b(FERTIG|fertig)\b/i;
  if (fertigRx.test(action) || (!action && fertigRx.test(fullText||''))) return { type:'done' };
  if (!action) return { type:'unknown' };
  if (/^WARTEN/i.test(action)) return { type:'pause' };
  if (/^FEHLER/i.test(action)) return { type:'error' };
  return { type:'tool', call: action };
}
function appendReActCard(container, type, content, round, maxRound) {
  const STYLES = { thought:{border:'#a78bfa',bg:'rgba(167,139,250,0.06)',icon:'🧠',label:`Thought [${round}/${maxRound}]`}, action:{border:'#fbbf24',bg:'rgba(251,191,36,0.06)',icon:'⚙️',label:'Action'}, result:{border:'#6ee7b7',bg:'rgba(110,231,183,0.06)',icon:'✅',label:'Result'}, error:{border:'#fb923c',bg:'rgba(251,146,60,0.08)',icon:'⚠️',label:'Fehler'} };
  const s = STYLES[type]||STYLES.thought;
  const card = document.createElement('div'); card.className = 'msg visible react-card';
  card.innerHTML = '<div style="margin:3px 0 3px 44px;padding:9px 13px;border-radius:7px;background:'+s.bg+';border-left:2px solid '+s.border+';font-family:\'Space Mono\',monospace;font-size:.67rem;"><div style="color:'+s.border+';margin-bottom:4px">'+s.icon+' '+s.label+'</div><div style="color:#c0c0d8;white-space:pre-wrap;">'+content.replace(/</g,'&lt;').slice(0,1000)+'</div></div>';
  container.appendChild(card); container.scrollTop = container.scrollHeight; return card;
}

async function callReActAPI(agent, systemPrompt, messages) {
  const response = await _apiFetch('http://localhost:3000/v1/messages', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1500, system: systemPrompt, messages })
  });
  if (!response.ok) { const err = await response.json().catch(()=>{}); throw new Error(err?.error?.message||`HTTP ${response.status}`); }
  return (await response.json()).content?.[0]?.text || '';
}

async function runReActLoop(channel, userMessage, container) {
  const MAX_ROUNDS = 8; const agent = channelConfig[channel]?.agent || 'react';
  const systemPrompt = agentSystemPrompts[agent] || '';
  const reactMessages = [{ role: 'user', content: userMessage }];
  let lastAssistantReply = '', feedbackMessage = userMessage;
  const thoughtLog = [];
  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const typing = showTyping(container, agent); let reply;
    try {
      if (round > 1) { reactMessages.push({role:'assistant',content:lastAssistantReply}); reactMessages.push({role:'user',content:feedbackMessage}); }
      if (reactMessages.length > 6) reactMessages.splice(0, reactMessages.length - 6);
      reply = await callReActAPI(agent, systemPrompt, reactMessages); lastAssistantReply = reply;
    } catch(e) { typing.remove(); appendReActCard(container,'error','API-Fehler: '+e.message,round,MAX_ROUNDS); break; }
    typing.remove();
    const { thought, action, ergebnis } = parseReActBlock(reply);
    const classified = classifyAction(action, reply);
    if (thought) { thoughtLog.push(`R${round}: ${thought.slice(0,200)}`); appendReActCard(container,'thought',thought,round,MAX_ROUNDS); }
    if (classified.type==='done' && round<3) { appendReActCard(container,'error',`FERTIG zu früh (${round}/3)`,round,MAX_ROUNDS); feedbackMessage='[SYSTEM] Suche noch mehr Quellen.'; continue; }
    if (classified.type==='done' || round===MAX_ROUNDS) {
      const summary = ergebnis||thought||reply;
      appendMsg(container, agent, summary, new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}));
      saveDialogHistory(agent, userMessage, summary); break;
    }
    if (classified.type==='tool') {
      appendReActCard(container,'action',classified.call,round,MAX_ROUNDS);
      const toolResult = await executeDriveCalls(reply, channel, agent, container);
      if (toolResult) { appendReActCard(container,'result',toolResult.slice(0,800),round,MAX_ROUNDS); feedbackMessage='[TOOL-ERGEBNIS]\n'+toolResult.slice(0,2000); }
      else { feedbackMessage='[TOOL-ERGEBNIS]\nKein Ergebnis.'; }
    }
    if (classified.type==='unknown') { feedbackMessage='[SYSTEM] Nutze Format:\nThought: ...\nAction: webFetch("url") oder FERTIG'; }
  }
}

// ─── LIVE DATA ───────────────────────────────────────────────────────────────

const dataStatus = {
  kalender: {live:false,quelle:'keine'}, finanzen: {live:false,quelle:'keine'},
  garmin: {live:false,quelle:'keine'}, garmin_swim: {live:false,quelle:'keine'},
  apple_health: {live:false,quelle:'Apple Health'}, wetter: {live:false,quelle:'keine'},
  drive: {live:false,quelle:'Google Drive'}, vvs: {live:false,quelle:'nicht konfiguriert'},
};

async function loadLiveData() {
  const base = 'http://localhost:3000';
  if (location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;

  try { const r=await _apiFetch(base+'/api/weather?lat=48.7758&lon=9.1829&city=Stuttgart'); if(r.ok){const w=await r.json(); if(!w.error){saveFact('wetter','aktuell',`${w.aktuell.temperatur}, ${w.aktuell.wetter}`); saveFact('wetter','woche',w.woche.slice(0,3).map(d=>`${d.datum}: ${d.max}/${d.min}`).join(' | ')); dataStatus.wetter={live:true,quelle:'Open-Meteo'};}}} catch(e){}
  try { const r=await _apiFetch(base+'/api/calendar'); if(r.ok){const cal=await r.json(); if(!cal.error&&cal.events?.length>0){saveFact('kalender','naechste_termine',cal.events.slice(0,10).map(e=>`${e.start}: ${e.summary}`).join(' | ')); dataStatus.kalender={live:true,quelle:cal.quelle||'Kalender'};} else if(cal.error) dataStatus.kalender={live:false,quelle:'keine'};}} catch(e){}
  try { const r=await _apiFetch(base+'/api/banking'); if(r.ok){const b=await r.json(); if(!b.error){saveFact('finanzen','kontostand',b.kontostand+' EUR'); dataStatus.finanzen={live:true,quelle:'CSV'};}}} catch(e){}
  try { const r=await _apiFetch(base+'/api/drive/status'); if(r.ok){const d=await r.json(); if(d.connected&&!d.expired){saveFact('drive','verbunden','ja'); saveFact('drive','nutzer',d.email||d.user||''); dataStatus.drive={live:true,quelle:'Google Drive'};} else dataStatus.drive={live:false,quelle:d.connected?'Token abgelaufen':'nicht verbunden'};}} catch(e){}

  let vvsStop='';
  try { const cfgR=await _apiFetch(`${base}/api/config`); if(cfgR.ok){const cfg=await cfgR.json(); vvsStop=cfg.vvs_stammhaltestelle||'';}} catch(_){}
  if (vvsStop) {
    try {
      const vvsParam=/^\d+$/.test(vvsStop)?`id=${vvsStop}`:`stop=${encodeURIComponent(vvsStop)}`;
      const r=await _apiFetch(`${base}/api/vvs/abfahrten?${vvsParam}&limit=8`);
      if(r.ok){const v=await r.json(); if(!v.error&&v.abfahrten?.length>0){saveFact('vvs','haltestelle',v.haltestelle); saveFact('vvs','abfahrten',v.abfahrten.slice(0,5).map(a=>`${a.zeit} ${a.linie} → ${a.richtung}`).join(' | ')); dataStatus.vvs={live:true,quelle:'VVS EFA'};}}
    } catch(e){}
  }

  console.log('[LiveData] Status:', Object.entries(dataStatus).map(([k,v])=>`${k}:${v.live?'✅':'⚠️'}`).join(' '));
  if (typeof rebuildSystemPrompts === 'function') rebuildSystemPrompts();
}

// ─── DRIVE AKTIONEN ───────────────────────────────────────────────────────────

async function driveUpload(name, content, folder) {
  return (await _apiFetch('http://localhost:3000/api/drive/upload',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,content,folder:folder||null})})).json();
}
async function driveSearch(query, limit) {
  return (await _apiFetch(`http://localhost:3000/api/drive/search?q=${encodeURIComponent(query)}&limit=${limit||10}`)).json();
}
async function driveList(folder, limit) {
  const url = folder ? `http://localhost:3000/api/drive/list?folder=${encodeURIComponent(folder)}&limit=${limit||20}` : `http://localhost:3000/api/drive/list?limit=${limit||20}`;
  return (await _apiFetch(url)).json();
}
async function driveRead(fileId) {
  return (await _apiFetch(`http://localhost:3000/api/drive/read?fileId=${encodeURIComponent(fileId)}`)).json();
}
async function webFetch(url, maxlen) {
  return (await _apiFetch(`http://localhost:3000/api/fetch?url=${encodeURIComponent(url)}&maxlen=${maxlen||6000}`)).json();
}
async function braveSearch(query, count) {
  return (await _apiFetch(`http://localhost:3000/api/search?q=${encodeURIComponent(query)}&count=${count||5}`)).json();
}

// ─── MORGEN-BRIEFING ─────────────────────────────────────────────────────────

async function triggerBriefing() {
  const container = document.getElementById('chat-messages'); if (!container) return;
  const labelDiv = document.createElement('div');
  labelDiv.style.cssText = "text-align:center;padding:8px 0 4px;font-family:'Space Mono',monospace;font-size:.58rem;color:var(--accent-a);opacity:.7;";
  labelDiv.textContent = '── Morgen-Briefing ──'; container.appendChild(labelDiv);

  const today = new Date().toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'long'});
  const prompt = `Erstelle mein Morgen-Briefing für heute, ${today}. Nenne (1) die nächsten Termine, (2) eine kurze Wetterinfo und (3) deine Top-3 Prioritäten.`;
  const typingEl = showTyping(container, 'otto');
  try {
    let reply = await callAgentAPI('leben', prompt); typingEl.remove();
    for (let r=0;r<3;r++){const tr=await executeDriveCalls(reply,'leben','otto',container);if(!tr) break; const lt=showTyping(container,'otto'); reply=await callAgentAPI('leben',`[TOOL-ERGEBNIS]\n${tr}`); lt.remove();}
    appendMsg(container, 'otto', reply, new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}));
    saveEpisode('OTTO','Morgen-Briefing erstellt','briefing');
    saveDialogHistory('otto', prompt, reply);
    if (typeof updateDataStatusUI==='function') updateDataStatusUI();
    reflectAndStore('otto', prompt, reply);
    await executeA2ADelegation(reply, 'leben', container);
  } catch(err) {
    typingEl.remove();
    const errDiv=document.createElement('div'); errDiv.className='msg visible';
    errDiv.innerHTML=`<div style="padding:8px 12px;color:#ff6b6b;font-family:'Space Mono',monospace;font-size:.7rem">⚠️ Briefing-Fehler: ${err.message}</div>`;
    container.appendChild(errDiv); console.error('[triggerBriefing]',err);
  }
}

// ─── SYSTEM PROMPTS ──────────────────────────────────────────────────────────

function saveFact(category, key, value) {
  if (!mem.semantic) mem.semantic = {};
  if (!mem.semantic[category]) mem.semantic[category] = {};
  mem.semantic[category][key] = value;
}

function buildAgentDataBlock(agent) {
  const s = mem.semantic || {}; let block = '';
  if (agent==='otto') { if(dataStatus.kalender.live&&s.kalender?.naechste_termine){block+=`\nKALENDER:\n`;s.kalender.naechste_termine.split(' | ').forEach(t=>{block+=`- ${t}\n`;});} else if(typeof emulationData!=='undefined') block+='\n'+(emulationData.kalender||'')+'\n'; }
  if (agent==='mina') { if(dataStatus.finanzen.live&&s.finanzen){block+=`\nFINANZDATEN:\n`;if(s.finanzen.kontostand) block+=`- Kontostand: ${s.finanzen.kontostand}\n`;} else if(typeof emulationData!=='undefined') block+='\n'+(emulationData.finanzen||'')+'\n'; }
  if (agent==='vera') { const ga=s.garmin||{}; if(dataStatus.garmin.live){block+=`\nGESUNDHEIT (Garmin):\n`;if(ga.schritte) block+=`- Schritte: ${ga.schritte}\n`;if(ga.hrv_ms) block+=`- HRV: ${ga.hrv_ms}ms\n`;if(ga.schlaf_min) block+=`- Schlaf: ${Math.floor(ga.schlaf_min/60)}h\n`;} else if(typeof emulationData!=='undefined') block+='\n'+(emulationData.garmin||'')+'\n'; }
  if (agent==='otto'||agent==='mina') { if(dataStatus.drive?.live&&s.drive){block+=`\nGOOGLE DRIVE (verbunden${s.drive.nutzer?' als '+s.drive.nutzer:''}):\n`; if(s.drive.unterordner) block+=`- Ordner: ${s.drive.unterordner}\n`;} else block+=`\nGOOGLE DRIVE: nicht verbunden\n`; }
  return block;
}

function rebuildSystemPrompts() {
  const s = mem.semantic||{}, nutzer = s.nutzer||{};
  let profileBlock = '';
  if(nutzer.name) profileBlock+=`\nNUTZER: ${nutzer.name}`;
  if(nutzer.wohnort) profileBlock+=` | Wohnort: ${nutzer.wohnort}`;
  let wetterBlock = '';
  if(dataStatus.wetter.live&&s.wetter) wetterBlock=`\nWETTER: ${s.wetter.aktuell||''}`;
  const knownAgents = [...new Set(Object.values(channelConfig).map(c=>c.agent))];
  for (const agent of knownAgents) {
    agentSystemPrompts[agent] = getSkillPrompt(agent) + profileBlock
      + '\n\n── DATEN ──' + wetterBlock + buildAgentDataBlock(agent)
      + '── GEDÄCHTNIS ──\n' + JSON.stringify(s,null,1).slice(0,1500);
  }
  console.log('[Prompts] Aktualisiert | Drive:', dataStatus.drive.live?'✅':'⚠️');
}

// ─── FOCUS-REFRESH ────────────────────────────────────────────────────────────

window.addEventListener('focus', async () => {
  if (!dataStatus.drive.live) {
    try { const r=await _apiFetch('http://localhost:3000/api/drive/status'); if(r.ok){const d=await r.json(); if(d.connected&&!d.expired){dataStatus.drive={live:true,quelle:'Google Drive'}; saveFact('drive','verbunden','ja'); saveFact('drive','nutzer',d.email||''); if(typeof rebuildSystemPrompts==='function') rebuildSystemPrompts(); if(typeof updateDataStatusUI==='function') updateDataStatusUI();}}} catch(_){}
  }
});

// ─── AUTO-INIT SKILLS beim Laden ─────────────────────────────────────────────
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    initSkills().then(loaded => {
      if (loaded) {
        initSkillState(_loadedSkills);
        if (typeof UIBuilder !== 'undefined') UIBuilder.build(_loadedSkills);
        if (typeof rebuildSystemPrompts === 'function') rebuildSystemPrompts();
        console.log('%c[Skills] System vollständig initialisiert', 'color:#6ee7b7;font-weight:bold');
      }
      loadLiveData().then(() => {
        if (typeof rebuildSystemPrompts === 'function') rebuildSystemPrompts();
        console.log('%c[LiveData] Geladen & Prompts aktualisiert', 'color:#fbbf24;font-weight:bold');
      }).catch(e => console.warn('[LiveData]', e.message));
    });
  });
}
