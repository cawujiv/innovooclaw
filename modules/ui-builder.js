/**
 * innovooClaw · modules/ui-builder.js  v1.0
 * Liest die geladenen Skills und baut ALLE dynamischen UI-Bereiche auf.
 */

'use strict';

const UIBuilder = (() => {
  const TOOL_ICONS = { driveList:'📂',driveSearch:'🔍',driveRead:'📄',driveUpload:'⬆️',driveDelete:'🗑️',saveFact:'🧠',gcalRead:'📅',agentsRead:'🤖',nordigenBalance:'🏦',nordigenTransactions:'💳',nordigenTransfer:'💸',vvsVerbindung:'🚌',vvsAbfahrten:'🕐',garminSleep:'💤',garminHrv:'❤️',garminSteps:'👟',garminReset:'🔄' };
  const PALETTE    = ['#ff6b2b','#00e5a0','#f472b6','#a78bfa','#fb923c','#38bdf8','#4ade80','#f87171'];

  function hexToRgb(hex) {
    const c = (hex||'').replace(/['"#]/g,'');
    if (c.length < 6) return '107,138,255';
    const r=parseInt(c.substr(0,2),16), g=parseInt(c.substr(2,2),16), b=parseInt(c.substr(4,2),16);
    return isNaN(r)?'107,138,255':`${r},${g},${b}`;
  }
  function agentColor(meta, i) { return (meta.color||PALETTE[i%PALETTE.length]).replace(/['"]/g,''); }
  function sortAgents(entries) {
    return [...entries].sort(([,a],[,b])=>{
      if(a.meta?.role==='orchestrator') return -1;
      if(b.meta?.role==='orchestrator') return 1;
      return 0;
    });
  }

  function build(skills) {
    if (!skills||typeof document==='undefined') return;
    const agents = sortAgents(Object.entries(skills).filter(([,s])=>s.meta?.agent&&s.meta?.channel));
    if (!agents.length) { console.warn('[UIBuilder] Keine Agenten'); return; }
    _injectCssVars(agents);
    _buildArchSlackChannels(agents);
    _buildArchAgents(agents);
    _buildSidebar(agents);
    _buildAgentCards(agents);
    _buildMatrix(agents);
    _updateTopbar(agents);
    _syncChannelConfig(agents);
    _syncRendererMeta(agents);
    console.log(`%c[UIBuilder] ${agents.length} Agents: ${agents.map(([,s])=>s.meta.name).join(' · ')}`, 'color:#6ee7b7;font-weight:bold');
  }

  function _injectCssVars(agents) {
    const root=document.documentElement;
    agents.forEach(([key,skill],i)=>{
      const hex=agentColor(skill.meta,i),rgb=hexToRgb(hex);
      root.style.setProperty(`--agent-${key}`,hex);
      root.style.setProperty(`--agent-${key}-rgb`,rgb);
    });
    if(agents[0]) root.style.setProperty('--accent-a',agentColor(agents[0][1].meta,0));
    if(agents[1]) root.style.setProperty('--accent-b',agentColor(agents[1][1].meta,1));
    if(agents[2]) root.style.setProperty('--accent-c',agentColor(agents[2][1].meta,2));
  }

  function _buildArchSlackChannels(agents) {
    const el=document.getElementById('arch-slack-channels');
    if(el) el.innerHTML=agents.map(([,s])=>`#${s.meta.channel}`).join('<br>');
  }

  function _buildArchAgents(agents) {
    const c=document.getElementById('arch-agents');
    if(!c) return;
    c.innerHTML='';
    agents.forEach(([key,skill],i)=>{
      const meta=skill.meta,hex=agentColor(meta,i),rgb=hexToRgb(hex);
      const desc=(meta.description||'').split('–')[1]?.trim().split(',')[0]?.trim()||'';
      const row=document.createElement('div');
      row.className='agent-row';
      row.innerHTML=`<div class="arrow-line" style="--color:${hex}"></div><div class="agent-chip" style="background:rgba(${rgb},0.08);border-color:rgba(${rgb},0.4);" onclick="switchChannel('${meta.channel}')"><div class="chip-icon">${meta.icon||'🤖'}</div><div class="chip-name" style="color:${hex}">${meta.name||key.toUpperCase()}</div><div class="chip-desc">${desc}</div></div><div class="arrow-back" style="--color:${hex}"></div>`;
      c.appendChild(row);
    });
  }

  function _buildSidebar(agents) {
    const c=document.getElementById('sidebar-channels');
    if(!c) return;
    c.innerHTML='';
    agents.forEach(([key,skill],i)=>{
      const meta=skill.meta,hex=agentColor(meta,i);
      const item=document.createElement('div');
      item.className='sidebar-item'+(i===0?' active':'');
      item.id='ch-'+meta.channel;
      item.setAttribute('onclick',`switchChannel('${meta.channel}')`);
      item.innerHTML=`<span class="ch-dot" style="background:${hex}"></span><span class="ch-name"># ${meta.channel}</span>`;
      c.appendChild(item);
    });
    c.insertAdjacentHTML('beforeend',`<div class="sidebar-item" id="ch-banking" onclick="typeof openBankingFeed==='function'&&openBankingFeed()"><span class="ch-dot" style="background:#00e5a0"></span><span class="ch-name" style="font-size:.72rem">🏦 banking-feed</span></div>`);
  }

  function _buildAgentCards(agents) {
    const grid=document.getElementById('agents-grid');
    if(!grid) return;
    const label=document.getElementById('agents-section-label');
    if(label) label.textContent=`Die ${agents.length} Agents im Detail`;
    const cols=agents.length<=2?agents.length:agents.length<=4?2:3;
    grid.style.gridTemplateColumns=`repeat(${cols},1fr)`;
    grid.innerHTML='';
    agents.forEach(([key,skill],i)=>{
      const meta=skill.meta,hex=agentColor(meta,i),rgb=hexToRgb(hex);
      const caps=(meta.capabilities||[]).slice(0,6).map(cap=>`<li style="display:flex;align-items:flex-start;gap:8px;font-size:.82rem;color:var(--text);line-height:1.5"><span style="width:6px;height:6px;border-radius:50%;background:${hex};flex-shrink:0;margin-top:6px;display:block"></span>${cap}</li>`).join('');
      const tools=(meta.tools||[]).map(t=>`<span style="display:inline-flex;align-items:center;gap:4px;font-family:'Space Mono',monospace;font-size:.6rem;padding:3px 9px;border-radius:100px;border:1px solid rgba(${rgb},.35);color:${hex};background:rgba(${rgb},.07)">${TOOL_ICONS[t]||'🔧'} ${t}</span>`).join('');
      const danger=(meta.dangerous_tools||[]).length?`<div style="margin-top:12px;padding:7px 12px;border-radius:8px;background:rgba(251,146,60,.07);border:1px solid rgba(251,146,60,.25);font-family:'Space Mono',monospace;font-size:.6rem;color:#fb923c">⚠️ Destruktive Tools brauchen OTTO-Freigabe</div>`:'';
      const card=document.createElement('div');
      card.className='agent-card'; card.style.cursor='pointer';
      card.setAttribute('onclick',`switchChannel('${meta.channel}')`);
      card.addEventListener('mouseenter',()=>{card.style.transform='translateY(-4px)';card.style.boxShadow=`0 8px 32px rgba(${rgb},.15)`;});
      card.addEventListener('mouseleave',()=>{card.style.transform='';card.style.boxShadow='';});
      card.innerHTML=`<div class="agent-card-header"><div style="width:52px;height:52px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:1.6rem;background:rgba(${rgb},.15);flex-shrink:0">${meta.icon||'🤖'}</div><div class="agent-meta"><div class="agent-name">${meta.name||key.toUpperCase()}</div><div style="color:${hex};font-family:'Space Mono',monospace;font-size:.68rem;margin-top:1px">/${key}</div></div></div><div class="agent-card-body"><ul class="capability-list" style="gap:8px">${caps}</ul><div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border);display:flex;flex-wrap:wrap;gap:5px">${tools}</div>${danger}</div>`;
      grid.appendChild(card);
    });
  }

  // ── Matrix: interaktiv mit Toggle-Buttons ───────────────────────────────────
  let _matrixOverrides = {};  // cache { agentId: string[] }

  async function loadMatrixOverrides() {
    try {
      const r = await fetch('/api/tool-overrides');
      if (!r.ok) return;
      const data = await r.json();
      _matrixOverrides = {};
      for (const [id, info] of Object.entries(data)) {
        _matrixOverrides[id] = info.effectiveTools || [];
      }
    } catch(e) { console.warn('[UIBuilder] tool-overrides laden fehlgeschlagen:', e.message); }
  }

  async function toggleTool(agentId, toolName, btn) {
    const current = _matrixOverrides[agentId] || [];
    const hasIt   = current.includes(toolName);
    const updated = hasIt ? current.filter(t => t !== toolName) : [...current, toolName];
    btn.style.opacity = '0.5';
    try {
      const r = await fetch(`/api/agents/${agentId}/tools`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tools: updated }),
      });
      if (!r.ok) { const e = await r.json(); alert(`Fehler: ${e.error}`); btn.style.opacity='1'; return; }
      _matrixOverrides[agentId] = updated;
      _updateMatrixCell(btn, agentId, toolName, updated);
    } catch(e) { alert('Netzwerkfehler: ' + e.message); btn.style.opacity='1'; }
  }

  function _updateMatrixCell(btn, agentId, toolName, tools) {
    const td = btn.closest('td');
    const agents = Object.entries(window.__matrixAgents || {});
    const agentEntry = agents.find(([k]) => k === agentId);
    const danger = agentEntry?.[1]?.meta?.dangerous_tools || [];
    const active = tools.includes(toolName);
    td.innerHTML = _matrixCellHtml(agentId, toolName, active, danger.includes(toolName));
  }

  function _matrixCellHtml(agentId, toolName, active, isDanger) {
    if (!active) {
      return `<span class="perm-none perm-toggle" style="cursor:pointer;opacity:.5" title="Aktivieren" onclick="window.__uiToggle('${agentId}','${toolName}',this)">—</span>`;
    }
    if (isDanger) {
      return `<span class="perm-read perm-toggle" style="background:rgba(251,146,60,.1);color:#fb923c;border-color:rgba(251,146,60,.3);cursor:pointer" title="Deaktivieren" onclick="window.__uiToggle('${agentId}','${toolName}',this)">⚠️</span>`;
    }
    return `<span class="perm-full perm-toggle" style="cursor:pointer" title="Deaktivieren" onclick="window.__uiToggle('${agentId}','${toolName}',this)">✓</span>`;
  }

  function _buildMatrix(agents) {
    const thead=document.getElementById('matrix-head'),tbody=document.getElementById('matrix-body');
    if(!thead||!tbody) return;

    // Agent-Map global für Toggle-Callback speichern
    window.__matrixAgents = Object.fromEntries(agents);
    window.__uiToggle = (agentId, toolName, btn) => toggleTool(agentId, toolName, btn);

    thead.innerHTML=`<tr><th>Tool</th>${agents.map(([key,skill],i)=>{
      const hex=agentColor(skill.meta,i);
      return `<th style="color:${hex}" title="${skill.meta.description||''}"><span style="font-size:.75em;opacity:.6">${skill.meta.icon||'🤖'}</span> ${skill.meta.name||key.toUpperCase()}</th>`;
    }).join('')}</tr>`;

    // Alle bekannten Tools (Registry-Basis) als Union
    const allTools=[...new Set(agents.flatMap(([,s])=>s.meta?.tools||[]))];

    // Overrides laden und Matrix rendern
    loadMatrixOverrides().then(() => {
      tbody.innerHTML=allTools.map(tool=>{
        const cells=agents.map(([key,skill])=>{
          const effectiveTools = _matrixOverrides[key] || skill.meta?.tools || [];
          const danger = skill.meta?.dangerous_tools || [];
          const active = effectiveTools.includes(tool);
          return `<td>${_matrixCellHtml(key, tool, active, danger.includes(tool))}</td>`;
        }).join('');
        return `<tr><td><div class="resource-name">${TOOL_ICONS[tool]||'🔧'} ${tool}</div></td>${cells}</tr>`;
      }).join('');

      // Legende ergänzen falls noch nicht vorhanden
      let legend = document.getElementById('matrix-legend');
      if (!legend) {
        const container = tbody.closest('table')?.parentElement;
        if (container) {
          legend = document.createElement('div');
          legend.id = 'matrix-legend';
          legend.style.cssText = 'margin-top:12px;font-family:Space Mono,monospace;font-size:.65rem;color:#5a5a7a;display:flex;gap:20px;align-items:center';
          legend.innerHTML = '<span>✓ = aktiv (klicken zum Deaktivieren)</span><span>— = inaktiv (klicken zum Aktivieren)</span><span>⚠️ = nur mit OTTO-Freigabe</span><span style="margin-left:auto;color:#ff6b2b">⚡ Änderungen wirken sofort ohne Neustart</span>';
          container.appendChild(legend);
        }
      }
    });
  }

  function _updateTopbar(agents) {
    const el=document.getElementById('chat-members-count');
    if(el) el.textContent=`${agents.length} Agents · 1 Nutzer`;
  }

  function _syncChannelConfig(agents) {
    if(typeof channelConfig==='undefined') return;
    agents.forEach(([key,skill],i)=>{
      const meta=skill.meta,hex=agentColor(meta,i),ch=meta.channel||key;
      channelConfig[ch]={agent:key,label:meta.name||key.toUpperCase(),icon:meta.icon||'🤖',color:hex,title:`# ${ch}`,desc:(meta.description||'').split('–')[1]?.trim().split(',')[0]?.trim()||meta.description||''};
    });
  }

  function _syncRendererMeta(agents) {
    if(typeof agentMeta==='undefined') return;
    const slots=['a','b','c','d','e','f','g','h'];
    agents.forEach(([key,skill],i)=>{
      const meta=skill.meta,hex=agentColor(meta,i),rgb=hexToRgb(hex),slot=slots[i]||'a';
      agentMeta[key]={name:meta.name||key.toUpperCase(),cls:`avatar-${slot}`,icon:meta.icon||'🤖',color:hex,rgb};
      const styleId=`__avatar-dyn-${slot}`;
      if(!document.getElementById(styleId)){const s=document.createElement('style');s.id=styleId;s.textContent=`.avatar-${slot}{background:rgba(${rgb},.2);border:1px solid rgba(${rgb},.4)}`;document.head.appendChild(s);}
    });
  }

  return { build, hexToRgb, agentColor };
})();

if(typeof module!=='undefined'&&module.exports) module.exports=UIBuilder;
