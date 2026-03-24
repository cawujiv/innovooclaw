// ─── innovooClaw · modules/tool-definitions.js ───────────────────────────────
'use strict';

const TOOL_DEFINITIONS = {
  gmailRead:       { name: 'gmailRead',       description: 'Liest E-Mails aus dem Gmail-Posteingang.',           input_schema: { type: 'object', properties: { limit: { type: 'number', default: 10 }, q: { type: 'string', default: 'in:inbox' } }, required: [] } },
  gmailSend:       { name: 'gmailSend',        description: 'Sendet eine E-Mail (nur nach Bestätigung).',         input_schema: { type: 'object', properties: { an: { type: 'string' }, betreff: { type: 'string' }, text: { type: 'string' } }, required: ['an','betreff','text'] } },
  vvsVerbindung:   { name: 'vvsVerbindung',    description: 'ÖPNV-Verbindung via VVS Stuttgart.',                input_schema: { type: 'object', properties: { von: { type: 'string' }, nach: { type: 'string' }, zeit: { type: 'string' } }, required: ['von','nach'] } },
  vvsAbfahrten:    { name: 'vvsAbfahrten',     description: 'Nächste Abfahrten an VVS-Haltestelle.',             input_schema: { type: 'object', properties: { haltestelle: { type: 'string' } }, required: ['haltestelle'] } },
  wetterAktuell:   { name: 'wetterAktuell',    description: 'Wetter & 7-Tage-Vorhersage Stuttgart.',             input_schema: { type: 'object', properties: { stadt: { type: 'string', default: 'Stuttgart' } }, required: [] } },
  garminSleep:     { name: 'garminSleep',      description: 'Schlafdaten von Garmin Connect.',                   input_schema: { type: 'object', properties: { tage: { type: 'number', default: 1 } }, required: [] } },
  garminHrv:       { name: 'garminHrv',        description: 'HRV-Daten von Garmin Connect.',                     input_schema: { type: 'object', properties: { tage: { type: 'number', default: 7 } }, required: [] } },
  garminSteps:     { name: 'garminSteps',      description: 'Schritt- und Aktivitätsdaten von Garmin.',          input_schema: { type: 'object', properties: { tage: { type: 'number', default: 7 } }, required: [] } },
  webFetch:        { name: 'webFetch',         description: 'Lädt eine statische Webseite.',                     input_schema: { type: 'object', properties: { url: { type: 'string' }, maxlen: { type: 'number', default: 8000 } }, required: ['url'] } },
  browserFetch:    { name: 'browserFetch',     description: 'Lädt JS-gerenderte Webseite via Playwright.',       input_schema: { type: 'object', properties: { url: { type: 'string' }, waitFor: { type: 'string', default: 'networkidle' }, selector: { type: 'string' }, maxlen: { type: 'number', default: 15000 } }, required: ['url'] } },
  driveSearch:     { name: 'driveSearch',      description: 'Sucht Dateien in Google Drive.',                    input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
  driveRead:       { name: 'driveRead',        description: 'Liest Dateiinhalt aus Google Drive via ID.',        input_schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
  driveList:       { name: 'driveList',        description: 'Listet Dateien in Google Drive Unterordner.',       input_schema: { type: 'object', properties: { ordner: { type: 'string' }, limit: { type: 'number', default: 20 } }, required: [] } },
  driveUpload:     { name: 'driveUpload',      description: '⚠️ GEFÄHRLICH – OTTO-Freigabe nötig!',              input_schema: { type: 'object', properties: { dateiname: { type: 'string' }, inhalt: { type: 'string' }, ordner: { type: 'string', default: 'innovooClaw' } }, required: ['dateiname','inhalt'] } },
  saveFact:        { name: 'saveFact',         description: 'Speichert Faktum im semantischen Gedächtnis.',      input_schema: { type: 'object', properties: { kategorie: { type: 'string' }, schluessel: { type: 'string' }, wert: { type: 'string' } }, required: ['kategorie','schluessel','wert'] } },
  recallMemory:    { name: 'recallMemory',     description: 'Durchsucht semantisches Gedächtnis.',               input_schema: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'number', default: 5 } }, required: ['query'] } },
  shellyStatus:    { name: 'shellyStatus',     description: 'Online-Status Shelly Pro 3EM.',                     input_schema: { type: 'object', properties: {}, required: [] } },
  shellyPower:     { name: 'shellyPower',      description: 'Echtzeit-Leistungsdaten aller 3 Phasen.',           input_schema: { type: 'object', properties: {}, required: [] } },
  shellyHistory:   { name: 'shellyHistory',    description: 'Energie-Verlaufsdaten Shelly Pro 3EM (24h).',       input_schema: { type: 'object', properties: { zeitraum: { type: 'string', enum: ['today','week','month'], default: 'today' } }, required: [] } },
  shellySwitch:    { name: 'shellySwitch',     description: '⚠️ GEFÄHRLICH – OTTO-Freigabe! Schaltet Kanal.',    input_schema: { type: 'object', properties: { kanal: { type: 'string', enum: ['wallbox','pumpe','lueftung','verbraucher4'] }, status: { type: 'boolean' } }, required: ['kanal','status'] } },
  shellyScene:     { name: 'shellyScene',      description: '⚠️ GEFÄHRLICH – OTTO-Freigabe! Aktiviert Szene.',   input_schema: { type: 'object', properties: { szene: { type: 'string', enum: ['wallbox_start','wallbox_stop','pumpe_ein','pumpe_aus','lueftung_ein','lueftung_aus','alle_aus'] } }, required: ['szene'] } },
  delegateToAgent: { name: 'delegateToAgent',  description: 'Delegiert Aufgabe an Spezialisten-Agent.',          input_schema: { type: 'object', properties: { agent: { type: 'string', enum: ['mina','vera','leo','sam','cleo','shellyem','react'] }, message: { type: 'string' }, context: { type: 'string' } }, required: ['agent','message'] } },
  gcalRead:        { name: 'gcalRead',         description: 'Liest Google Calendar Termine.',                    input_schema: { type: 'object', properties: { zeitraum: { type: 'string', enum: ['today','week','weekend','next-week'], default: 'week' } }, required: [] } },
  agentsRead:      { name: 'agentsRead',       description: 'Liest die Agent-Übersicht.',                        input_schema: { type: 'object', properties: {}, required: [] } },
  cronAdd:         { name: 'cronAdd',          description: 'Fügt neuen CronJob hinzu.',                         input_schema: { type: 'object', properties: { name: { type: 'string' }, schedule: { type: 'string' }, action: { type: 'string' } }, required: ['name','schedule','action'] } },
  braveSearch:     { name: 'braveSearch',      description: 'Websuche via Brave Search API.',                    input_schema: { type: 'object', properties: { query: { type: 'string' }, count: { type: 'number', default: 5 } }, required: ['query'] } },
  kbSearch:        { name: 'kbSearch',         description: 'Semantische Suche in persönlicher Wissensbasis.',   input_schema: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'number', default: 6 } }, required: ['query'] } },
  browserTask:     { name: 'browserTask',      description: 'Mehrstufige Browser-Aufgaben via Chrome Relay.',    input_schema: { type: 'object', properties: { task: { type: 'string' }, maxSteps: { type: 'number', default: 12 } }, required: ['task'] } },
  telegramNotify:  { name: 'telegramNotify',   description: 'Sendet Benachrichtigung via Telegram.',             input_schema: { type: 'object', properties: { text: { type: 'string' }, silent: { type: 'boolean', default: false } }, required: ['text'] } },
};

function getToolsForAgent(toolNames) {
  return (toolNames || []).filter(name => TOOL_DEFINITIONS[name]).map(name => TOOL_DEFINITIONS[name]);
}

if (typeof module !== 'undefined' && module.exports) module.exports = { TOOL_DEFINITIONS, getToolsForAgent };
if (typeof window !== 'undefined') { window.TOOL_DEFINITIONS = TOOL_DEFINITIONS; window.getToolsForAgent = getToolsForAgent; }
