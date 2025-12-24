const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// Paths within the workspace
const ROOT_DIR = path.join(__dirname, '..');
const TXT_PATH = path.join(ROOT_DIR, 'uso_cluster.txt');
const JSON_PATH = path.join(ROOT_DIR, 'uso_cluster.json');
const LAST_JSON_PATH = path.join(ROOT_DIR, 'uso_cluster_last.json');
const NODE_CONF_PATH = path.join(ROOT_DIR, 'node_configuration.json');
const PY_SCRIPT_PATH = path.join(ROOT_DIR, 'scripts', 'uso_cluster_to_json.py');

function normalizeType(t) {
  if (!t) return null;
  const s = String(t).trim().toUpperCase();
  if (s === 'A30' || s === 'A40' || s === 'A100') return s;
  // Accept lowercase keys from JSON (a30/a40/a100)
  const u = String(t).trim().toLowerCase();
  if (u === 'a30') return 'A30';
  if (u === 'a40') return 'A40';
  if (u === 'a100') return 'A100';
  return null;
}

function parseTimestampToMs(ts) {
  // Example: "Wed Dec 24 14:57:01 2025"
  if (!ts || typeof ts !== 'string') return 0;
  const months = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
  };
  const m = ts.trim().match(/^[A-Za-z]{3}\s+([A-Za-z]{3})\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})\s+(\d{4})$/);
  if (!m) {
    const d = Date.parse(ts);
    return Number.isFinite(d) ? d : 0;
  }
  const mon = months[m[1].toLowerCase()];
  const day = parseInt(m[2], 10);
  const hh = parseInt(m[3], 10);
  const mm = parseInt(m[4], 10);
  const ss = parseInt(m[5], 10);
  const yyyy = parseInt(m[6], 10);
  const dt = new Date(yyyy, mon, day, hh, mm, ss);
  return dt.getTime();
}

function getTotalCapacityFromNodeConfig() {
  if (!fs.existsSync(NODE_CONF_PATH)) {
    throw new Error(`Missing node configuration: ${NODE_CONF_PATH}`);
  }
  const raw = fs.readFileSync(NODE_CONF_PATH, 'utf8');
  const conf = JSON.parse(raw);
  const gpuType = conf && conf.gpuType ? conf.gpuType : {};

  const totals = { A30: 0, A40: 0, A100: 0 };
  for (const key of Object.keys(gpuType)) {
    const norm = normalizeType(key);
    if (!norm) continue;
    const nodes = gpuType[key] && gpuType[key].nodes ? gpuType[key].nodes : {};
    const sum = Object.values(nodes).reduce((acc, v) => acc + Number(v || 0), 0);
    totals[norm] += sum;
  }
  return totals;
}

function getNodeCapacitiesFromNodeConfig() {
  if (!fs.existsSync(NODE_CONF_PATH)) {
    throw new Error(`Missing node configuration: ${NODE_CONF_PATH}`);
  }
  const raw = fs.readFileSync(NODE_CONF_PATH, 'utf8');
  const conf = JSON.parse(raw);
  const gpuType = conf && conf.gpuType ? conf.gpuType : {};

  const byNode = { A30: {}, A40: {}, A100: {} };
  for (const key of Object.keys(gpuType)) {
    const norm = normalizeType(key);
    if (!norm) continue;
    const nodes = gpuType[key] && gpuType[key].nodes ? gpuType[key].nodes : {};
    for (const nodeName of Object.keys(nodes)) {
      const cap = Number(nodes[nodeName] || 0);
      byNode[norm][nodeName] = cap;
    }
  }
  return byNode;
}

function computeUsageFromJson(jsonObj) {
  if (!jsonObj || typeof jsonObj !== 'object') return { used: { A30: 0, A40: 0, A100: 0 }, timestamp: null };
  const timestamps = Object.keys(jsonObj);
  if (timestamps.length === 0) return { used: { A30: 0, A40: 0, A100: 0 }, timestamp: null };
  // Select latest timestamp by parsed date
  let latest = timestamps[0];
  let latestMs = parseTimestampToMs(latest);
  for (const ts of timestamps.slice(1)) {
    const ms = parseTimestampToMs(ts);
    if (ms >= latestMs) { latestMs = ms; latest = ts; }
  }

  const snapshot = jsonObj[latest] || {};
  const used = { A30: 0, A40: 0, A100: 0 };
  for (const user of Object.keys(snapshot)) {
    const byType = snapshot[user];
    if (!byType || typeof byType !== 'object') continue;
    for (const typeKey of Object.keys(byType)) {
      const norm = normalizeType(typeKey);
      if (!norm) continue;
      const jobs = byType[typeKey];
      if (!jobs || typeof jobs !== 'object') continue;
      for (const jid of Object.keys(jobs)) {
        const rec = jobs[jid];
        const n = Number(rec && rec.gpu_number != null ? rec.gpu_number : 0);
        if (Number.isFinite(n) && n > 0) used[norm] += n;
      }
    }
  }
  return { used, timestamp: latest };
}

function expandNodelist(nodelist) {
  if (!nodelist || typeof nodelist !== 'string') return [];
  const s = nodelist.trim();
  if (!s) return [];
  if (s.includes('[') && s.includes(']')) {
    const m = s.match(/^(.*)\[(.*)\](.*)$/);
    if (!m) return [s];
    const prefix = m[1];
    const inner = m[2];
    const suffix = m[3];
    const parts = inner.split(',').map(p => p.trim()).filter(Boolean);
    const out = [];
    for (const p of parts) {
      const range = p.match(/^(\d+)-(\d+)$/);
      if (range) {
        const start = parseInt(range[1], 10);
        const end = parseInt(range[2], 10);
        const width = range[1].length;
        const step = start <= end ? 1 : -1;
        for (let i = start; step > 0 ? i <= end : i >= end; i += step) {
          const num = String(i).padStart(width, '0');
          out.push(`${prefix}${num}${suffix}`);
        }
      } else if (/^\d+$/.test(p)) {
        out.push(`${prefix}${p}${suffix}`);
      } else {
        out.push(`${prefix}${p}${suffix}`);
      }
    }
    return out;
  }
  return s.split(',').map(x => x.trim()).filter(Boolean);
}

function computeUsageByNodeFromJson(jsonObj) {
  if (!jsonObj || typeof jsonObj !== 'object') return { usedByNode: { A30: {}, A40: {}, A100: {} }, timestamp: null };
  const timestamps = Object.keys(jsonObj);
  if (timestamps.length === 0) return { usedByNode: { A30: {}, A40: {}, A100: {} }, timestamp: null };
  let latest = timestamps[0];
  let latestMs = parseTimestampToMs(latest);
  for (const ts of timestamps.slice(1)) {
    const ms = parseTimestampToMs(ts);
    if (ms >= latestMs) { latestMs = ms; latest = ts; }
  }
  const snapshot = jsonObj[latest] || {};
  const usedByNode = { A30: {}, A40: {}, A100: {} };
  for (const user of Object.keys(snapshot)) {
    const byType = snapshot[user];
    if (!byType || typeof byType !== 'object') continue;
    for (const typeKey of Object.keys(byType)) {
      const norm = normalizeType(typeKey);
      if (!norm) continue;
      const jobs = byType[typeKey];
      if (!jobs || typeof jobs !== 'object') continue;
      for (const jid of Object.keys(jobs)) {
        const rec = jobs[jid];
        const n = Number(rec && rec.gpu_number != null ? rec.gpu_number : 0);
        const nl = rec && rec.nodelist ? String(rec.nodelist).trim() : '';
        if (!Number.isFinite(n) || n <= 0 || !nl) continue;
        const nodes = expandNodelist(nl);
        const target = nodes.length > 0 ? nodes[0] : null;
        if (!target) continue;
        const cur = usedByNode[norm][target] || 0;
        usedByNode[norm][target] = cur + n;
      }
    }
  }
  return { usedByNode, timestamp: latest };
}

function getPythonCandidates() {
  const list = [];
  if (process.platform === 'win32') {
    list.push(process.env.PYTHON || 'python');
    list.push('py');
    list.push('python3');
  } else {
    list.push(process.env.PYTHON || 'python3');
    list.push('python');
  }
  return list;
}

function tryGenerateJson(preferLast = false) {
  if (!fs.existsSync(PY_SCRIPT_PATH) || !fs.existsSync(TXT_PATH)) return null;
  const pyCandidates = getPythonCandidates();
  const args = [PY_SCRIPT_PATH, '--input', TXT_PATH, '--output', preferLast ? LAST_JSON_PATH : JSON_PATH];
  if (preferLast) args.push('--last');
  for (const exe of pyCandidates) {
    const r = spawnSync(exe, args, { encoding: 'utf8' });
    if (r && r.status === 0) {
      const outPath = preferLast ? LAST_JSON_PATH : JSON_PATH;
      if (fs.existsSync(outPath)) return outPath;
    }
  }
  return null;
}

function readJsonWithTroubleshooter() {
  // Prefer existing full JSON
  if (fs.existsSync(JSON_PATH)) {
    try {
      const raw = fs.readFileSync(JSON_PATH, 'utf8');
      return { obj: JSON.parse(raw), source: 'uso_cluster.json' };
    } catch (_) { /* fall through */ }
  }
  // Try generating full JSON
  const genFull = tryGenerateJson(false);
  if (genFull && fs.existsSync(genFull)) {
    try {
      const raw = fs.readFileSync(genFull, 'utf8');
      return { obj: JSON.parse(raw), source: path.basename(genFull) };
    } catch (_) { /* fall through */ }
  }
  // Try generating last snapshot JSON for speed
  const genLast = tryGenerateJson(true);
  if (genLast && fs.existsSync(genLast)) {
    try {
      const raw = fs.readFileSync(genLast, 'utf8');
      return { obj: JSON.parse(raw), source: path.basename(genLast) };
    } catch (_) { /* fall through */ }
  }
  // Final fallback: compute usage from TXT directly (last block)
  if (fs.existsSync(TXT_PATH)) {
    try {
      const content = fs.readFileSync(TXT_PATH, 'utf8');
      const used = getLastBlockGPUCounts(content);
      return { obj: null, source: 'uso_cluster.txt (fallback)', usedFallback: used };
    } catch (_) { /* fall through */ }
  }
  throw new Error('Unable to read or generate cluster usage JSON. Ensure uso_cluster.txt exists and Python is available.');
}

// Legacy TXT parser used as fallback only
function getLastBlockGPUCounts(fileContent) {
  const lines = fileContent.trim().split('\n').filter(line => line.trim());
  let lastTsIdx = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].includes('JOBID') && i > 0) { lastTsIdx = i - 1; break; }
  }
  const startIndex = lastTsIdx >= 0 ? lastTsIdx + 2 : 0;
  const gpuCounts = { A30: 0, A40: 0, A100: 0 };
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('JOBID')) continue;
    // Skip obvious timestamp lines (day-of-week prefixes)
    if (/^[A-Za-z]{3}\s+[A-Za-z]{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\s+\d{4}/.test(line)) continue;
    const columns = line.split(/\s{2,}/);
    if (columns.length < 4) continue;
    const tresAlloc = columns[2];
    const gpuRegex = /gres\/gpu:(\w+)=(\d+)/g;
    let match;
    while ((match = gpuRegex.exec(tresAlloc)) !== null) {
      const gpuType = normalizeType(match[1]);
      const count = parseInt(match[2], 10);
      if (gpuType && Number.isFinite(count)) gpuCounts[gpuType] += count;
    }
  }
  return gpuCounts;
}

/**
 * Returns GPU availability summary using uso_cluster JSON and node configuration.
 * Troubleshoots missing JSON by attempting generation from TXT, falling back to TXT parse.
 * @returns {{A30:{total:number, used:number, available:number}, A40:{total:number, used:number, available:number}, A100:{total:number, used:number, available:number}, timestamp:string|null, source:string}}
 */
function getGpuUsage() {
  const totals = getTotalCapacityFromNodeConfig();
  const nodeCaps = getNodeCapacitiesFromNodeConfig();
  const { obj, source, usedFallback } = readJsonWithTroubleshooter();

  let used = { A30: 0, A40: 0, A100: 0 };
  let timestamp = null;
  let usedByNode = { A30: {}, A40: {}, A100: {} };
  if (obj) {
    const { used: u, timestamp: ts } = computeUsageFromJson(obj);
    const byNodeRes = computeUsageByNodeFromJson(obj);
    used = u; timestamp = ts || null; usedByNode = byNodeRes.usedByNode;
  } else if (usedFallback) {
    used = usedFallback;
    timestamp = null;
  }

  const byNode = { A30: {}, A40: {}, A100: {} };
  for (const type of ['A30', 'A40', 'A100']) {
    const caps = nodeCaps[type] || {};
    const usedNodes = usedByNode[type] || {};
    for (const nodeName of Object.keys(caps)) {
      const total = Number(caps[nodeName] || 0);
      const u = Number(usedNodes[nodeName] || 0);
      byNode[type][nodeName] = {
        total,
        used: u,
        available: Math.max(0, total - u)
      };
    }
  }

  const result = {
    A30: { total: totals.A30, used: used.A30, available: Math.max(0, totals.A30 - used.A30) },
    A40: { total: totals.A40, used: used.A40, available: Math.max(0, totals.A40 - used.A40) },
    A100: { total: totals.A100, used: used.A100, available: Math.max(0, totals.A100 - used.A100) },
    byNode,
    timestamp,
    source
  };
  return result;
}

module.exports = { getGpuUsage };