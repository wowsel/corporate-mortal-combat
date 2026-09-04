// Хореография боя: чистые функции «результат хода → список шагов».
// Контроллер (src/screens/battle.ts) исполняет шаги последовательно, но не все ждёт:
// `move`, `camera`, `dim`, `grayscale`, `banner`, `wait` — ожидаются (await);
// `flash`, `shake`, `bar`, а также `pose`, `particles`, `damage`, `line`, `sound`, `voice`, `timeScale`
// запускаются и не ожидаются — они намеренно накладываются на следующий шаг:
// вспышка светит поверх отлёта босса, тряска идёт под цифру урона, полоска утекает под реплику.
// Реплика-`bubble` не гаснет сама: висит до следующего пузыря или до хода игрока (clearSpeech в контроллере).
// Тексты боя живут в обменах босса (Boss.exchanges): реакция на ответ героя берётся из обмена, на который
// он отвечал (prev.exchange), следующая реплика — из обмена, к которому перешёл бой (r.battle.exchange),
// и выводится вторым пузырём под реакцией (`append`): реакция приглушается, вопрос появляется живым — без таймера.
import type { BannerText, BattleState, Boss, Exchange, Step, Tactic, TurnResult } from './types';

const WHITE = '#ffffff';
const RED = '#c81e1e';

export function bannerFor(r: TurnResult): BannerText {
  if (r.outcome === 'fatality') return 'FATALITY';
  if (r.outcome === 'lose') return 'PERFORMANCE REVIEW';
  return r.battle.hitImmune || r.battle.bossSpecialHit ? 'PROMOTION!!!' : 'FLAWLESS PRESENTATION';
}

/** Обмен по индексу с клампом: под noUncheckedIndexedAccess и на случай короткого босса в тестах. */
export function exchangeAt(boss: Boss, i: number): Exchange {
  const list = boss.exchanges;
  const ex = list[Math.max(0, Math.min(i, list.length - 1))];
  if (!ex) throw new Error(`boss ${boss.id} has no exchanges`);
  return ex;
}

export function introSteps(boss: Boss): Step[] {
  return [
    { t: 'banner', text: 'ROUND 1' }, { t: 'voice', id: 'vo_round1' }, { t: 'sound', name: 'banner' }, { t: 'wait', ms: 900 },
    { t: 'line', text: exchangeAt(boss, 0).prompt, style: 'bubble' }, { t: 'wait', ms: 1400 },
    { t: 'banner', text: 'FIGHT!' }, { t: 'voice', id: 'vo_fight' }, { t: 'sound', name: 'banner' }, { t: 'wait', ms: 700 },
  ];
}

function returnSteps(who: 'hero' | 'boss'): Step[] {
  return [{ t: 'pose', who, pose: 'idle' } as Step, { t: 'move', who, dx: 0, ms: 150 }, { t: 'camera', zoom: 1, ms: 150 }];
}

function playerAttack(r: TurnResult, boss: Boss, prev: BattleState): Step[] {
  const p = r.player;
  // strike сюда не попадает: fatality возвращает пустой список раньше
  const line = p.move === 'strike' ? undefined : exchangeAt(boss, prev.exchange).replies[p.move as Tactic].reaction;
  const steps: Step[] = [
    { t: 'pose', who: 'hero', pose: 'attack' },
    { t: 'sound', name: 'whoosh' },
    { t: 'move', who: 'hero', dx: 80, ms: 150 },
    { t: 'camera', zoom: 1.08, ms: 150 },
  ];
  if (p.immune) {
    steps.push(
      { t: 'sound', name: 'immune' },
      { t: 'damage', at: 'boss', value: p.damage, muted: true },
      { t: 'bar', who: 'boss', to: r.battle.patience, ms: 300 },
      { t: 'sound', name: 'bar' },
    );
  } else {
    steps.push(
      { t: 'flash', ms: 60, color: WHITE },
      { t: 'sound', name: 'hit', gain: Math.min(1, 0.4 + p.damage / 40) },
      { t: 'pose', who: 'boss', pose: 'hurt' },
      { t: 'move', who: 'boss', dx: 40, ms: 120 },
      { t: 'particles', at: 'boss', kind: p.weakness ? 'sparks' : 'paper' },
      { t: 'damage', at: 'boss', value: p.damage, muted: false },
      { t: 'shake', ms: 200, amp: 4 + p.damage * 0.3 },
      { t: 'bar', who: 'boss', to: r.battle.patience, ms: 300 },
      { t: 'sound', name: 'bar' },
    );
  }
  if (line) steps.push({ t: 'line', text: line, style: 'bubble' });
  steps.push({ t: 'wait', ms: 900 }); // реакцию надо успеть прочитать до выпада босса
  return steps;
}

function bossAttack(r: TurnResult, boss: Boss): Step[] {
  const b = r.boss;
  if (!b) return [];
  const steps: Step[] = [];
  if (b.special) {
    const line = boss.lines.special[b.lineIndex];
    steps.push(
      { t: 'dim', to: 0.4, ms: 200 },
      { t: 'sound', name: 'special' },
      ...(line ? [{ t: 'line', text: line, style: 'center' } as Step] : []),
      { t: 'wait', ms: 900 },
      { t: 'flash', ms: 80, color: RED },
      { t: 'dim', to: 0, ms: 200 },
    );
  }
  steps.push(
    { t: 'pose', who: 'boss', pose: 'attack' },
    { t: 'sound', name: 'whoosh' },
    { t: 'move', who: 'boss', dx: -80, ms: 150 },
    { t: 'camera', zoom: 1.08, ms: 150 },
    { t: 'flash', ms: 60, color: b.special ? RED : WHITE },
    { t: 'sound', name: 'hit', gain: Math.min(1, 0.4 + b.damage / 40) },
    { t: 'pose', who: 'hero', pose: 'hurt' },
    { t: 'move', who: 'hero', dx: -40, ms: 120 },
    { t: 'particles', at: 'hero', kind: 'paper' },
    { t: 'damage', at: 'hero', value: b.damage, muted: false },
    { t: 'shake', ms: 250, amp: (4 + b.damage * 0.3) * 1.5 },
    { t: 'bar', who: 'hero', to: r.battle.confidence, ms: 300 },
    { t: 'sound', name: 'bar' },
    { t: 'wait', ms: 400 },
  );
  return steps;
}

export function turnSteps(r: TurnResult, boss: Boss, prev: BattleState): Step[] {
  if (r.outcome === 'fatality') return [];
  const steps: Step[] = [...playerAttack(r, boss, prev)];
  if (r.outcome === 'continue' || r.outcome === 'lose') {
    steps.push(...returnSteps('hero'), ...bossAttack(r, boss));
    if (r.outcome === 'continue') {
      steps.push(...returnSteps('boss'), { t: 'pose', who: 'hero', pose: 'idle' });
      // следующая реплика босса — второй пузырь под реакцией, висит до хода игрока; при lose её нет
      steps.push({ t: 'line', text: exchangeAt(boss, r.battle.exchange).prompt, style: 'bubble', append: true });
    }
  }
  if (!prev.finishHim && r.battle.finishHim && r.outcome === 'continue') {
    steps.push({ t: 'banner', text: 'FINISH HIM' }, { t: 'voice', id: 'vo_finish_him' }, { t: 'sound', name: 'banner' }, { t: 'wait', ms: 900 });
  }
  return steps;
}

export function outcomeSteps(r: TurnResult, boss: Boss): Step[] {
  if (r.outcome === 'continue') return [];
  const banner = bannerFor(r);
  const voiceId = banner === 'FLAWLESS PRESENTATION' ? 'vo_flawless'
    : banner === 'PROMOTION!!!' ? 'vo_promotion'
    : banner === 'PERFORMANCE REVIEW' ? 'vo_performance_review' : 'vo_fatality';
  if (r.outcome === 'win') {
    const line = boss.lines.defeated[0];
    return [
      { t: 'pose', who: 'boss', pose: 'defeated' }, { t: 'pose', who: 'hero', pose: 'win' },
      { t: 'timeScale', to: 0.5 }, { t: 'wait', ms: 1000 }, { t: 'timeScale', to: 1 },
      ...(line ? [{ t: 'line', text: line, style: 'bubble' } as Step] : []),
      { t: 'banner', text: banner }, { t: 'voice', id: voiceId }, { t: 'sound', name: 'banner' }, { t: 'sound', name: 'win' },
      { t: 'particles', at: 'screen', kind: 'confetti' }, { t: 'wait', ms: 1500 },
    ];
  }
  if (r.outcome === 'lose') {
    return [
      { t: 'pose', who: 'hero', pose: 'hurt' }, { t: 'grayscale', to: 1, ms: 600 },
      { t: 'banner', text: banner }, { t: 'voice', id: voiceId }, { t: 'sound', name: 'banner' }, { t: 'sound', name: 'lose' },
      { t: 'wait', ms: 1500 },
    ];
  }
  return [
    { t: 'pose', who: 'hero', pose: 'attack' }, { t: 'move', who: 'hero', dx: 200, ms: 120 },
    { t: 'flash', ms: 120, color: RED }, { t: 'sound', name: 'hit', gain: 1 },
    { t: 'pose', who: 'boss', pose: 'defeated' }, { t: 'bar', who: 'boss', to: 0, ms: 200 }, { t: 'shake', ms: 600, amp: 24 },
    { t: 'particles', at: 'boss', kind: 'sparks' },
    { t: 'banner', text: banner }, { t: 'voice', id: voiceId }, { t: 'sound', name: 'banner' },
    { t: 'wait', ms: 1800 },
  ];
}
