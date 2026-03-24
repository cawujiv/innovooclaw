/**
 * innovooClaw · modules/memory.js  (Frontend-Browser-JS)
 * Gedächtnissystem – alle Lese-, Schreib- und Kontext-Funktionen.
 * Läuft im Browser, kommuniziert mit dem Proxy auf localhost:3000
 */

const memBase = "http://localhost:3000/api/memory";

let mem = { semantic: null, episodic: null, procedural: null, working: null };

async function memRead(file) {
  try {
    const r = await fetch(memBase + "/read?file=" + file);
    if (r.ok) { mem[file] = await r.json(); updateMemUI(); }
  } catch(e) { console.warn("[Memory] read:", file, e.message); }
  return mem[file];
}

async function memWrite(file, data) {
  try {
    await fetch(memBase + "/write?file=" + file, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data, null, 2)
    });
  } catch(e) { console.warn("[Memory] write:", file, e.message); }
}

async function loadAllMemory() {
  // Initialisierung (Proxy prüft ob Dateien existieren)
  try {
    const r = await fetch("http://localhost:3000/api/memory/init");
    if (r.ok) { const d = await r.json(); console.log("[Memory] Init:", d); }
  } catch(e) { console.warn("[Memory] Init:", e.message); }

  await Promise.all(["semantic", "episodic", "procedural"].map(f => memRead(f)));
  console.log("[Memory] Geladen:", Object.keys(mem).filter(k => mem[k]));
}

function updateMemUI() {
  const el = document.getElementById("mem-indicator");
  if (!el) return;
  const n = Object.values(mem).filter(Boolean).length;
  el.textContent = n >= 3 ? "🧠 Gedächtnis aktiv" : "🧠 " + n + "/3 geladen";
  el.style.color  = n >= 3 ? "var(--accent-b)" : "var(--accent-a)";
}

function buildMemCtx(agentKey) {
  let ctx = "";
  const s = mem.semantic, e = mem.episodic, p = mem.procedural;
  if (s) {
    ctx += "\n\nLIVE-DATEN:\n";
    if (s.wetter?.aktuell)            ctx += "Wetter: " + s.wetter.aktuell + "\n";
    if (s.kalender?.naechste_termine) ctx += "Termine: " + s.kalender.naechste_termine + "\n";
    if (s.finanzen?.kontostand)       ctx += "Kontostand: " + s.finanzen.kontostand + "\n";
    if (s.vvs?.abfahrten)             ctx += "VVS: " + s.vvs.abfahrten + "\n";
    ctx += "\nGEDAECHTNIS:\n";
    if (s.nutzer)   ctx += "Nutzer: "   + JSON.stringify(s.nutzer) + "\n";
    if (s.mina)     ctx += "Finanzen: " + JSON.stringify(s.mina)   + "\n";
  }
  if (e?.eintraege) {
    const relevant = e.eintraege.filter(i => i.agent === agentKey.toUpperCase()).slice(-6);
    if (relevant.length) {
      ctx += "\nLETZTE AKTIONEN:\n";
      relevant.forEach(i => { ctx += "- " + i.datum + " " + i.zeit + " " + i.aktion + "\n"; });
    }
  }
  if (p) {
    const rules = p[agentKey.toUpperCase()];
    if (rules?.length) {
      ctx += "\nREGELN:\n";
      rules.slice(0, 10).forEach(r => {
        const text = typeof r === "string" ? r : r.regel;
        ctx += "- " + text + "\n";
      });
    }
  }
  return ctx;
}

async function saveEpisode(agent, aktion, typ) {
  const data = mem.episodic || { eintraege: [] };
  if (!data.eintraege) data.eintraege = [];
  data.eintraege.push({
    datum: new Date().toISOString().split("T")[0],
    zeit:  new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
    agent: agent.toUpperCase(), typ: typ || "dialog", aktion
  });
  if (data.eintraege.length > 200) data.eintraege = data.eintraege.slice(-200);
  mem.episodic = data;
  await memWrite("episodic", data);
}

async function saveFact(kategorie, schluessel, wert) {
  const data = mem.semantic || {};
  if (!data[kategorie]) data[kategorie] = {};
  data[kategorie][schluessel] = wert;
  data[kategorie]._geaendert  = new Date().toISOString();
  mem.semantic = data;
  await memWrite("semantic", data);
}

async function saveRule(agent, regel, optionen = {}) {
  const data = mem.procedural || {};
  const key  = agent.toUpperCase();
  if (!Array.isArray(data[key])) data[key] = [];
  const texts = data[key].map(r => typeof r === "string" ? r : r.regel);
  if (!texts.includes(regel)) {
    data[key].push({ regel, quelle: optionen.quelle || "gelernt", prioritaet: optionen.prioritaet || "mittel", erstellt: new Date().toISOString().slice(0, 10) });
    mem.procedural = data;
    await memWrite("procedural", data);
  }
}

async function saveWorking(updates) {
  const base = mem.working || { session_start: new Date().toISOString(), nachrichten: 0 };
  Object.assign(base, updates);
  base.last_update = new Date().toISOString();
  mem.working = base;
  await memWrite("working", base);
}

function detectAndSavePreferences(userMessage) {
  const lo = userMessage.toLowerCase();
  const budgetM = lo.match(/budget\s*(?:von\s*)?([\d.]+)\s*€/);
  if (budgetM) saveFact("finanzziele", "budget_limit", budgetM[1] + " Euro");
  const poolM = lo.match(/(25|50)\s*m(?:eter)?\s*(?:bahn|becken|pool)/);
  if (poolM) saveFact("garmin_swim", "bahnlaenge", poolM[1] + "m");
}
