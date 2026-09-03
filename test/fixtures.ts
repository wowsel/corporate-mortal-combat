import type { Boss, GameEvent, Rank } from '../src/types';

export function makeBoss(over: Partial<Boss> = {}): Boss {
  return {
    id: 'dummy', name: 'Тестовый босс', title: 'Менеджер', patience: 100, attack: 10,
    weakness: 'agree', immunity: 'joke', final: false,
    sprites: { idle: 'sp_d_idle', attack: 'sp_d_attack', hurt: 'sp_d_hurt', defeated: 'sp_d_defeated' },
    portraits: { neutral: 'pt_d_neutral', angry: 'pt_d_angry' },
    intro: 'Ну, начнём.',
    lines: { hit: ['Ох.', 'Ай.'], immune: ['Не смешно.'], special: ['Вот тебе!'], defeated: ['Ладно…'] },
    ...over,
  };
}

export function makeEvent(over: Partial<GameEvent> = {}): GameEvent {
  return {
    id: 'ev1', title: 'Событие', speaker: { name: 'Кто-то', portrait: 'pt_d_neutral' }, text: 'Текст.',
    choices: [
      { text: 'А', effects: { loyalty: 10, stress: 5 }, setFlag: 'flag_a' },
      { text: 'Б', effects: { competence: 10 } },
      { text: 'В', requiresFlag: 'flag_a', effects: { reputation: 15 } },
    ],
    ...over,
  };
}

export function makeRank(over: Partial<Rank> = {}): Rank {
  return {
    id: 'r0', title: 'Стажёр', background: 'bg_test',
    events: [makeEvent({ id: 'ev1' }), makeEvent({ id: 'ev2' })],
    boss: makeBoss(),
    ...over,
  };
}

export function makeRanks(): Rank[] {
  return [
    makeRank({ id: 'r0' }),
    makeRank({ id: 'r1', title: 'Финал', events: [], boss: makeBoss({ id: 'final', final: true, patience: 200 }) }),
  ];
}
