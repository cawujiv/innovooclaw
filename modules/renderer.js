// innovooClaw · modules/renderer.js  (Frontend-Browser-JS)
// Chat-Nachrichten rendern, Kanäle wechseln, Szenarien abspielen.

let currentScenario = 'morning';
let msgTimeout = null;

function clearTimeouts() { if(msgTimeout) clearTimeout(msgTimeout); }

// agentMeta wird ggf. durch UIBuilder erweitert
const agentMeta = {};

function _getAgentMeta(agentKey) {
  if (agentMeta[agentKey]) return agentMeta[agentKey];
  // Fallback aus channelConfig
  if (typeof channelConfig !== 'undefined') {
    const cfg = Object.values(channelConfig).find(c => c.agent === agentKey);
    if (cfg) return { name: cfg.label || agentKey.toUpperCase(), cls: 'avatar-a', icon: cfg.icon || '🤖', color: cfg.color || 'var(--accent-a)' };
  }
  return { name: agentKey.toUpperCase(), cls: 'avatar-a', icon: '🤖', color: 'var(--accent-a)' };
}

function switchChannel(ch) {
  if (typeof channelConfig === 'undefined' || !channelConfig[ch]) return;
  if (typeof closeBankingFeed === 'function') closeBankingFeed();
  activeChannel = ch;
  if (typeof saveWorking  === 'function') saveWorking({ aktiver_channel: ch });
  if (typeof saveEpisode  === 'function') saveEpisode('system', 'Channel gewechselt zu #' + ch, 'navigation');
  const cfg = channelConfig[ch];

  document.querySelectorAll(".sidebar-item").forEach(i => i.classList.remove("active"));
  const el = document.getElementById("ch-" + ch);
  if (el) el.classList.add("active");

  if (document.getElementById("chat-icon"))       document.getElementById("chat-icon").textContent       = cfg.icon  || '';
  if (document.getElementById("chat-title"))      { document.getElementById("chat-title").textContent      = cfg.title || ('# ' + ch); document.getElementById("chat-title").style.color = cfg.color || ''; }
  if (document.getElementById("chat-agent-desc")) document.getElementById("chat-agent-desc").textContent = cfg.desc  || '';
  if (document.getElementById("user-input"))      document.getElementById("user-input").placeholder       = (cfg.agent || '').toUpperCase() + ' fragen…';

  const container = document.getElementById("chat-messages");
  if (container) {
    const div = document.createElement("div");
    div.style.cssText = "text-align:center;padding:8px 0;font-family:'Space Mono',monospace;font-size:0.62rem;color:var(--muted);border-top:1px solid var(--border);margin:6px 0;";
    div.textContent = "— " + (cfg.title || ('#' + ch)) + " —";
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }
  if (typeof loadDialogHistory === 'function') loadDialogHistory(ch);
}

function loadScenario(name, btnEl, scrollToEnd) {
  clearTimeouts();
  if (typeof closeBankingFeed === 'function') closeBankingFeed();
  currentScenario = name;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const activeBtn = btnEl || document.querySelector(`.tab-btn[onclick*="'${name}'"]`);
  if (activeBtn) activeBtn.classList.add('active');

  if (typeof scenarios === 'undefined') return;
  const s = scenarios[name];
  if (!s) return;

  activeChannel = s.channel;
  const cfg = (typeof channelConfig !== 'undefined' && channelConfig[s.channel]) || {};
  if (document.getElementById("chat-icon"))       document.getElementById("chat-icon").textContent       = cfg.icon  || s.icon || '🤖';
  if (document.getElementById("chat-title"))      { document.getElementById("chat-title").textContent      = cfg.title || s.title || ''; if(cfg.color) document.getElementById("chat-title").style.color = cfg.color; }
  if (document.getElementById("chat-agent-desc")) document.getElementById("chat-agent-desc").textContent = cfg.desc  || '';

  document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
  const chEl = document.getElementById('ch-' + s.channel);
  if (chEl) chEl.classList.add('active');

  const container = document.getElementById('chat-messages');
  if (container) {
    container.innerHTML = '';
    if (scrollToEnd) renderAllMessagesInstant(s.messages, container);
    else             playMessages(s.messages, 0, container, scrollToEnd);
  }

  setTimeout(() => { if (typeof loadDialogHistory === 'function') loadDialogHistory(s.channel || 'leben'); }, 300);
}

function renderAllMessagesInstant(messages, container) {
  (messages || []).forEach(m => {
    if (m.typing) return;
    const div = document.createElement('div');
    div.className = 'msg visible';
    div.innerHTML = _buildMsgHTML(m);
    container.appendChild(div);
  });
  const all = container.querySelectorAll('.msg');
  if (all.length > 3) all[all.length - 3].scrollIntoView({ block: 'start' });
  else container.scrollTop = container.scrollHeight;
}

function playMessages(messages, index, container, scrollToEnd) {
  if (index >= (messages || []).length) return;
  const m = messages[index];
  msgTimeout = setTimeout(() => {
    if (m.typing) {
      const color = '#a78bfa';
      const ti = document.createElement('div');
      ti.className = 'typing-indicator';
      ti.innerHTML = `<div class="typing-dot" style="background:${color}"></div><div class="typing-dot" style="background:${color}"></div><div class="typing-dot" style="background:${color}"></div>`;
      container.appendChild(ti);
      setTimeout(() => ti.classList.add('visible'), 50);
      msgTimeout = setTimeout(() => { ti.remove(); playMessages(messages, index + 1, container, scrollToEnd); }, messages[index + 1]?.delay || 1200);
      return;
    }
    const div = document.createElement('div');
    div.className = 'msg';
    div.innerHTML = _buildMsgHTML(m);
    container.appendChild(div);
    setTimeout(() => div.classList.add('visible'), 50);
    container.scrollTop = container.scrollHeight;
    playMessages(messages, index + 1, container, scrollToEnd);
  }, m.delay || 0);
}

function _buildMsgHTML(m) {
  const colors  = { otto:'var(--accent-a)', mina:'var(--accent-b)', vera:'var(--accent-c)', user:'#8899cc' };
  const avatars = { otto:'📋', mina:'💰', vera:'🏃', user:'👤' };
  const classes = { otto:'avatar-a', mina:'avatar-b', vera:'avatar-c', user:'avatar-user' };
  const color  = colors[m.who]  || 'var(--accent-a)';
  const avatar = avatars[m.who] || '🤖';
  const cls    = classes[m.who] || 'avatar-a';
  let actionHtml = '';
  if (m.action) {
    const items = (m.action.items || []).map(i => `<li>${i}</li>`).join('');
    actionHtml = `<div class="action-card" style="border-left-color:${m.action.color}"><div class="action-card-title" style="color:${m.action.color}">${m.action.title}</div><ul>${items}</ul></div>`;
  }
  return `<div class="msg-avatar ${cls}">${avatar}</div><div class="msg-content"><div class="msg-header"><span class="msg-name" style="color:${color}">${m.name}</span><span class="msg-time">${m.time}</span></div><div class="msg-text">${(m.text||'').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')}</div>${actionHtml}</div>`;
}

function formatMsgText(text) {
  return (text || '')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .split('\n').map(line => {
      const t = line.trim();
      if (t.startsWith('- ') || t.startsWith('• ') || t.match(/^[-•–]\s/)) {
        const content = t.replace(/^[-•–]\s*/,'');
        return `<span style="display:block;padding-left:1.2em;position:relative"><span style="position:absolute;left:0">●</span>${content}</span>`;
      }
      return t ? `<span style="display:block">${t}</span>` : '<span style="display:block;height:6px"></span>';
    }).join('');
}

function appendMsg(container, agentKey, text, time) {
  const a = _getAgentMeta(agentKey);
  const div = document.createElement('div');
  div.className = 'msg';
  div.innerHTML = `<div class="msg-avatar ${a.cls}">${a.icon}</div><div class="msg-content"><div class="msg-header"><span class="msg-name" style="color:${a.color}">${a.name}</span><span class="msg-time">${time}</span></div><div class="msg-text">${formatMsgText(text)}</div></div>`;
  container.appendChild(div);
  setTimeout(() => div.classList.add('visible'), 50);
  container.scrollTop = container.scrollHeight;
}

function showTyping(container, agentKey) {
  const a = _getAgentMeta(agentKey);
  const ti = document.createElement('div');
  ti.className = 'typing-indicator';
  ti.innerHTML = `<div class="msg-avatar ${a.cls}" style="width:28px;height:28px;font-size:0.85rem">${a.icon}</div><div class="typing-dot" style="background:${a.color}"></div><div class="typing-dot" style="background:${a.color}"></div><div class="typing-dot" style="background:${a.color}"></div>`;
  container.appendChild(ti);
  setTimeout(() => ti.classList.add('visible'), 50);
  container.scrollTop = container.scrollHeight;
  return ti;
}

function addDelegationMessage(fromChannel, toChannel, reason) {
  const container = document.getElementById('chat-messages');
  if (!container) return;
  const cfg = (typeof channelConfig !== 'undefined' && channelConfig[toChannel]) || {};
  const div = document.createElement('div');
  div.style.cssText = `text-align:center;padding:5px 0;font-family:'Space Mono',monospace;font-size:0.58rem;color:${cfg.color||'#aaa'};border-top:1px solid #1e1e2e;margin:3px 0;opacity:0.8;`;
  div.textContent = `⟳ Delegation: ${reason}`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function updateDataStatusUI() {
  const el = document.getElementById('data-status-badges');
  if (!el) return;
  el.innerHTML = '';
}
