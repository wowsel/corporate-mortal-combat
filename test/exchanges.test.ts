import { describe, expect, it } from 'vitest';
import { orderExchanges } from '../src/exchanges';
import { CONTENT } from '../src/content';
import { makeBoss, makeExchanges } from './fixtures';

const boss = makeBoss({ id: 'shuffle', exchanges: makeExchanges(' [s]') });
const prompts = (seed: number, b = boss) => orderExchanges(b, seed).map(e => e.prompt);

describe('orderExchanges', () => {
  it('открывающий обмен на месте, состав тот же, хвост остаётся хвостом', () => {
    for (const seed of [1, 2, 3, 42, 1000]) {
      const p = prompts(seed);
      expect(p[0]).toBe(boss.exchanges[0]!.prompt);
      expect([...p].sort()).toEqual(boss.exchanges.map(e => e.prompt).sort());
      expect([...p.slice(5)].sort()).toEqual(boss.exchanges.slice(5).map(e => e.prompt).sort());
    }
  });
  it('один сид — один порядок, разные сиды дают разные порядки', () => {
    expect(prompts(42)).toEqual(prompts(42));
    const distinct = new Set([1, 2, 3, 4, 5, 6].map(s => prompts(s).join('|')));
    expect(distinct.size).toBeGreaterThan(1);
  });
  it('fixedExchanges держит начало по порядку', () => {
    const fixed = makeBoss({ id: 'fixed', exchanges: makeExchanges(' [f]'), fixedExchanges: 5 });
    for (const seed of [1, 2, 3]) expect(prompts(seed, fixed).slice(0, 5)).toEqual(fixed.exchanges.slice(0, 5).map(e => e.prompt));
  });
  it('Китана: пункты договора нумерованы, первые пять не тасуются', () => {
    const kitana = CONTENT.ranks.find(r => r.boss.id === 'kitana')!.boss;
    expect(kitana.fixedExchanges).toBe(5);
    expect(prompts(9, kitana).slice(0, 5)).toEqual(kitana.exchanges.slice(0, 5).map(e => e.prompt));
  });
  it('не трогает исходный массив босса', () => {
    const before = boss.exchanges.map(e => e.prompt);
    orderExchanges(boss, 3);
    expect(boss.exchanges.map(e => e.prompt)).toEqual(before);
  });
});
