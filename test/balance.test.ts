import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { summarize } from '../tools/simulate';

describe('balance', () => {
  const n = CONTENT.ranks.length;
  it('правильная стратегия: каждый босс ≥ 60% с первого раза, два последних ≤ 95%, промоушен ≥ 50%', () => {
    const s = summarize(CONTENT.ranks, 'best', 'weakness', 300);
    s.bosses.forEach((b, k) => {
      expect(b.firstTryWin, b.boss).toBeGreaterThanOrEqual(0.6);
      if (k >= n - 2) expect(b.firstTryWin, b.boss).toBeLessThanOrEqual(0.95); // ранние боссы могут браться в 100% — это дизайн
    });
    expect(s.promotionRate).toBeGreaterThanOrEqual(0.5);
  });
  it('случайная стратегия: промоушен ≤ 40%, первый босс ≥ 30%, последний ≤ 20%', () => {
    const s = summarize(CONTENT.ranks, 'random', 'random', 300);
    expect(s.promotionRate).toBeLessThanOrEqual(0.4);
    expect(s.bosses[0]!.firstTryWin).toBeGreaterThanOrEqual(0.3);
    expect(s.bosses[n - 1]!.firstTryWin).toBeLessThanOrEqual(0.2);
  });
  it('бой при слабости длится 3–9 ходов', () => {
    const s = summarize(CONTENT.ranks, 'best', 'weakness', 300);
    for (const b of s.bosses) { expect(b.avgTurns, b.boss).toBeGreaterThanOrEqual(3); expect(b.avgTurns, b.boss).toBeLessThanOrEqual(9); }
  });
});
