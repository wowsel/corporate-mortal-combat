import type { Boss, BattleOutcome, Choice, Ending, EndingId, Epilogue, GameEvent, GameState, Rank, StatKey, Stats } from './types';

export const STAT_KEYS: StatKey[] = ['loyalty', 'reputation', 'competence', 'stress'];

export function createInitialState(): GameState {
  return {
    rank: 0, step: 0, week: 1,
    stats: { loyalty: 30, reputation: 20, competence: 30, stress: 10 },
    flags: new Set(), seenEvents: new Set(), lastBattle: null,
  };
}

export function clampStat(n: number): number {
  return Math.max(0, Math.min(100, n));
}

export function currentRank(state: GameState, ranks: Rank[]): Rank {
  const r = ranks[state.rank];
  if (!r) throw new Error(`rank ${state.rank} out of range`);
  return r;
}

export function currentEvent(state: GameState, ranks: Rank[]): GameEvent | null {
  return currentRank(state, ranks).events[state.step] ?? null;
}

export function visibleChoices(event: GameEvent, state: GameState): Choice[] {
  return event.choices.filter(c => !c.requiresFlag || state.flags.has(c.requiresFlag));
}

export function applyChoice(state: GameState, event: GameEvent, choice: Choice): GameState {
  const repeat = state.seenEvents.has(event.id);
  const stats: Stats = { ...state.stats };
  for (const key of STAT_KEYS) {
    const delta = choice.effects?.[key];
    if (delta === undefined) continue;
    if (repeat && key !== 'stress') continue;
    stats[key] = clampStat(stats[key] + delta);
  }
  const flags = new Set(state.flags);
  if (choice.setFlag) flags.add(choice.setFlag);
  const seenEvents = new Set(state.seenEvents);
  seenEvents.add(event.id);
  return { ...state, stats, flags, seenEvents, step: state.step + 1, week: state.week + 1, lastBattle: null };
}

export function afterBattle(state: GameState, boss: Boss, outcome: BattleOutcome): GameState {
  const stats: Stats = { ...state.stats };
  let rank = state.rank;
  if (outcome === 'win') {
    stats.stress = clampStat(stats.stress - 10);
    if (!boss.final) rank += 1;
  } else if (outcome === 'lose') {
    stats.stress = clampStat(stats.stress + 25);
  }
  return { ...state, stats, rank, step: 0, week: state.week + 1, lastBattle: { bossId: boss.id, outcome } };
}

export interface ResolvedEnding { id: EndingId; title: string; text: string; illustration: string; epilogue?: Epilogue }

/** Первый вариант, чей requiresFlag установлен, перекрывает title/text/epilogue базовой концовки
 * (только те поля, что он сам определяет); при отсутствии подходящего варианта — база как есть. */
export function resolveEnding(ending: Ending, flags: Set<string>): ResolvedEnding {
  const variant = ending.variants?.find(v => flags.has(v.requiresFlag));
  return {
    id: ending.id,
    title: variant?.title ?? ending.title,
    text: variant?.text ?? ending.text,
    illustration: ending.illustration,
    epilogue: variant?.epilogue ?? ending.epilogue,
  };
}

export function checkEnding(state: GameState, ranks: Rank[]): EndingId | null {
  if (state.stats.stress >= 100) return 'burnout';
  const lb = state.lastBattle;
  if (!lb) return null;
  if (lb.outcome === 'fatality') return 'fatality';
  if (lb.outcome === 'win' && ranks.some(r => r.boss.id === lb.bossId && r.boss.final)) return 'promotion';
  return null;
}
