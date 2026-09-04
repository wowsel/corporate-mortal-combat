import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { MOVES } from '../src/content/moves';

const HINT_WORDS: Record<string, RegExp> = {
  agree: /соглас|лоял|кива/i, data: /данн|цифр|график|отчёт/i, blame: /вин|стрелк|ответствен/i, joke: /юмор|шут|смеш/i,
};

describe('content hints', () => {
  it('текст перед боем намекает на слабость и иммунитет босса', () => {
    for (const r of CONTENT.ranks) {
      // у ступени без событий (финал) намёк даёт вступительная реплика босса
      const last = r.events[r.events.length - 1];
      const blob = last
        ? `${last.text} ${last.repeatText ?? ''} ${last.choices.map(c => c.text + (c.reaction?.text ?? '')).join(' ')}`
        : r.boss.intro;
      expect(blob, `${r.id} weakness ${r.boss.weakness}`).toMatch(HINT_WORDS[r.boss.weakness]!);
      expect(blob, `${r.id} immunity ${r.boss.immunity}`).toMatch(HINT_WORDS[r.boss.immunity]!);
    }
    expect(MOVES.map(m => m.id).every(id => id in HINT_WORDS)).toBe(true);
  });
});
