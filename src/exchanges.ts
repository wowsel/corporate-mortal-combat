import { EXCHANGE_COUNT, LOOP_TAIL } from './battle';
import type { Boss, Exchange } from './types';

/** Детерминированный генератор (тот же, что в tools/simulate.ts): сид партии → порядок обменов. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

function shuffleRange<T>(arr: T[], from: number, to: number, rng: () => number): void {
  for (let i = to - 1; i > from; i--) {
    const j = from + Math.floor(rng() * (i - from + 1));
    const a = arr[i]!, b = arr[j]!;
    arr[i] = b; arr[j] = a;
  }
}

/**
 * Порядок обменов боя для данной партии. Первые `boss.fixedExchanges ?? 1` обменов стоят на месте
 * (открывающая реплика с намёком на слабость; у Китаны — нумерованные пункты договора), остальные
 * сюжетные обмены тасуются между собой, «давящий» хвост (последние LOOP_TAIL) — отдельно между собой:
 * он написан без порядка и должен оставаться хвостом, который бой крутит по кругу. Один сид + один босс
 * → один порядок: реванш идёт так же, новая партия — иначе.
 */
export function orderExchanges(boss: Boss, seed: number): Exchange[] {
  const out = boss.exchanges.slice();
  const rng = mulberry32((seed ^ hashId(boss.id)) >>> 0);
  const fixed = Math.min(boss.fixedExchanges ?? 1, out.length);
  const tail = Math.max(fixed, Math.min(out.length, EXCHANGE_COUNT - LOOP_TAIL));
  shuffleRange(out, fixed, tail, rng);
  shuffleRange(out, tail, out.length, rng);
  return out;
}
