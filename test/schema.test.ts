import { describe, expect, it } from 'vitest';
import { validateContent } from '../src/content/schema';
import type { Manifest } from '../src/types';
import { makeBoss, makeEvent, makeExchanges, makeRank, makeRanks } from './fixtures';
import { CONTENT } from '../src/content';
import { EXCHANGE_COUNT } from '../src/battle';
import manifestJson from '../assets/manifest.json';
import type { Boss, Ending, EndingId } from '../src/types';

const ids = ['bg_test', 'sp_d_idle', 'sp_d_attack', 'sp_d_hurt', 'sp_d_defeated', 'pt_d_neutral', 'pt_d_angry'];
const manifest: Manifest = {
  stylePrefix: '',
  entries: ids.map(id => ({ id, kind: 'sprite', group: 'core', file: `x/${id}.webp`, model: 'm', prompt: 'p', generated: false })),
};

describe('validateContent', () => {
  it('валидный контент проходит', () => expect(validateContent(makeRanks(), manifest)).toEqual([]));

  it('ступень не последняя без 2 событий', () => {
    const ranks = makeRanks(); ranks[0] = makeRank({ events: [makeEvent()] });
    expect(validateContent(ranks, manifest).join()).toMatch(/events/);
  });
  it('последняя ступень без 2 событий — ошибка', () => {
    const ranks = makeRanks(); ranks[1] = { ...ranks[1]!, events: [makeEvent()] };
    expect(validateContent(ranks, manifest).join()).toMatch(/events/);
  });
  it('requiresFlags: флаг не поставлен раньше или min вне диапазона — ошибка; пять вариантов допустимы, шесть — нет', () => {
    const ranks = makeRanks();
    const ev2 = ranks[0]!.events[1]!;
    ranks[0]!.events[1] = { ...ev2, choices: [...ev2.choices, { text: 'Г', requiresFlags: { flags: ['flag_a', 'nope'], min: 1 } }, { text: 'Д', requiresFlags: { flags: ['flag_a'], min: 2 } }] };
    const errs = validateContent(ranks, manifest).join('\n');
    expect(errs).toMatch(/requiresFlags "nope"/);
    expect(errs).toMatch(/requiresFlags min 2 of 1/);
    expect(errs).not.toMatch(/choices must be/);
    ranks[0]!.events[1] = { ...ev2, choices: [...ev2.choices, { text: 'Г' }, { text: 'Д' }, { text: 'Е' }] };
    expect(validateContent(ranks, manifest).join()).toMatch(/choices must be 2..5/);
  });
  it('неизвестная концовка у выбора — ошибка при переданных endings', () => {
    const ranks = makeRanks();
    const ev2 = ranks[0]!.events[1]!;
    ranks[0]!.events[1] = { ...ev2, choices: [...ev2.choices, { text: 'Г', ending: 'nowhere' as never }] };
    expect(validateContent(ranks, manifest, CONTENT.endings).join()).toMatch(/unknown ending "nowhere"/);
    ranks[0]!.events[1] = { ...ev2, choices: [...ev2.choices, { text: 'Г', ending: 'partnership' }] };
    expect(validateContent(ranks, manifest, CONTENT.endings).join()).not.toMatch(/unknown ending/);
  });
  it('нет background', () => {
    const ranks = makeRanks(); ranks[0] = makeRank({ background: '' });
    expect(validateContent(ranks, manifest).join()).toMatch(/background/);
  });
  it('weakness === immunity', () => {
    const ranks = makeRanks(); ranks[0] = makeRank({ boss: makeBoss({ weakness: 'agree', immunity: 'agree' }) });
    expect(validateContent(ranks, manifest).join()).toMatch(/immunity/);
  });
  it('первый вариант с requiresFlag', () => {
    const ev = makeEvent(); ev.choices = [{ text: 'x', requiresFlag: 'f' }, { text: 'y' }];
    const ranks = makeRanks(); ranks[0] = makeRank({ events: [ev, makeEvent({ id: 'ev2' })] });
    expect(validateContent(ranks, manifest).join()).toMatch(/requiresFlag/);
  });
  it('requiresFlag, который никто не ставит', () => {
    const ev = makeEvent(); ev.choices = [{ text: 'x' }, { text: 'y', requiresFlag: 'ghost' }];
    const ranks = makeRanks(); ranks[0] = makeRank({ events: [ev, makeEvent({ id: 'ev2' })] });
    expect(validateContent(ranks, manifest).join()).toMatch(/ghost/);
  });
  it('requiresFlag ссылается на флаг, который ставится только в более позднем событии — ошибка', () => {
    const early = makeEvent({ id: 'ev_early' });
    early.choices = [{ text: 'x' }, { text: 'y', requiresFlag: 'later_flag' }];
    const late = makeEvent({ id: 'ev_late' });
    late.choices = [{ text: 'x', setFlag: 'later_flag' }, { text: 'y' }];
    const ranks = makeRanks(); ranks[0] = makeRank({ events: [early, late] });
    expect(validateContent(ranks, manifest).join()).toMatch(/later_flag/);
  });
  it('меньше 2 или больше 4 вариантов', () => {
    const ev = makeEvent(); ev.choices = [{ text: 'x' }];
    const ranks = makeRanks(); ranks[0] = makeRank({ events: [ev, makeEvent({ id: 'ev2' })] });
    expect(validateContent(ranks, manifest).join()).toMatch(/choices/);
  });
  it('id ассета не в манифесте', () => {
    const ranks = makeRanks(); ranks[0] = makeRank({ background: 'bg_missing' });
    expect(validateContent(ranks, manifest).join()).toMatch(/bg_missing/);
  });
  it('нет финального босса или он не последний', () => {
    const ranks = makeRanks(); ranks[1] = { ...ranks[1]!, boss: makeBoss({ final: false }) };
    expect(validateContent(ranks, manifest).join()).toMatch(/final/);
    const ranks2 = makeRanks(); ranks2[0] = makeRank({ boss: makeBoss({ final: true }) });
    expect(validateContent(ranks2, manifest).join()).toMatch(/final/);
  });
  it('дубликаты id событий и боссов', () => {
    const ranks = makeRanks(); ranks[0] = makeRank({ events: [makeEvent({ id: 'same' }), makeEvent({ id: 'same' })] });
    expect(validateContent(ranks, manifest).join()).toMatch(/same/);
  });
  it('пустые lines у босса', () => {
    const ranks = makeRanks(); ranks[0] = makeRank({ boss: makeBoss({ lines: { special: [], defeated: ['z'] } }) });
    expect(validateContent(ranks, manifest).join()).toMatch(/lines/);
  });

  describe('обмены', () => {
    const withExchanges = (mut: (ex: ReturnType<typeof makeExchanges>) => void, over: Partial<Boss> = {}) => {
      const ex = makeExchanges(); mut(ex);
      const ranks = makeRanks(); ranks[0] = makeRank({ boss: makeBoss({ exchanges: ex, ...over }) });
      return validateContent(ranks, manifest).join('\n');
    };
    it('ровно EXCHANGE_COUNT обменов', () => {
      expect(withExchanges(ex => { ex.pop(); })).toMatch(new RegExp(`expected ${EXCHANGE_COUNT} exchanges, got 7`));
    });
    it('лишний или отсутствующий ключ ответа', () => {
      expect(withExchanges(ex => { (ex[1]!.replies as Record<string, unknown>)['strike'] = { text: 'x', reaction: 'y' }; })).toMatch(/replies must have exactly/);
      expect(withExchanges(ex => { delete (ex[1]!.replies as Partial<Record<string, unknown>>)['joke']; })).toMatch(/replies must have exactly/);
    });
    it('лимиты длины: реплика 110, ответ 80, реакция 75', () => {
      expect(withExchanges(ex => { ex[2]!.prompt = 'п'.repeat(111); })).toMatch(/exchange\[2\] prompt: 111 chars > 110/);
      expect(withExchanges(ex => { ex[2]!.prompt = 'п'.repeat(110); })).not.toMatch(/prompt: 110/);
      expect(withExchanges(ex => { ex[3]!.replies.data.text = 'о'.repeat(81); })).toMatch(/data\.text: 81 chars > 80/);
      expect(withExchanges(ex => { ex[3]!.replies.joke.reaction = 'р'.repeat(76); })).toMatch(/joke\.reaction: 76 chars > 75/);
    });
    it('пустая реплика', () => {
      expect(withExchanges(ex => { ex[4]!.replies.blame.reaction = '  '; })).toMatch(/blame\.reaction: empty text/);
    });
    it('одна реплика у двух боссов — ошибка', () => {
      const ranks = makeRanks();
      ranks[1]!.boss.exchanges[5]!.prompt = ranks[0]!.boss.exchanges[2]!.prompt;
      expect(validateContent(ranks, manifest).join()).toMatch(/duplicate text/);
    });
    it('strikeText: обязателен у финального, запрещён у остальных, не длиннее 60', () => {
      const ranks = makeRanks(); ranks[0] = makeRank({ boss: makeBoss({ strikeText: 'x' }) });
      expect(validateContent(ranks, manifest).join()).toMatch(/strikeText only for the final boss/);
      const ranks2 = makeRanks(); ranks2[1] = { ...ranks2[1]!, boss: makeBoss({ id: 'final', final: true, strikeText: '' }) };
      expect(validateContent(ranks2, manifest).join()).toMatch(/final boss needs strikeText/);
      const ranks3 = makeRanks(); ranks3[1] = { ...ranks3[1]!, boss: makeBoss({ id: 'final', final: true, strikeText: 'у'.repeat(61) }) };
      expect(validateContent(ranks3, manifest).join()).toMatch(/strikeText 61 chars > 60/);
    });
  });

  it('эпилог с несуществующим портретом — ошибка', () => {
    const endings = { ...CONTENT.endings, fatality: { ...CONTENT.endings.fatality, epilogue: { name: 'x', portrait: 'pt_ghost', text: 'y' } } };
    expect(validateContent(CONTENT.ranks, manifestJson as Manifest, endings).join()).toMatch(/pt_ghost/);
  });
  it('концовка под чужим ключом — ошибка', () => {
    const endings = { ...CONTENT.endings, burnout: { ...CONTENT.endings.burnout, id: 'promotion' as const } };
    expect(validateContent(CONTENT.ranks, manifestJson as Manifest, endings).join()).toMatch(/ending burnout: id is "promotion"/);
  });

  it('вариант с requiresFlag, который нигде не ставится — ошибка', () => {
    const ranks = makeRanks();
    const ending: Ending = { id: 'promotion', title: 't', text: 't', illustration: 'bg_test', variants: [{ requiresFlag: 'ghost_flag' }] };
    const endings = { promotion: ending } as unknown as Record<EndingId, Ending>;
    expect(validateContent(ranks, manifest, endings).join()).toMatch(/ghost_flag/);
  });

  it('реальный контент проходит валидацию', () => {
    expect(validateContent(CONTENT.ranks, manifestJson as Manifest)).toEqual([]);
  });

  it('реальный контент с endings проходит валидацию', () => {
    expect(validateContent(CONTENT.ranks, manifestJson as Manifest, CONTENT.endings)).toEqual([]);
  });
});
