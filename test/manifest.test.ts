import { existsSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import manifestJson from '../assets/manifest.json';
import { CONTENT } from '../src/content';
import type { AssetEntry, Manifest } from '../src/types';
import { KIND_BUDGET_KB, publicPath, topoSort } from '../tools/manifest';

const manifest = manifestJson as Manifest;

function collectContentAssetIds(): string[] {
  const ids: string[] = [];
  for (const r of CONTENT.ranks) {
    ids.push(r.background);
    for (const ev of r.events) { ids.push(ev.speaker.portrait); for (const c of ev.choices) if (c.reaction) ids.push(c.reaction.portrait); }
    ids.push(...Object.values(r.boss.sprites), ...Object.values(r.boss.portraits));
  }
  for (const e of Object.values(CONTENT.endings)) {
    ids.push(e.illustration);
    if (e.epilogue) ids.push(e.epilogue.portrait);
    for (const v of e.variants ?? []) if (v.epilogue) ids.push(v.epilogue.portrait);
  }
  ids.push('sp_hero_idle', 'sp_hero_attack', 'sp_hero_hurt', 'sp_hero_win', 'pt_hero_neutral', 'pt_hero_worried', 'il_title');
  return ids;
}

describe('manifest', () => {
  it('id уникальны', () => {
    const ids = manifest.entries.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('dependsOn и references-по-id ссылаются на существующие записи, циклов нет', () => {
    expect(() => topoSort(manifest.entries)).not.toThrow();
    const ids = new Set(manifest.entries.map(e => e.id));
    for (const e of manifest.entries) {
      for (const r of e.references ?? []) if (!r.includes('/')) {
        expect(ids.has(r), `${e.id} → ${r}`).toBe(true);
        expect(e.dependsOn ?? [], `${e.id}: reference ${r} must also be in dependsOn`).toContain(r);
      }
    }
  });
  it('каждый id из контента есть в манифесте', () => {
    const ids = new Set(manifest.entries.map(e => e.id));
    for (const id of collectContentAssetIds()) expect(ids.has(id), id).toBe(true);
  });
  it('у сгенерированных файл существует и укладывается в бюджет', () => {
    let total = 0;
    for (const e of manifest.entries.filter(e => e.generated)) {
      const p = publicPath(e);
      expect(existsSync(p), `${e.id}: ${p}`).toBe(true);
      const kb = statSync(p).size / 1024;
      total += kb;
      expect(kb, `${e.id} ${kb.toFixed(0)}KB > ${KIND_BUDGET_KB[e.kind]}KB`).toBeLessThanOrEqual(KIND_BUDGET_KB[e.kind]);
    }
    expect(total).toBeLessThanOrEqual(11.5 * 1024);
  });
  it('у спрайтов и портретов есть character и size, у аудио — duration', () => {
    for (const e of manifest.entries) {
      if (e.kind === 'sprite') { expect(e.character, e.id).toBeTruthy(); expect(e.size, e.id).toEqual([700, 900]); }
      if (e.kind === 'portrait') expect(e.size, e.id).toEqual([512, 512]);
      if (e.kind === 'background' || e.kind === 'illustration') expect(e.size, e.id).toEqual([1600, 900]);
      if (e.kind === 'music' || e.kind === 'voice') expect(typeof e.duration, e.id).toBe('number');
    }
  });
});

describe('topoSort', () => {
  const mk = (id: string, dependsOn?: string[]): AssetEntry => ({ id, kind: 'sprite', group: 'core', file: `${id}.webp`, model: 'm', prompt: 'p', generated: false, dependsOn });
  it('зависимости раньше зависимых', () => {
    const order = topoSort([mk('b', ['a']), mk('c', ['b']), mk('a')]).map(e => e.id);
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'));
    expect(order.indexOf('b')).toBeLessThan(order.indexOf('c'));
  });
  it('цикл — ошибка', () => expect(() => topoSort([mk('a', ['b']), mk('b', ['a'])])).toThrow(/cycle/));
  it('неизвестная зависимость — ошибка', () => expect(() => topoSort([mk('a', ['zzz'])])).toThrow(/zzz/));
});
