import { MOVES, STRIKE_MOVE } from './content/moves';
import type { BattleState, Boss, Move, Stats, TurnResult } from './types';

export type Rng = () => number;

export function createBattle(boss: Boss): BattleState {
  return {
    confidence: 100, maxConfidence: 100,
    patience: boss.patience, maxPatience: boss.patience,
    turn: 0, hitImmune: false, bossSpecialHit: false, finishHim: false,
  };
}

/**
 * Урон приёма до множителей босса, без округления — единственный источник формулы.
 * UI боя показывает по нему подсказку «≈N», `moveDamage` домножает на слабость/иммунитет.
 */
export function baseDamage(move: Move, stats: Stats): number {
  if (move.stat === null) return 0;
  const base = 10 + stats[move.stat] * 0.15;
  return move.id === 'joke' ? Math.max(3, base - stats.stress * 0.05) : base;
}

export function moveDamage(move: Move, stats: Stats, boss: Boss): number {
  const base = baseDamage(move, stats);
  let mult = 1;
  if (move.id === boss.weakness) mult = 2;
  else if (move.id === boss.immunity) mult = 0.25;
  return Math.round(base * mult);
}

export function bossDamage(boss: Boss, stats: Stats, rng: Rng): { damage: number; special: boolean } {
  const special = rng() < 0.25;
  const base = boss.attack + stats.stress * 0.05;
  return { damage: Math.round(special ? base * 1.5 : base), special };
}

export function availableMoves(boss: Boss, battle: BattleState): { move: Move; enabled: boolean }[] {
  const list = MOVES.map(move => ({ move, enabled: true }));
  if (boss.final) list.push({ move: STRIKE_MOVE, enabled: battle.finishHim });
  return list;
}

function pickIndex(rng: Rng, length: number): number {
  return Math.min(length - 1, Math.floor(rng() * length));
}

export function resolveTurn(battle: BattleState, move: Move, stats: Stats, boss: Boss, rng: Rng = Math.random): TurnResult {
  if (move.id === 'strike') {
    const allowed = availableMoves(boss, battle).some(m => m.move.id === 'strike' && m.enabled);
    if (!allowed) throw new Error('strike is not available');
    return {
      battle: { ...battle, turn: battle.turn + 1 },
      outcome: 'fatality',
      player: { move: 'strike', damage: 0, weakness: false, immune: false, lineIndex: 0 },
      boss: null,
    };
  }

  const damage = moveDamage(move, stats, boss);
  const immune = move.id === boss.immunity;
  const weakness = move.id === boss.weakness;
  const patience = Math.max(0, battle.patience - damage);
  const lines = immune ? boss.lines.immune : boss.lines.hit;
  const player = { move: move.id, damage, weakness, immune, lineIndex: pickIndex(rng, lines.length) };

  let next: BattleState = {
    ...battle, patience, turn: battle.turn + 1,
    hitImmune: battle.hitImmune || immune,
    finishHim: battle.finishHim || (boss.final && patience / battle.maxPatience < 0.15),
  };
  if (patience <= 0) return { battle: next, outcome: 'win', player, boss: null };

  const b = bossDamage(boss, stats, rng);
  const bossLines = b.special ? boss.lines.special : boss.lines.hit;
  const confidence = Math.max(0, battle.confidence - b.damage);
  next = { ...next, confidence, bossSpecialHit: next.bossSpecialHit || b.special };
  return {
    battle: next,
    outcome: confidence <= 0 ? 'lose' : 'continue',
    player,
    boss: { damage: b.damage, special: b.special, lineIndex: pickIndex(rng, bossLines.length) },
  };
}
