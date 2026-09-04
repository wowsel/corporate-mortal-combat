import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function loadEnv(root = process.cwd()): Record<string, string> {
  const out: Record<string, string> = {};
  const p = resolve(root, '.env');
  if (existsSync(p)) {
    for (const raw of readFileSync(p, 'utf8').split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq < 0) continue;
      const k = line.slice(0, eq).trim();
      let v = line.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      out[k] = v;
    }
  }
  return { ...out, ...Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined)) as Record<string, string> };
}

export function requireKey(): string {
  const key = loadEnv()['OPENROUTER_API_KEY'];
  if (!key) throw new Error('OPENROUTER_API_KEY не найден: положите его в .env в корне проекта (OPENROUTER_API_KEY=sk-or-...)');
  return key;
}
