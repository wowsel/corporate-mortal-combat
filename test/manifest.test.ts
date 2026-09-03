import { describe, expect, it } from 'vitest';
import manifestJson from '../assets/manifest.json';
import { CONTENT } from '../src/content';
import type { Manifest } from '../src/types';

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
