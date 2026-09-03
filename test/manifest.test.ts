import { statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import manifestJson from '../assets/manifest.json';
import { CONTENT } from '../src/content';
import type { AssetKind, Manifest } from '../src/types';

const manifest = manifestJson as Manifest;

describe('manifest', () => {
  it('id уникальны', () => {
    const ids = manifest.entries.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('dependsOn ссылаются на существующие id', () => {
    const ids = new Set(manifest.entries.map(e => e.id));
    for (const e of manifest.entries) for (const d of e.dependsOn ?? []) expect(ids.has(d), `${e.id} → ${d}`).toBe(true);
  });
  it('в графе dependsOn нет циклов', () => {
    const byId = new Map(manifest.entries.map(e => [e.id, e]));
    const state = new Map<string, 'visiting' | 'done'>();
    const path: string[] = [];
    const visit = (id: string) => {
      if (state.get(id) === 'done') return;
      expect(state.get(id), `цикл: ${[...path, id].join(' → ')}`).not.toBe('visiting');
      state.set(id, 'visiting');
      path.push(id);
      for (const d of byId.get(id)?.dependsOn ?? []) visit(d);
      path.pop();
      state.set(id, 'done');
    };
    for (const e of manifest.entries) visit(e.id);
  });
  it('сгенерированные файлы существуют и укладываются в бюджет размера', () => {
    // бюджет в килобайтах на файл: спрайты и портреты режутся по альфе, фоны и иллюстрации — webp
    const budgetKb: Record<AssetKind, number> = { sprite: 150, portrait: 80, background: 300, illustration: 300, music: 400, voice: 40 };
    for (const e of manifest.entries) {
      if (!e.generated) continue;
      // file в манифесте — путь относительно public/ (значения уже начинаются с "assets/")
      const rel = e.file.startsWith('assets/') ? e.file : `assets/${e.file}`;
      const full = path.join('public', rel);
      const st = statSync(full); // бросит ENOENT, если сгенерированного файла нет
      expect(st.size / 1024, `${e.id} (${full})`).toBeLessThanOrEqual(budgetKb[e.kind]);
    }
  });
  it('все id из контента и героя есть в манифесте', () => {
    const ids = new Set(manifest.entries.map(e => e.id));
    const need: string[] = ['sp_hero_idle', 'sp_hero_attack', 'sp_hero_hurt', 'sp_hero_win', 'pt_hero_neutral', 'il_title'];
    for (const r of CONTENT.ranks) {
      need.push(r.background, ...Object.values(r.boss.sprites), ...Object.values(r.boss.portraits));
      for (const ev of r.events) { need.push(ev.speaker.portrait); for (const c of ev.choices) if (c.reaction) need.push(c.reaction.portrait); }
    }
    for (const e of Object.values(CONTENT.endings)) need.push(e.illustration);
    for (const id of need) expect(ids.has(id), id).toBe(true);
  });
});
