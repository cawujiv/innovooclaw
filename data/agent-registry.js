// ─── innovooClaw · data/agent-registry.js ────────────────────────────────────
// SINGLE SOURCE OF TRUTH für alle Agent-Definitionen.
// Neue Agents: Eintrag hier + entsprechende .md-Datei in /skills/ anlegen.

const AGENTS = {
  otto:     { id:'otto',     name:'OTTO',     label:'OTTO',     icon:'🧠', color:'#ff6b2b', channel:'leben',       role:'orchestrator', skillFile:'skills/OTTO.md',     fallbackPromptKey:'otto',     description:'Persönlicher KI-Lebens-Assistent und Chef-Orchestrator', liveDataSources:['kalender','drive','wetter','vvs'],         tools:['gmailRead','gmailSend','driveList','driveSearch','driveRead','driveUpload','saveFact','gcalRead','agentsRead','webFetch','cronAdd','vvsVerbindung','vvsAbfahrten','delegateToAgent'], dangerousTools:[], delegates:['mina','vera','leo','sam','cleo','shellyem','react'] },
  vera:     { id:'vera',     name:'VERA',     label:'VERA',     icon:'💪', color:'#f472b6', channel:'fitness',     role:'specialist',   skillFile:'skills/VERA.md',     fallbackPromptKey:'vera',     description:'KI-Gesundheits- und Reise-Agentin',              liveDataSources:['garmin','garmin_swim','apple_health','wetter','vvs'], tools:['vvsVerbindung','vvsAbfahrten','garminSleep','garminHrv','garminSteps','browserFetch','saveFact','driveList','driveSearch','driveRead','delegateToAgent'], dangerousTools:['garminReset'], delegates:['otto','mina'] },
  mina:     { id:'mina',     name:'MINA',     label:'MINA',     icon:'💰', color:'#00e5a0', channel:'finanzen',    role:'specialist',   skillFile:'skills/MINA.md',     fallbackPromptKey:'mina',     description:'KI-Finanz-Agentin',                              liveDataSources:['finanzen','drive'],                         tools:['driveList','driveSearch','driveRead','driveUpload','driveAppend','gmailRead','saveFact','recallMemory','delegateToAgent'], dangerousTools:['driveDelete'], delegates:['otto','vera'] },
  leo:      { id:'leo',      name:'LEO',      label:'LEO',      icon:'⚖️', color:'#a78bfa', channel:'recht',       role:'specialist',   skillFile:'skills/LEO.md',      fallbackPromptKey:'leo',      description:'KI-Rechts-Agent',                                liveDataSources:['drive'],                                   tools:['driveList','driveSearch','driveRead','driveUpload','delegateToAgent'],                                                       dangerousTools:['driveDelete'], delegates:['otto','mina','sam','cleo','shellyem'] },
  sam:      { id:'sam',      name:'SAM',      label:'SAM',      icon:'🚀', color:'#fb923c', channel:'sales',       role:'specialist',   skillFile:'skills/SAM.md',      fallbackPromptKey:'sam',      description:'KI-Sales- & Marketing-Agent',                    liveDataSources:['drive'],                                   tools:['driveList','driveSearch','driveRead','driveUpload','saveFact','delegateToAgent'],                                             dangerousTools:[], delegates:['otto','mina','shellyem'] },
  cleo:     { id:'cleo',     name:'CLEO',     label:'CLEO',     icon:'💻', color:'#38bdf8', channel:'entwicklung', role:'specialist',   skillFile:'skills/CLEO.md',     fallbackPromptKey:'cleo',     description:'Autonome KI-Entwicklungs-Agentin',               liveDataSources:['drive'],                                   tools:['driveList','driveSearch','driveRead','driveUpload','saveFact','delegateToAgent'],                                             dangerousTools:['driveUpload'], delegates:['otto','mina','shellyem'] },
  shellyem: { id:'shellyem', name:'SHELLYEM', label:'SHELLYEM', icon:'⚡', color:'#facc15', channel:'energie',     role:'specialist',   skillFile:'skills/SHELLYEM.md', fallbackPromptKey:'shellyem', description:'KI-Energie-Agent – Shelly Pro 3EM & PV-Optimierung', liveDataSources:[],                                          tools:['shellyStatus','shellyPower','shellyScene','shellySwitch','shellyHistory','webFetch','saveFact','delegateToAgent','cronAdd'],   dangerousTools:['shellySwitch','shellyScene'], delegates:['otto','mina'] },
  react:    { id:'react',    name:'REACT',    label:'REACT',    icon:'🔭', color:'#a78bfa', channel:'react',       role:'specialist',   skillFile:'skills/REACT.md',    fallbackPromptKey:'react',    description:'Autonomer Recherche-Agent (ReAct-Muster)',        liveDataSources:['drive'],                                   tools:['webFetch','browserFetch','driveUpload','driveSearch','driveRead','saveFact','delegateToAgent'],                               dangerousTools:[], delegates:['otto','shellyem','mina','vera'] },
};

const AgentRegistry = {
  all()              { return Object.values(AGENTS); },
  get(id)            { return AGENTS[id.toLowerCase()] || null; },
  ids()              { return Object.keys(AGENTS); },
  getByChannel(ch)   { return Object.values(AGENTS).find(a => a.channel === ch) || null; },
  getOrchestrator()  { return Object.values(AGENTS).find(a => a.role === 'orchestrator') || null; },
  getDangerousTools(id) { return AGENTS[id.toLowerCase()]?.dangerousTools || []; },
  getSkillFile(id)   { return AGENTS[id.toLowerCase()]?.skillFile || null; },
  getLiveDataSources(id) { return AGENTS[id.toLowerCase()]?.liveDataSources || []; },

  getChannelConfig() {
    const config = {};
    for (const agent of Object.values(AGENTS)) {
      config[agent.channel] = { agent: agent.id, label: agent.label, icon: agent.icon, color: agent.color, title: `# ${agent.channel}`, desc: agent.description };
    }
    return config;
  },

  getRoutingRules() {
    // Routing-Regeln werden aus routing-rules.js geladen – hier nur Struktur
    return [];
  },
};

if (typeof module !== 'undefined' && module.exports) module.exports = { AGENTS, AgentRegistry };
if (typeof window !== 'undefined') { window.AgentRegistry = AgentRegistry; window.AGENTS = AGENTS; }
