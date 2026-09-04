import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { summarize } from '../tools/simulate';

describe('balance', () => {
  const n = CONTENT.ranks.length;
  // одна симуляция на describe: summarize сеет rng заново, повторный вызов дал бы те же числа
  const best = summarize(CONTENT.ranks, 'best', 'weakness', 300);
  it('правильная стратегия: каждый босс ≥ 60% с первого раза, два последних снимают 45–90 уверенности, промоушен ≥ 50%', () => {
    const s = best;
    s.bosses.forEach((b, k) => {
      expect(b.firstTryWin, b.boss).toBeGreaterThanOrEqual(0.6);
      // Ранние боссы могут браться в 100% — это дизайн. Для двух последних угроза измеряется не долей
      // поражений (при стрессе 0 босс с атакой ≤ 16 физически не снимает 100 за T − 1 ответов), а ожидаемым
      // поглощённым уроном по формуле спеки: (T − 1) × 1.125 × (attack + stress × 0.05) в окне 45–90
      // (нижняя планка была 60; опущена 2026-09-04 вместе со смягчением финала 190/15 → 160/14, см. тест «худшие события»).
      if (k >= n - 2) {
        const boss = CONTENT.ranks[k]!.boss;
        const absorbed = (b.avgTurns - 1) * 1.125 * (boss.attack + b.avgStress * 0.05);
        const why = `${b.boss} absorbed=${absorbed.toFixed(1)} turns=${b.avgTurns.toFixed(2)} attack=${boss.attack} stress=${b.avgStress.toFixed(1)}`;
        expect(absorbed, why).toBeGreaterThanOrEqual(45);
        expect(absorbed, why).toBeLessThanOrEqual(90);
      }
    });
    expect(s.promotionRate).toBeGreaterThanOrEqual(0.5);
  });
  it('случайная стратегия: промоушен ≤ 40%, первый босс ≥ 30%, последний ≤ 20%', () => {
    const s = summarize(CONTENT.ranks, 'random', 'random', 300);
    expect(s.promotionRate).toBeLessThanOrEqual(0.4);
    expect(s.bosses[0]!.firstTryWin).toBeGreaterThanOrEqual(0.3);
    expect(s.bosses[n - 1]!.firstTryWin).toBeLessThanOrEqual(0.2);
  });
  it('худшие события + слабость: каждый босс ≥ 80% с первого раза, промоушен ≥ 85%', () => {
    // Игрок, который в событиях всегда выбирает стресс и минус к статам, но в бою бьёт по слабости,
    // всё равно должен проходить игру: статы решают запас, а не саму возможность победить.
    const s = summarize(CONTENT.ranks, 'worst', 'weakness', 300);
    for (const b of s.bosses) expect(b.firstTryWin, b.boss).toBeGreaterThanOrEqual(0.8);
    expect(s.promotionRate).toBeGreaterThanOrEqual(0.85);
  });
  it('Fatality достижима намеренно ослабленными ходами у финального босса', () => {
    const s = summarize(CONTENT.ranks, 'best', 'fatality', 300);
    expect(s.fatalityRate).toBeGreaterThanOrEqual(0.9);
  });
  it('бой при слабости длится 3–9 ходов', () => {
    const s = best;
    for (const b of s.bosses) { expect(b.avgTurns, b.boss).toBeGreaterThanOrEqual(3); expect(b.avgTurns, b.boss).toBeLessThanOrEqual(9); }
  });
});
