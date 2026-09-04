import { describe, expect, it } from 'vitest';
import { validateContent } from '../src/content/schema';
import type { Manifest } from '../src/types';
import { makeBoss, makeEvent, makeRank, makeRanks } from './fixtures';
import { CONTENT } from '../src/content';
import manifestJson from '../assets/manifest.json';
import type { Ending, EndingId } from '../src/types';

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
  it('последняя ступень с событиями — ошибка', () => {
    const ranks = makeRanks(); ranks[1] = { ...ranks[1]!, events: [makeEvent()] };
    expect(validateContent(ranks, manifest).join()).toMatch(/events/);
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
    const ranks = makeRanks(); ranks[0] = makeRank({ boss: makeBoss({ lines: { hit: [], immune: ['x'], special: ['y'], defeated: ['z'] } }) });
    expect(validateContent(ranks, manifest).join()).toMatch(/lines/);
  });

  it('эпилог с несуществующим портретом — ошибка', () => {
    const endings = { ...CONTENT.endings, fatality: { ...CONTENT.endings.fatality, epilogue: { name: 'x', portrait: 'pt_ghost', text: 'y' } } };
    expect(validateContent(CONTENT.ranks, manifestJson as Manifest, endings).join()).toMatch(/pt_ghost/);
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
