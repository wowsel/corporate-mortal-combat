import { existsSync, statSync } from 'node:fs';
import { KIND_BUDGET_KB, publicPath, rawPath, readManifest } from './manifest';

const m = readManifest();
let badPaths = 0;
const rows = m.entries.map(e => {
  const pub = publicPath(e);
  const has = existsSync(pub);
  const kb = has ? statSync(pub).size / 1024 : 0;
  const over = has && kb > KIND_BUDGET_KB[e.kind];
  if (e.file.startsWith('/') || e.file.startsWith('assets/')) {
    console.log(`bad file path: ${e.id} ${e.file}`);
    badPaths++;
  }
  return { id: e.id, kind: e.kind, group: e.group, generated: e.generated, raw: existsSync(rawPath(e)), file: has, kb: Math.round(kb), over };
});
console.table(rows);
const missing = rows.filter(r => !r.file);
const total = rows.reduce((s, r) => s + r.kb, 0);
console.log(`total ${rows.length}, generated ${rows.filter(r => r.file).length}, missing ${missing.length}, over budget ${rows.filter(r => r.over).length}, bad paths ${badPaths}, size ${(total / 1024).toFixed(1)} MB`);
if (missing.length) console.log('missing:', missing.map(r => r.id).join(', '));
