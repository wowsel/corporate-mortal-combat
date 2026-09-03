import type { Rank } from '../../types';

export const DEV_RANKS: Rank[] = [
  {
    id: 'dev0', title: 'Стажёр', background: 'bg_dev',
    events: [
      {
        id: 'dev_onboarding', title: 'Первый день',
        speaker: { name: 'Милина', portrait: 'pt_dev_neutral' },
        text: 'Добро пожаловать во Внешний Мир! Вот ваш пропуск, вот ваш череп для стола. Кофе-машина сломана с эпохи Первой Династии. Вопросы?',
        repeatText: 'Опять первый день. Череп на столе уже ваш, кофе-машина всё ещё сломана.',
        choices: [
          { text: 'Никаких вопросов, всё понятно!', effects: { loyalty: 10, stress: 5 }, reaction: { portrait: 'pt_dev_angry', text: 'Отлично. Люблю людей без вопросов.' } },
          { text: 'А где регламент по починке кофе-машины?', effects: { competence: 10, reputation: -5 } },
          { text: 'Шутка про череп', effects: { reputation: 10, stress: -5 }, setFlag: 'dev_joker' },
        ],
      },
      {
        id: 'dev_standup', title: 'Первый созвон',
        speaker: { name: 'Милина', portrait: 'pt_dev_neutral' },
        text: 'Ежедневный созвон. Барака показывает слайды о синергии. Все молчат. Милина говорит, что на собеседовании главное — чувство юмора, и точно не сваливать вину на других.',
        choices: [
          { text: 'Молча кивать', effects: { loyalty: 5, stress: 5 } },
          { text: 'Задать уточняющий вопрос по слайду 47', effects: { competence: 10, stress: 10 } },
          { text: 'Продолжить серию шуток', requiresFlag: 'dev_joker', effects: { reputation: 15, loyalty: -5 } },
        ],
      },
    ],
    boss: {
      id: 'dev_mileena', name: 'Милина', title: 'HR-директор', patience: 90, attack: 10,
      weakness: 'joke', immunity: 'blame', final: false,
      sprites: { idle: 'sp_dev_idle', attack: 'sp_dev_attack', hurt: 'sp_dev_hurt', defeated: 'sp_dev_defeated' },
      portraits: { neutral: 'pt_dev_neutral', angry: 'pt_dev_angry' },
      intro: 'Расскажите о своих слабых сторонах. Подробно.',
      lines: {
        hit: ['Интересно.', 'Записываю.', 'Продолжайте.'],
        immune: ['Перевести стрелки на HR? Смело.', 'Это не мой вопрос. Это ваш.'],
        special: ['Где вы видите себя через пять лет? Быстро!'],
        defeated: ['Вы приняты. Пропуск заберёте у черепа на ресепшене.'],
      },
    },
  },
  {
    id: 'dev1', title: 'Зам Шао Кана', background: 'bg_dev_throne', events: [],
    boss: {
      id: 'dev_shao', name: 'Шао Кан', title: 'Генеральный директор', patience: 120, attack: 14,
      weakness: 'agree', immunity: 'data', final: true,
      sprites: { idle: 'sp_dev2_idle', attack: 'sp_dev2_attack', hurt: 'sp_dev2_hurt', defeated: 'sp_dev2_defeated' },
      portraits: { neutral: 'pt_dev2_neutral', angry: 'pt_dev2_angry' },
      intro: 'У тебя пять минут. Слайды — на стену.',
      lines: {
        hit: ['Хм.', 'Дальше.'],
        immune: ['Цифры? Я император, а не бухгалтер.'],
        special: ['ТЫ ЕЩЁ НЕ ГОТОВ!'],
        defeated: ['Годится. Твой стол у окна.'],
      },
    },
  },
];
