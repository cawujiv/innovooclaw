/**
 * innovooClaw · modules/skill-loader.js  v2.0
 * Lädt Agent-Skills aus /skills/*.md Dateien (YAML-Frontmatter + Prompt-Body).
 */
'use strict';

const SkillLoader = (() => {

  function parseFrontmatter(raw) {
    const meta = {};
    const lines = raw.split('\n');
    let currentKey = null, inArray = false, inObject = false, objectKey = null;
    for (const line of lines) {
      if (line.match(/^\s+-\s+(.+)/)) {
        const val = line.match(/^\s+-\s+(.+)/)[1].trim();
        if (currentKey && inArray) {
          if (!Array.isArray(meta[currentKey])) meta[currentKey] = [];
          meta[currentKey].push(parseScalar(val));
        }
        continue;
      }
      const indentedKv = line.match(/^\s{2,}(\w[\w_-]*):\s+(.*)/);
      if (indentedKv && inObject && objectKey) {
        if (typeof meta[objectKey] !== 'object' || Array.isArray(meta[objectKey])) meta[objectKey] = {};
        meta[objectKey][indentedKv[1]] = parseScalar(indentedKv[2].trim());
        continue;
      }
      const kvMatch = line.match(/^(\w[\w_-]*):\s*(.*)/);
      if (kvMatch) {
        currentKey = kvMatch[1];
        const rawVal = kvMatch[2].trim();
        inArray = false; inObject = false; objectKey = null;
        if (rawVal === '') {
          meta[currentKey] = []; inArray = true; inObject = true; objectKey = currentKey;
        } else if (rawVal.startsWith('[')) {
          meta[currentKey] = rawVal.replace(/[\[\]]/g, '').split(',').map(s => parseScalar(s.trim())).filter(Boolean);
        } else {
          meta[currentKey] = parseScalar(rawVal);
        }
      }
    }
    return meta;
  }

  function parseScalar(val) {
    if (val === 'true')  return true;
    if (val === 'false') return false;
    if (val !== '' && !isNaN(val)) return Number(val);
    return val.replace(/^['"]|['"]$/g, '');
  }

  function parseSkillFile(content, filename) {
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!fmMatch) {
      console.warn(`[SkillLoader] Kein Frontmatter in ${filename}`);
      return { meta: { name: filename.replace('.md',''), agent: filename.replace('.md','').toLowerCase() }, prompt: content.trim() };
    }
    const meta   = parseFrontmatter(fmMatch[1]);
    const prompt = fmMatch[2].trim();
    if (!meta.agent) meta.agent = filename.replace('.md','').toLowerCase();
    return { meta, prompt, filename };
  }

  async function loadAll(baseUrl = 'http://localhost:3000') {
    try {
    const res = await _apiFetch(`${baseUrl}/api/skills`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const skills = {};
      for (const [agentKey, skillData] of Object.entries(data)) {
        if (skillData.meta?.agent) skills[agentKey] = skillData;
      }
      console.log(`[SkillLoader] ${Object.keys(skills).length} Skills geladen:`, Object.keys(skills).join(', '));
      return skills;
    } catch(e) {
      console.warn('[SkillLoader] Fallback zu agent-prompts.js:', e.message);
      return null;
    }
  }

  function loadAllSync() {
    if (typeof require === 'undefined') return null;
    const fs   = require('fs');
    const path = require('path');
    const skillsDir = path.join(__dirname, '..', 'skills');
    if (!fs.existsSync(skillsDir)) return null;
    const skills = {};
    const files = fs.readdirSync(skillsDir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const content  = fs.readFileSync(path.join(skillsDir, file), 'utf8');
      const parsed   = parseSkillFile(content, file);
      const agentKey = (parsed.meta.agent || '').toLowerCase() || file.replace('.md','').toLowerCase();
      skills[agentKey] = parsed;
    }
    console.log(`[SkillLoader] ${files.length} Skills geladen:`, Object.keys(skills).join(', '));
    return skills;
  }

  async function reloadSkill(agentKey, baseUrl = 'http://localhost:3000') {
    try {
      const res = await _apiFetch(`${baseUrl}/api/skills/${agentKey}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch(e) {
      console.warn(`[SkillLoader] Reload fehlgeschlagen für ${agentKey}:`, e.message);
      return null;
    }
  }

  function resolveGroupAlias(alias, skills) {
    const orchestrator = Object.values(skills).find(s => s.meta?.role === 'orchestrator');
    if (!orchestrator) return null;
    const groups = orchestrator.meta.groups || {};
    const target  = groups[alias.toUpperCase()];
    return target ? target.toLowerCase() : null;
  }

  function isDangerousTool(toolName, agentKey, skills) {
    const dangerous = skills[agentKey]?.meta?.dangerous_tools || [];
    return Array.isArray(dangerous) && dangerous.includes(toolName);
  }

  function getSkillSummary(skills) {
    return Object.entries(skills).filter(([, s]) => s.meta?.agent).map(([key, s]) => ({
      agent: key, name: s.meta.name || key.toUpperCase(), version: s.meta.version || '?',
      description: s.meta.description || '', tools: s.meta.tools || [],
      delegates: s.meta.delegates || [], groups: s.meta.groups || {},
      dangerous_tools: s.meta.dangerous_tools || [], approval: s.meta.dangerous_tools_approval || null,
      role: s.meta.role || 'specialist', channel: s.meta.channel || key,
    }));
  }

  return { loadAll, loadAllSync, parseSkillFile, parseFrontmatter, getSkillSummary, reloadSkill, resolveGroupAlias, isDangerousTool };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = SkillLoader;
