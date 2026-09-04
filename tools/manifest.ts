import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AssetEntry, AssetKind, Manifest } from '../src/types';

export const MANIFEST_PATH = resolve(process.cwd(), 'assets/manifest.json');
export const PUBLIC_ASSETS = resolve(process.cwd(), 'public/assets');
export const RAW_DIR = resolve(process.cwd(), 'assets/raw');

export const KIND_BUDGET_KB: Record<AssetKind, number> = {
  sprite: 150, portrait: 80, background: 300, illustration: 300, music: 400, voice: 40,
};

export function readManifest(path = MANIFEST_PATH): Manifest {
  return JSON.parse(readFileSync(path, 'utf8')) as Manifest;
}

export function writeManifest(m: Manifest, path = MANIFEST_PATH): void {
  writeFileSync(path, JSON.stringify(m, null, 2) + '\n');
}

export function publicPath(e: AssetEntry): string {
  return resolve(PUBLIC_ASSETS, e.file);
}

export function rawPath(e: AssetEntry): string {
  const ext = e.kind === 'music' || e.kind === 'voice' ? 'mp3' : 'png';
  return resolve(RAW_DIR, `${e.id}.${ext}`);
}

export function topoSort(entries: AssetEntry[]): AssetEntry[] {
  const byId = new Map(entries.map(e => [e.id, e]));
  const state = new Map<string, 'visiting' | 'done'>();
  const out: AssetEntry[] = [];
  const visit = (id: string, path: string[]) => {
    const st = state.get(id);
    if (st === 'done') return;
    if (st === 'visiting') throw new Error(`dependency cycle: ${[...path, id].join(' → ')}`);
    const e = byId.get(id);
    if (!e) throw new Error(`unknown dependency "${id}" (from ${path[path.length - 1] ?? '?'})`);
    state.set(id, 'visiting');
    for (const d of e.dependsOn ?? []) visit(d, [...path, id]);
    state.set(id, 'done');
    out.push(e);
  };
  for (const e of entries) visit(e.id, []);
  return out;
}
