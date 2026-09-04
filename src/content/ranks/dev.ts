import type { Rank } from '../../types';

export const DEV_RANKS: Rank[] = [
  {
    id: 'dev1', title: 'Зам Шао Кана', background: 'bg_dev_throne', events: [],
    boss: {
      id: 'dev_shao', name: 'Шао Кан', title: 'Генеральный директор', patience: 120, attack: 14,
      weakness: 'agree', immunity: 'data', final: true,
      sprites: { idle: 'sp_dev2_idle', attack: 'sp_dev2_attack', hurt: 'sp_dev2_hurt', defeated: 'sp_dev2_defeated' },
      portraits: { neutral: 'pt_dev2_neutral', angry: 'pt_dev2_angry' },
      intro: 'У тебя пять минут. Слайды — на стену. Императора не интересуют цифры. Императора интересует, кто с ним согласен.',
      lines: {
        hit: ['Хм.', 'Дальше.'],
        immune: ['Цифры? Я император, а не бухгалтер.'],
        special: ['ТЫ ЕЩЁ НЕ ГОТОВ!'],
        defeated: ['Годится. Твой стол у окна.'],
      },
    },
  },
];
