// innovooClaw · modules/memory-widget.js  (Frontend-Browser-JS)
// Standalone UI-Widget für das Gedächtnis (Vektor-Suche + letzte Fakten).

async function recall(query, agent = null, limit = 5) {
  try {
    const ap = agent ? `&agent=${encodeURIComponent(agent)}` : '';
    const r  = await fetch(`http://localhost:3000/api/memory/search?q=${encodeURIComponent(query)}&limit=${limit}${ap}`);
    if (!r.ok) return [];
    const d = await r.json();
    return d.hits || [];
  } catch(e) { return []; }
}

(function MemoryWidget() {
  'use strict';

  const CSS = `
  #memory-widget{position:fixed;bottom:110px;right:20px;width:300px;z-index:9000;font-family:'Space Mono','Courier New',monospace;pointer-events:none;}
  #memory-widget .glass-panel{background:rgba(15,15,30,.88);border:1px solid rgba(167,139,250,.25);border-radius:12px;padding:14px 16px;backdrop-filter:blur(12px);pointer-events:all;transition:border-color .3s;}
  #memory-widget .glass-panel:hover{border-color:rgba(167,139,250,.45);}
  #memory-widget .mw-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;cursor:pointer;user-select:none;}
  #memory-widget .mw-title{font-size:.6rem;letter-spacing:1px;color:#a78bfa;text-transform:uppercase;}
  #memory-widget .mw-badge{font-size:.55rem;color:rgba(167,139,250,.5);padding:2px 6px;border:1px solid rgba(167,139,250,.2);border-radius:4px;transition:all .3s;}
  #memory-widget .mw-body{overflow:hidden;max-height:0;transition:max-height .35s ease;}
  #memory-widget .mw-body.open{max-height:400px;}
  #memory-widget .fact-item{padding:6px 8px;border-radius:6px;margin-bottom:4px;font-size:.58rem;color:#b0b0d0;border-left:2px solid rgba(167,139,250,.2);word-break:break-word;}
  #memory-widget .fact-item .fact-cat{color:rgba(167,139,250,.65);margin-right:4px;font-size:.52rem;}
  #memory-widget .fact-item .fact-ts{display:block;font-size:.48rem;color:rgba(255,255,255,.2);margin-top:2px;}
  #memory-widget .mw-search{display:flex;gap:6px;margin-bottom:10px;}
  #memory-widget .mw-search input{flex:1;background:rgba(255,255,255,.04);border:1px solid rgba(167,139,250,.2);border-radius:6px;color:#c0c0d0;font-family:inherit;font-size:.62rem;padding:6px 8px;outline:none;}
  #memory-widget .mw-search button{background:rgba(167,139,250,.12);border:1px solid rgba(167,139,250,.3);border-radius:6px;color:#a78bfa;font-family:inherit;font-size:.62rem;padding:5px 9px;cursor:pointer;}
  #memory-widget .mw-empty{font-size:.55rem;color:rgba(255,255,255,.2);text-align:center;padding:8px 0;}
  #memory-widget .mw-db-mode{font-size:.48rem;color:rgba(255,255,255,.15);text-align:right;margin-top:6px;}`;

  let _isOpen = false, _factCount = 0, _searchMode = false;

  function _mount() {
    const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s);
    let c = document.getElementById('memory-widget');
    if (!c) { c = document.createElement('div'); c.id = 'memory-widget'; document.body.appendChild(c); }
    c.innerHTML = `<div class="glass-panel"><div class="mw-header" id="mw-toggle"><span class="mw-title">🧠 Gedächtnis</span><span class="mw-badge" id="mw-badge">0 Fakten</span></div><div class="mw-body" id="mw-body"><div class="mw-search"><input type="text" id="mw-search-input" placeholder="Suche im Gedächtnis…"/><button id="mw-search-btn">↵</button></div><div id="mw-results-label" style="font-size:.52rem;color:rgba(167,139,250,.5);margin-bottom:5px;display:none;"></div><div id="mw-facts-list"></div><div class="mw-db-mode" id="mw-db-mode">mode: …</div></div></div>`;
    document.getElementById('mw-toggle').addEventListener('click', _toggle);
    const si = document.getElementById('mw-search-input');
    document.getElementById('mw-search-btn').addEventListener('click', _doSearch);
    si.addEventListener('keydown', e => { if (e.key === 'Enter') _doSearch(); });
    si.addEventListener('input', () => { if (!si.value.trim()) _showLatest(); });
  }

  function _toggle() {
    _isOpen = !_isOpen;
    const b = document.getElementById('mw-body');
    if (b) b.classList.toggle('open', _isOpen);
    if (_isOpen) _showLatest();
  }

  async function _showLatest() {
    _searchMode = false;
    const label = document.getElementById('mw-results-label');
    if (label) label.style.display = 'none';
    try {
      const r = await fetch('http://localhost:3000/api/memory/latest-facts?n=5');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
      _renderFacts(d.facts || d.hits || []);
      const dbEl = document.getElementById('mw-db-mode');
      if (dbEl) dbEl.textContent = 'mode: ' + (d.mode || 'json');
    } catch(e) { _renderEmpty('Gedächtnis nicht erreichbar'); }
  }

  async function _doSearch() {
    const si = document.getElementById('mw-search-input');
    const q  = si?.value?.trim() || '';
    if (!q) { _showLatest(); return; }
    _searchMode = true;
    const label = document.getElementById('mw-results-label');
    if (label) { label.style.display = 'block'; label.textContent = `Suche: "${q}"`; }
    const list = document.getElementById('mw-facts-list');
    if (list) list.innerHTML = '<div class="mw-empty">Suche…</div>';
    try {
      const r = await fetch(`http://localhost:3000/api/memory/search?q=${encodeURIComponent(q)}&limit=6`);
      const d = await r.json();
      _renderFacts(d.hits || []);
    } catch(e) { _renderEmpty('Suche fehlgeschlagen'); }
  }

  function _renderFacts(facts) {
    const list = document.getElementById('mw-facts-list');
    if (!list) return;
    if (!facts.length) { _renderEmpty('Noch keine Fakten'); return; }
    list.innerHTML = '';
    facts.forEach(f => {
      const item = document.createElement('div');
      item.className = 'fact-item';
      const ts = f.timestamp ? new Date(f.timestamp).toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '';
      item.innerHTML = `<span class="fact-cat">[${f.category || f.layer || '?'}]</span>${_esc(f.text || '')}` + (ts ? `<span class="fact-ts">${ts}${f.score != null ? ' · ' + f.score : ''}</span>` : '');
      list.appendChild(item);
    });
    _factCount = Math.max(_factCount, facts.length);
    const badge = document.getElementById('mw-badge');
    if (badge) badge.textContent = _factCount + ' Fakt' + (_factCount !== 1 ? 'en' : '');
  }

  function _renderEmpty(msg) {
    const list = document.getElementById('mw-facts-list');
    if (list) list.innerHTML = `<div class="mw-empty">${_esc(msg)}</div>`;
  }

  function _esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  window.addEventListener('oc:fact-learned', () => {
    _factCount++;
    const badge = document.getElementById('mw-badge');
    if (badge) badge.textContent = _factCount + ' Fakten';
    if (_isOpen && !_searchMode) _showLatest();
  });

  function _init() {
    _mount();
    fetch('http://localhost:3000/api/memory/vector-status')
      .then(r => r.json())
      .then(d => { const el = document.getElementById('mw-db-mode'); if (el) el.textContent = 'mode: ' + (d.ready ? 'vector' : 'json'); })
      .catch(() => {});
  }

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', _init) : _init();
})();
