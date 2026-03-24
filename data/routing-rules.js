// ─── innovooClaw · data/routing-rules.js ─────────────────────────────────────
// Zentrales Routing: resolveAgent(text, currentAgent?) → { agentId, channel, reason, method }

const _AR = (typeof AgentRegistry !== 'undefined')
  ? AgentRegistry
  : (() => { try { return require('./agent-registry').AgentRegistry; } catch(e) { return null; } })();

const _OUTBOUND = [
  // fromAgent, pattern, target (channel), reason, priority
  { from:'otto',     pattern:/\b(wetter|temperatur|regen|vorhersage|°c)\b/i,             target:'fitness',     reason:'Wetter → VERA',            priority:5  },
  { from:'otto',     pattern:/\b(€|euro|geld|kosten|rechnung|abo|budget|konto)\b/i,      target:'finanzen',    reason:'Finanzfrage → MINA',        priority:10 },
  { from:'otto',     pattern:/\b(schlaf|hrv|puls|sport|training|schwimm|garmin)\b/i,     target:'fitness',     reason:'Gesundheit → VERA',         priority:10 },
  { from:'otto',     pattern:/\b(vertrag|nda|dsgvo|agb|kündigung|impressum|anwalt)\b/i,  target:'recht',       reason:'Rechtsthema → LEO',         priority:8  },
  { from:'otto',     pattern:/\b(angebot|cold.?mail|akquise|pitch|linkedin|sales)\b/i,   target:'sales',       reason:'Sales → SAM',               priority:8  },
  { from:'otto',     pattern:/\b(code|bugfix|refactor|npm|deploy|feature|patch)\b/i,     target:'entwicklung', reason:'Entwicklung → CLEO',        priority:8  },
  { from:'otto',     pattern:/\b(shelly|pv|solar|einspeisung|wallbox|eigenverbrauch)\b/i,target:'energie',     reason:'Energie → SHELLYEM',        priority:7  },
  { from:'vera',     pattern:/\b(termin|kalender|mail|aufgabe|erinnerung)\b/i,            target:'leben',       reason:'Terminplanung → OTTO',      priority:10 },
  { from:'vera',     pattern:/\b(€|euro|kosten|rechnung|abo|budget)\b/i,                 target:'finanzen',    reason:'Finanzfrage → MINA',        priority:10 },
  { from:'mina',     pattern:/\b(termin|kalender|mail|aufgabe|erinnerung)\b/i,            target:'leben',       reason:'Terminplanung → OTTO',      priority:10 },
  { from:'mina',     pattern:/\b(schlaf|hrv|puls|sport|training|garmin)\b/i,             target:'fitness',     reason:'Gesundheit → VERA',         priority:10 },
  { from:'leo',      pattern:/\b(€|euro|rechnung|steuernummer|mwst|budget)\b/i,          target:'finanzen',    reason:'Rechnungsfrage → MINA',     priority:10 },
  { from:'leo',      pattern:/\b(termin|frist|kalender|deadline)\b/i,                    target:'leben',       reason:'Terminplanung → OTTO',      priority:10 },
  { from:'leo',      pattern:/\b(angebot|pitch|akquise|cold.?mail)\b/i,                  target:'sales',       reason:'Angebotserstellung → SAM',  priority:10 },
  { from:'sam',      pattern:/\b(stundensatz|€|euro|rechnung|budget|mwst)\b/i,           target:'finanzen',    reason:'Preiskontrolle → MINA',     priority:10 },
  { from:'sam',      pattern:/\b(termin|kalender|call|meeting|slot)\b/i,                  target:'leben',       reason:'Call-Slot → OTTO',          priority:10 },
  { from:'sam',      pattern:/\b(vertrag|agb|nda|haftung|datenschutz)\b/i,               target:'recht',       reason:'Vertragsprüfung → LEO',     priority:10 },
  { from:'cleo',     pattern:/\b(€|euro|api.?kosten|budget|tokens|preis)\b/i,            target:'finanzen',    reason:'API-Kosten → MINA',         priority:10 },
  { from:'shellyem', pattern:/\b(€|euro|kosten|amortisation|rendite|ersparnis)\b/i,      target:'finanzen',    reason:'Energiekosten → MINA',      priority:10 },
  { from:'shellyem', pattern:/\b(termin|wartung|kalender|erinnerung|service)\b/i,        target:'leben',       reason:'Wartungstermin → OTTO',     priority:10 },
];

const _INBOUND_KEYWORDS = [
  { agentId:'vera',     pattern:/\b(wetter|temperatur|regen|vorhersage|°c|vvs|s-bahn|u-bahn|bus|abfahrt|verbindung|haltestelle|öpnv|fahrplan|schlaf|hrv|puls|sport|training|schwimm|garmin|fitness|gesundheit)\b/i },
  { agentId:'mina',     pattern:/\b(€|euro|geld|kosten|rechnung|abo|budget|ausgabe|sparen|konto|zahlung|steuer|transaktion|kontostand)\b/i },
  { agentId:'leo',      pattern:/\b(vertrag|nda|dsgvo|agb|kündigung|impressum|abmahnung|compliance|datenschutz|anwalt|haftung|lizenz|urheberrecht)\b/i },
  { agentId:'sam',      pattern:/\b(angebot|cold.?mail|akquise|linkedin|pitch|follow.?up|kampagne|marketing|leads|verkauf|sales|stundensatz)\b/i },
  { agentId:'cleo',     pattern:/\b(code|bugfix|refactor|npm|deploy|feature|patch|entwicklung|programmier|api.?endpunkt|architektur|javascript|python|typescript)\b/i },
  { agentId:'shellyem', pattern:/\b(shelly|pv|photovoltaik|solar|einspeisung|nulleinspeisung|wallbox|eigenverbrauch|3em|watt|kilowatt|strom.einspeis)\b/i },
  { agentId:'react',    pattern:/\b(recherche|analyse|suche|untersuche|vergleiche|finde heraus|wer ist|was ist|neueste|aktuell)\b/i },
];

const routingRules = _OUTBOUND.map(r => ({
  fromAgent: r.from, pattern: r.pattern, target: r.target, reason: r.reason, priority: r.priority || 10,
}));

function resolveAgent(text, currentAgent) {
  if (!text) return _defaultResult();
  const lo = text.toLowerCase().trim();

  // 1. @-Präfix
  const prefixMatch = lo.match(/^@?(otto|mina|vera|leo|sam|cleo|shellyem|react)\s*[:{]/i);
  if (prefixMatch) {
    const agentId = prefixMatch[1].toLowerCase();
    return _toResult(agentId, `@${agentId.toUpperCase()}: Präfix`, 'prefix');
  }

  // 2. Inbound-Keyword (Spezialisten haben Vorrang)
  for (const entry of _INBOUND_KEYWORDS) {
    if (entry.pattern.test(lo)) return _toResult(entry.agentId, `Keyword: ${entry.agentId}`, 'keyword');
  }

  // 3. Outbound vom aktuellen Agent
  if (currentAgent) {
    const rules = _OUTBOUND.filter(r => r.from === currentAgent).sort((a, b) => (a.priority||99) - (b.priority||99));
    for (const rule of rules) {
      if (rule.pattern.test(lo)) {
        const agentId = _channelToAgent(rule.target);
        if (agentId) return _toResult(agentId, rule.reason, 'outbound');
      }
    }
  }

  return _defaultResult();
}

function _toResult(agentId, reason, method) {
  const agent   = _AR ? _AR.get(agentId) : null;
  const channel = agent?.channel || agentId;
  return { agentId, channel, reason, method };
}
function _defaultResult() { return { agentId: 'otto', channel: 'leben', reason: 'Default-Agent', method: 'default' }; }
function _channelToAgent(channelName) {
  if (!_AR) return null;
  const found = _AR.all().find(a => a.channel === channelName || a.id === channelName);
  return found ? found.id : null;
}

if (typeof module !== 'undefined' && module.exports) module.exports = { routingRules, resolveAgent };
