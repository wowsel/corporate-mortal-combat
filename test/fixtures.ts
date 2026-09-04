import { EXCHANGE_COUNT } from '../src/battle';
import type { Boss, Exchange, GameEvent, Rank } from '../src/types';

/**
 * Восемь обменов тестового босса. Нулевой — со «историческими» текстами, на которые ссылаются тесты
 * («Ну, начнём.», «Ай.», «Не смешно.»); остальные нумерованы. `tag` делает тексты уникальными между боссами:
 * валидатор запрещает одну реплику у двух боссов.
 */
export function makeExchanges(tag = ''): Exchange[] {
  return Array.from({ length: EXCHANGE_COUNT }, (_, i): Exchange => ({
    prompt: i === 0 ? `Ну, начнём.${tag}` : `Вопрос ${i}.${tag}`,
    replies: {
      agree: { text: `Да ${i}.${tag}`, reaction: `Ох ${i}.${tag}` },
      data: { text: `Цифры ${i}.${tag}`, reaction: i === 0 ? `Ай.${tag}` : `Ай ${i}.${tag}` },
      blame: { text: `Не я ${i}.${tag}`, reaction: `Ну-ну ${i}.${tag}` },
      joke: { text: `Шутка ${i}.${tag}`, reaction: i === 0 ? `Не смешно.${tag}` : `Не смешно ${i}.${tag}` },
    },
  }));
}

export function makeBoss(over: Partial<Boss> = {}): Boss {
  const id = over.id ?? 'dummy';
  const final = over.final ?? false;
  return {
    id, name: 'Тестовый босс', title: 'Менеджер', patience: 100, attack: 10,
    weakness: 'agree', immunity: 'joke', final,
    sprites: { idle: 'sp_d_idle', attack: 'sp_d_attack', hurt: 'sp_d_hurt', defeated: 'sp_d_defeated' },
    portraits: { neutral: 'pt_d_neutral', angry: 'pt_d_angry' },
    exchanges: makeExchanges(id === 'dummy' ? '' : ` [${id}]`),
    ...(final ? { strikeText: 'Ударить.' } : {}),
    lines: { special: ['Вот тебе!'], defeated: ['Ладно…'] },
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
    // ev1 sets 'flag_a' without requiring anything itself; ev2 (default makeEvent()) requires
    // 'flag_a' on its third choice — satisfied because ev1 runs first, not because ev2 sets it too.
    events: [
      makeEvent({
        id: 'ev1',
        choices: [
          { text: 'А', effects: { loyalty: 10, stress: 5 }, setFlag: 'flag_a' },
          { text: 'Б', effects: { competence: 10 } },
        ],
      }),
      makeEvent({ id: 'ev2' }),
    ],
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
