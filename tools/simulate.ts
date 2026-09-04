import { availableMoves, createBattle, moveDamage, resolveTurn } from '../src/battle';
import { CONTENT } from '../src/content';
import { afterBattle, applyChoice, checkEnding, createInitialState, currentEvent, visibleChoices } from '../src/state';
import { pathToFileURL } from 'node:url';
import type { Boss, EndingId, GameState, Rank, Stats } from '../src/types';

export type EventStrategy = 'first' | 'random' | 'best';
// fatality: слабость везде, а у финального босса — подвести терпение в окно FINISH HIM и ударить
export type FightStrategy = 'weakness' | 'random' | 'neutral' | 'fatality';

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function pickChoice(state: GameState, choices: ReturnType<typeof visibleChoices>, strat: EventStrategy, rng: () => number) {
  if (strat === 'first') return choices[0]!;
  if (strat === 'random') return choices[Math.floor(rng() * choices.length)]!;
  // best: максимизируем сумму позитивных статов минус стресс
  return [...choices].sort((a, b) => score(b.effects) - score(a.effects))[0]!;
  function score(e?: Partial<Stats>) { if (!e) return 0; return (e.loyalty ?? 0) + (e.reputation ?? 0) + (e.competence ?? 0) - 2 * (e.stress ?? 0); }
}

function fight(state: GameState, boss: Boss, strat: FightStrategy, rng: () => number): { outcome: 'win' | 'lose' | 'fatality'; turns: number } {
  let b = createBattle(boss);
  for (let turn = 0; turn < 60; turn++) {
    const all = availableMoves(boss, b);
    const strike = all.find(m => m.move.id === 'strike' && m.enabled);
    if (strat === 'fatality' && strike) {
      resolveTurn(b, strike.move, state.stats, boss, rng);
      return { outcome: 'fatality', turns: turn + 1 };
    }
    const moves = all.filter(m => m.enabled && m.move.id !== 'strike').map(m => m.move);
    let move = moves[0]!;
    if (strat === 'weakness' || (strat === 'fatality' && !boss.final)) move = moves.find(m => m.id === boss.weakness) ?? move;
    else if (strat === 'fatality') {
      // самый сильный не-иммунный приём, который ещё не добивает; если добивает любой — самый слабый
      const ranked = moves.filter(m => m.id !== boss.immunity).sort((x, y) => moveDamage(y, state.stats, boss) - moveDamage(x, state.stats, boss));
      move = ranked.find(m => moveDamage(m, state.stats, boss) < b.patience) ?? ranked[ranked.length - 1]!;
    }
    else if (strat === 'random') move = moves[Math.floor(rng() * moves.length)]!;
    else move = moves.find(m => m.id !== boss.weakness && m.id !== boss.immunity) ?? move;
    const r = resolveTurn(b, move, state.stats, boss, rng);
    b = r.battle;
    if (r.outcome === 'win') return { outcome: 'win', turns: turn + 1 };
    if (r.outcome === 'lose') return { outcome: 'lose', turns: turn + 1 };
  }
  return { outcome: 'lose', turns: 60 };
}

export function simulateRun(ranks: Rank[], ev: EventStrategy, fs: FightStrategy, rng: () => number) {
  let s = createInitialState();
  const firstTry: boolean[] = [];
  const turns: number[] = [];
  const stressAtBoss: number[] = [];
  let defeats = 0;
  for (let guard = 0; guard < 200; guard++) {
    const e = currentEvent(s, ranks);
    if (e) { s = applyChoice(s, e, pickChoice(s, visibleChoices(e, s), ev, rng)); }
    else {
      const boss = ranks[s.rank]!.boss;
      if (firstTry.length === s.rank) { stressAtBoss.push(s.stats.stress); }
      const f = fight(s, boss, fs, rng);
      if (firstTry.length === s.rank) { firstTry.push(f.outcome === 'win'); turns.push(f.turns); }
      if (f.outcome === 'lose') defeats++;
      s = afterBattle(s, boss, f.outcome);
    }
    const end: EndingId | null = checkEnding(s, ranks);
    if (end) return { ending: end, firstTry, turns, stressAtBoss, defeats, reachedRank: s.rank };
  }
  throw new Error(`simulateRun: no ending after 200 steps (rank ${s.rank}, stress ${s.stats.stress})`);
}

export function summarize(ranks: Rank[], ev: EventStrategy, fs: FightStrategy, runs: number) {
  const rng = mulberry32(42);
  const wins = ranks.map(() => 0), tries = ranks.map(() => 0), turnSum = ranks.map(() => 0), stressSum = ranks.map(() => 0);
  let promotions = 0, fatalities = 0;
  for (let i = 0; i < runs; i++) {
    const r = simulateRun(ranks, ev, fs, rng);
    if (r.ending === 'promotion') promotions++;
    if (r.ending === 'fatality') fatalities++;
    r.firstTry.forEach((w, k) => {
      const t = r.turns[k], st = r.stressAtBoss[k];
      if (t === undefined || st === undefined) throw new Error(`bookkeeping mismatch at rank ${k}`);
      tries[k] = (tries[k] ?? 0) + 1; if (w) wins[k] = (wins[k] ?? 0) + 1;
      turnSum[k] = (turnSum[k] ?? 0) + t; stressSum[k] = (stressSum[k] ?? 0) + st;
    });
  }
  return {
    promotionRate: promotions / runs,
    fatalityRate: fatalities / runs,
    bosses: ranks.map((r, k) => ({ boss: r.boss.name, firstTryWin: tries[k] ? wins[k]! / tries[k]! : 0, avgTurns: tries[k] ? turnSum[k]! / tries[k]! : 0, avgStress: tries[k] ? stressSum[k]! / tries[k]! : 0 })),
  };
}

if (pathToFileURL(process.argv[1] ?? '').href === import.meta.url) {
  const runs = Number(process.argv[2] ?? 500);
  for (const [ev, fs] of [['best', 'weakness'], ['random', 'random'], ['first', 'neutral']] as const) {
    const s = summarize(CONTENT.ranks, ev, fs, runs);
    console.log(`\n=== events=${ev} fight=${fs}: promotion ${(s.promotionRate * 100).toFixed(0)}%`);
    console.table(s.bosses.map(b => ({ ...b, firstTryWin: `${(b.firstTryWin * 100).toFixed(0)}%`, avgTurns: b.avgTurns.toFixed(1), avgStress: b.avgStress.toFixed(0) })));
  }
}
