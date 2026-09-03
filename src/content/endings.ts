import type { Ending, EndingId } from '../types';

export const ENDINGS: Record<EndingId, Ending> = {
  promotion: {
    id: 'promotion', title: 'Заместитель Шао Кана по стратегическому развитию',
    text: 'Вы не победили босса. Вы стали его правой рукой. Табличка на двери, парковка у входа, KPI на следующий квартал — захватить Земное Царство. Обычный вторник.',
    illustration: 'il_ending_promotion',
  },
  burnout: {
    id: 'burnout', title: 'Выгорание',
    text: 'Вы уснули лицом на клавиатуре посреди квартального отчёта. Черепа на полке смотрят с пониманием. Внешний Мир найдёт другого стажёра.',
    illustration: 'il_ending_burnout',
  },
  fatality: {
    id: 'fatality', title: 'Fatality',
    text: 'Вы вернулись к классическому геймплею. Шао Кан этого не ожидал. Вы тоже. Охрана уже в пути, но какое-то время вы были легендой опенспейса.',
    illustration: 'il_ending_fatality',
  },
};
