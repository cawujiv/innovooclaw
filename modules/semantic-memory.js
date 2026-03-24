// ─── innovooClaw · modules/semantic-memory.js ────────────────────────────────
// Semantisches Gedächtnis – Pfad auf innovooClaw angepasst.
'use strict';

const fs    = require('fs');
const path  = require('path');
const https = require('https');

const MEM_DIR       = process.env.MEMORY_DIR
  || path.join(require('os').homedir(), 'Documents', 'MCP-DATA', 'innovooClaw', 'memory');
const VECTORS_FILE  = path.join(MEM_DIR, 'semantic-vectors.json');
const SEMANTIC_FILE = path.join(MEM_DIR, 'semantic.json');

function readJson(p, def={}) { try { return fs.existsSync(p)?JSON.parse(fs.readFileSync(p,'utf-8')):def; } catch{return def;} }
function writeJson(p, d) { if(!fs.existsSync(MEM_DIR)) fs.mkdirSync(MEM_DIR,{recursive:true}); fs.writeFileSync(p,JSON.stringify(d,null,2),'utf-8'); }

function cosineSim(a,b) {
  if(!a||!b||a.length!==b.length) return 0;
  let dot=0,na=0,nb=0;
  for(let i=0;i<a.length;i++){dot+=a[i]*b[i];na+=a[i]*a[i];nb+=b[i]*b[i];}
  const d=Math.sqrt(na)*Math.sqrt(nb);
  return d===0?0:dot/d;
}

function kwVec(text) {
  const words=text.toLowerCase().replace(/[^a-zäöüß0-9\s]/g,' ').split(/\s+/).filter(w=>w.length>2);
  const freq={};
  for(const w of words) freq[w]=(freq[w]||0)+1;
  return freq;
}

function kwSim(a,b) {
  const ka=Object.keys(a); if(!ka.length) return 0;
  const sb=new Set(Object.keys(b));
  let m=0; for(const k of ka) if(sb.has(k)) m++;
  const u=new Set([...ka,...Object.keys(b)]).size;
  return u===0?0:m/u;
}

async function embedText(text) {
  const key=process.env.VOYAGE_API_KEY||''; if(!key) return null;
  return new Promise(resolve=>{
    const body=JSON.stringify({input:[text.slice(0,4000)],model:'voyage-3-lite'});
    const req=https.request({hostname:'api.voyageai.com',path:'/v1/embeddings',method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`}},(res)=>{
      let d=''; res.on('data',c=>d+=c); res.on('end',()=>{try{const j=JSON.parse(d);resolve(j?.data?.[0]?.embedding||null);}catch{resolve(null);}});
    });
    req.on('error',()=>resolve(null)); req.setTimeout(8000,()=>{req.destroy();resolve(null);}); req.write(body); req.end();
  });
}

const SemanticMemory = {
  async store(kategorie, schluessel, wert) {
    const text=`${kategorie} ${schluessel}: ${wert}`;
    const semantic=readJson(SEMANTIC_FILE,{});
    if(!semantic[kategorie]) semantic[kategorie]={};
    semantic[kategorie][schluessel]=wert;
    writeJson(SEMANTIC_FILE,semantic);
    const vectors=readJson(VECTORS_FILE,{entries:[]});
    if(!vectors.entries) vectors.entries=[];
    let embedding=null; try{embedding=await embedText(text);}catch{}
    const entry={id:`${kategorie}.${schluessel}`,kategorie,schluessel,wert,text,ts:new Date().toISOString(),embedding,keywords:kwVec(text)};
    const idx=vectors.entries.findIndex(e=>e.kategorie===kategorie&&e.schluessel===schluessel);
    if(idx>=0) vectors.entries[idx]=entry; else vectors.entries.push(entry);
    if(vectors.entries.length>500) vectors.entries=vectors.entries.slice(-500);
    writeJson(VECTORS_FILE,vectors);
    return entry;
  },
  async recall(query, limit=5) {
    const vectors=readJson(VECTORS_FILE,{entries:[]});
    if(!vectors.entries?.length) return [];
    let qEmb=null; try{qEmb=await embedText(query);}catch{}
    const qKw=kwVec(query);
    return vectors.entries.map(e=>({...e,score:qEmb&&e.embedding?cosineSim(qEmb,e.embedding):kwSim(qKw,e.keywords||{})}))
      .sort((a,b)=>b.score-a.score).slice(0,limit).filter(e=>e.score>0.05)
      .map(e=>({id:e.id,text:e.text,wert:e.wert,score:Math.round(e.score*100)/100}));
  },
  getFlat() { return readJson(SEMANTIC_FILE,{}); },
  stats() {
    const v=readJson(VECTORS_FILE,{entries:[]});
    const we=(v.entries||[]).filter(e=>e.embedding).length;
    return {total:(v.entries||[]).length,withEmbeddings:we,keywordOnly:(v.entries||[]).length-we,voyageKeySet:!!process.env.VOYAGE_API_KEY};
  },
};

module.exports = { SemanticMemory };
