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
  // запись без промпта и без файла ещё не заказана (персонажи следующих этапов) —
  // это не «потеря», а отложенная работа: считаем её отдельно, чтобы missing означал
  // «промпт есть, а файла нет» и был настоящим сигналом
  const status = has ? 'ok' : e.prompt.trim() === '' ? 'deferred' : 'missing';
  return { id: e.id, kind: e.kind, group: e.group, generated: e.generated, raw: existsSync(rawPath(e)), file: has, status, kb: Math.round(kb), over };
});
console.table(rows);
const missing = rows.filter(r => r.status === 'missing');
const deferred = rows.filter(r => r.status === 'deferred');
const overBudget = rows.filter(r => r.over);
const total = rows.reduce((s, r) => s + r.kb, 0);
console.log(`total ${rows.length}, generated ${rows.filter(r => r.file).length}, missing ${missing.length}, deferred ${deferred.length}, over budget ${overBudget.length}, bad paths ${badPaths}, size ${(total / 1024).toFixed(1)} MB`);
if (missing.length) console.log('missing:', missing.map(r => r.id).join(', '));
if (deferred.length) console.log('deferred:', deferred.map(r => r.id).join(', '));
// падаем только на том, что чинится правкой манифеста или перегенерацией:
// битый путь и превышение бюджета. Ненаписанные ассеты — нормальное состояние работы.
if (badPaths > 0 || overBudget.length > 0) process.exitCode = 1;
