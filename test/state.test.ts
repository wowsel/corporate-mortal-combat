import { describe, expect, it } from 'vitest';
import { afterBattle, applyChoice, checkEnding, clampStat, createInitialState, currentEvent, visibleChoices } from '../src/state';
import { makeBoss, makeEvent, makeRanks } from './fixtures';

describe('createInitialState', () => {
  it('стартовые статы и пустые множества', () => {
    const s = createInitialState();
    expect(s.stats).toEqual({ loyalty: 30, reputation: 20, competence: 30, stress: 10 });
    expect(s.rank).toBe(0); expect(s.step).toBe(0); expect(s.week).toBe(1);
    expect(s.flags.size).toBe(0); expect(s.seenEvents.size).toBe(0); expect(s.lastBattle).toBeNull();
  });
});

describe('clampStat', () => {
  it('ограничивает 0..100', () => {
    expect(clampStat(-5)).toBe(0); expect(clampStat(150)).toBe(100); expect(clampStat(42)).toBe(42);
  });
});

describe('visibleChoices', () => {
  it('скрывает варианты без флага и показывает с флагом', () => {
    const s = createInitialState();
    expect(visibleChoices(makeEvent(), s).map(c => c.text)).toEqual(['А', 'Б']);
    s.flags.add('flag_a');
    expect(visibleChoices(makeEvent(), s).map(c => c.text)).toEqual(['А', 'Б', 'В']);
  });
});

describe('currentEvent', () => {
  it('возвращает событие по step и null когда пора в бой', () => {
    const ranks = makeRanks();
    const s = createInitialState();
    expect(currentEvent(s, ranks)?.id).toBe('ev1');
    expect(currentEvent({ ...s, step: 1 }, ranks)?.id).toBe('ev2');
    expect(currentEvent({ ...s, step: 2 }, ranks)).toBeNull();
  });
  it('ступень без событий сразу бой', () => {
    const s = { ...createInitialState(), rank: 1 };
    expect(currentEvent(s, makeRanks())).toBeNull();
  });
});

describe('applyChoice', () => {
  it('применяет эффекты с ограничением, ставит флаг, двигает шаг и неделю', () => {
    const s0 = createInitialState();
    const ev = makeEvent();
    const s1 = applyChoice(s0, ev, ev.choices[0]!);
    expect(s1.stats.loyalty).toBe(40); expect(s1.stats.stress).toBe(15);
    expect(s1.flags.has('flag_a')).toBe(true);
    expect(s1.step).toBe(1); expect(s1.week).toBe(2);
    expect(s1.seenEvents.has('ev1')).toBe(true);
    expect(s0.stats.loyalty).toBe(30); // иммутабельность
  });
  it('ограничивает 100', () => {
    const s0 = { ...createInitialState(), stats: { loyalty: 95, reputation: 20, competence: 30, stress: 10 } };
    const ev = makeEvent();
    expect(applyChoice(s0, ev, ev.choices[0]!).stats.loyalty).toBe(100);
  });
  it('при повторе события применяет только stress и всегда ставит флаг', () => {
    const s0 = createInitialState(); s0.seenEvents.add('ev1');
    const ev = makeEvent();
    const s1 = applyChoice(s0, ev, ev.choices[0]!);
    expect(s1.stats.loyalty).toBe(30); expect(s1.stats.stress).toBe(15);
    expect(s1.flags.has('flag_a')).toBe(true);
  });
  it('сбрасывает lastBattle', () => {
    const s0 = { ...createInitialState(), lastBattle: { bossId: 'x', outcome: 'lose' as const } };
    const ev = makeEvent();
    expect(applyChoice(s0, ev, ev.choices[1]!).lastBattle).toBeNull();
  });
});

describe('afterBattle', () => {
  const boss = makeBoss();
  it('победа: ранг +1, стресс −10, step 0, lastBattle', () => {
    const s0 = { ...createInitialState(), step: 2, stats: { loyalty: 30, reputation: 20, competence: 30, stress: 30 } };
    const s1 = afterBattle(s0, boss, 'win');
    expect(s1.rank).toBe(1); expect(s1.step).toBe(0); expect(s1.stats.stress).toBe(20);
    expect(s1.week).toBe(2); expect(s1.lastBattle).toEqual({ bossId: 'dummy', outcome: 'win' });
  });
  it('победа над финальным не меняет ранг', () => {
    const s1 = afterBattle({ ...createInitialState(), rank: 1 }, makeBoss({ id: 'final', final: true }), 'win');
    expect(s1.rank).toBe(1);
  });
  it('поражение: ранг тот же, стресс +25, step 0', () => {
    const s1 = afterBattle({ ...createInitialState(), step: 2 }, boss, 'lose');
    expect(s1.rank).toBe(0); expect(s1.step).toBe(0); expect(s1.stats.stress).toBe(35);
  });
  it('fatality: статы не меняются', () => {
    const s1 = afterBattle(createInitialState(), boss, 'fatality');
    expect(s1.stats.stress).toBe(10); expect(s1.lastBattle?.outcome).toBe('fatality');
  });
});

describe('checkEnding', () => {
  const ranks = makeRanks();
  it('null в обычном состоянии', () => expect(checkEnding(createInitialState(), ranks)).toBeNull());
  it('burnout при стрессе 100', () => {
    const s = { ...createInitialState(), stats: { loyalty: 30, reputation: 20, competence: 30, stress: 100 } };
    expect(checkEnding(s, ranks)).toBe('burnout');
  });
  it('fatality', () => {
    expect(checkEnding({ ...createInitialState(), lastBattle: { bossId: 'final', outcome: 'fatality' } }, ranks)).toBe('fatality');
  });
  it('promotion только после победы над финальным', () => {
    expect(checkEnding({ ...createInitialState(), lastBattle: { bossId: 'final', outcome: 'win' } }, ranks)).toBe('promotion');
    expect(checkEnding({ ...createInitialState(), lastBattle: { bossId: 'dummy', outcome: 'win' } }, ranks)).toBeNull();
  });
  it('burnout приоритетнее promotion', () => {
    const s = { ...createInitialState(), stats: { loyalty: 30, reputation: 20, competence: 30, stress: 100 }, lastBattle: { bossId: 'final', outcome: 'win' as const } };
    expect(checkEnding(s, ranks)).toBe('burnout');
  });
});
