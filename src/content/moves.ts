import type { Move } from '../types';

export const MOVES: Move[] = [
  { id: 'agree', name: 'Согласиться', stat: 'loyalty', hint: 'Лояльность. Босс любит, когда с ним согласны.' },
  { id: 'data', name: 'Сослаться на данные', stat: 'competence', hint: 'Компетентность. Цифры, графики, дашборд.' },
  { id: 'blame', name: 'Перевести стрелки', stat: 'reputation', hint: 'Репутация. Виноват всегда кто-то другой.' },
  { id: 'joke', name: 'Пошутить', stat: 'reputation', hint: 'Репутация минус стресс. Опасно, если вы на грани.' },
];

export const STRIKE_MOVE: Move = {
  id: 'strike', name: 'Ударить', stat: null, hint: 'Классический геймплей. Не при свидетелях.',
};
