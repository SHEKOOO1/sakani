import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = 'H:/sakani';
const API_DIR = path.join(ROOT, 'src/backend/api');
const SERVER = path.join(ROOT, 'server.ts');

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listFiles(p));
    else if (e.name.endsWith('.ts')) out.push(p);
  }
  return out;
}

// map router alias -> mount prefix from server.ts
const serverSrc = fs.readFileSync(SERVER, 'utf8');
const mountMap = new Map<string, string>();
for (const m of serverSrc.matchAll(/app\.use\(\s*"([^"]+)",\s*(\w+)\s*\)/g)) {
  mountMap.set(m[2], m[1]);
}
const importAlias = new Map<string, string>();
for (const m of serverSrc.matchAll(/import\s+(\w+)\s+from\s+"[^"]*api\/([^"\']+)"/g)) {
  importAlias.set(m[2].replace(/\.ts$/, ''), m[1]);
}
console.log('MOUNTMAP=[' + [...mountMap.entries()].map(e => e.join('=')).join(' ') + ']');
console.log('ALIASES=[' + [...importAlias.entries()].map(e => e.join('=')).join(' ') + ']');

type Route = { method: string; full: string; file: string };
const routes: Route[] = [];

for (const file of listFiles(API_DIR)) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  const src = fs.readFileSync(file, 'utf8');
  // file -> alias lookup: importAlias keyed by path relative to api/ without .ts
  const keyCandidates = [rel.replace(/^src\/backend\/api\//, '').replace(/\.ts$/, '')];
  let mount = '';
  if (rel.startsWith('src/backend/api/students/')) mount = '/api/students';
  for (const k of keyCandidates) {
    const alias = importAlias.get(k);
    if (alias && mountMap.has(alias)) { mount = mountMap.get(alias)!; break; }
  }
  for (const m of src.matchAll(/router\.(get|post|put|patch|delete)\(\s*["'`]([^"'`]+[^"'`]?)/g)) {
    const p = m[2].trim();
    let full = (mount + p).replace(/\/+/g, '/');
    full = full.replace(/\(\\d\+\)/g, '').replace(/\([^)]*\)/g, '');
    routes.push({ method: m[1].toUpperCase(), full, file: rel });
  }
}
// server-level routes
for (const m of serverSrc.matchAll(/app\.(get|post|put|patch|delete)\(\s*"([^"]+)"/g)) {
  if (m[2].startsWith('/api')) routes.push({ method: m[1].toUpperCase(), full: m[2].replace(/\/+/g, '/'), file: 'server.ts' });
}

const sorted = [...new Set(routes.map(r => r.method + ' ' + r.full))].sort();

// ---------- FRONTEND ----------
const FRONT_DIRS = ['H:/sakani/src'];
const skipRe = /(backend|test|node_modules|dist)/;
const fpaths: string[] = [];
const fseen = new Set<string>();
function frontFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!skipRe.test(e.name)) out.push(...frontFiles(p)); }
    else if (/\.(ts|tsx|js|jsx|vue)$/.test(e.name)) out.push(p);
  }
  return out;
}
for (const f of frontFiles(FRONT_DIRS[0])) {
  const src = fs.readFileSync(f, 'utf8');
  const re = /["'`]([^"'`]*\/(?:api|uploads)\/[^"'`]*)["'`]/g;
  let mm;
  while ((mm = re.exec(src))) {
    let p = mm[1].trim();
    if (!/^\/(api|uploads)\//.test(p)) continue;
    p = p.replace(/\$\{[^}]*\}/g, '*').split('?')[0].replace(/\/+/g, '/');
    if (!fseen.has(p)) { fseen.add(p); fpaths.push(p + '  <= ' + f.replace(/\\/g, '/').replace(ROOT + '/', '')); }
  }
}

// ---------- MATCHING ----------
function normSegs(p: string) {
  return p.split('/').filter(Boolean);
}
function matches(tmpl: string, call: string): boolean {
  const a = normSegs(tmpl), b = normSegs(call);
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const t = a[i];
    if (t.startsWith(':')) continue;
    if (t === '*') continue;
    if (t.endsWith('*')) { if (!b[i].startsWith(t.slice(0, -1))) return false; continue; }
    if (t !== b[i]) return false;
  }
  return true;
}

console.log('BACKEND ROUTE COUNT: ' + sorted.length);
console.log('FRONTEND API-CALL PATHS: ' + fpaths.length);
console.log('--- BACKEND ROUTES (unique) ---');
for (const r of sorted) console.log('  ' + r);

const unmatched: string[] = [];
for (const fp of fpaths) {
  const call = fp.split('  <=')[0];
  if (call === '/uploads') continue;
  const hit = sorted.some(r => matches(r.split(' ')[1], call));
  if (!hit) unmatched.push(fp);
}
console.log('--- UNMATCHED FRONTEND PATHS (' + unmatched.length + ') ---');
for (const u of unmatched) console.log('  ' + u);