import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { MOVES } from '../src/content/moves';

const HINT_WORDS: Record<string, RegExp> = {
  agree: /соглас|лоял|кива/i, data: /данн|цифр|график|отчёт/i, blame: /вин|стрелк|ответствен/i, joke: /юмор|шут|смеш/i,
};

describe('content hints', () => {
  it('текст перед боем намекает на слабость и иммунитет босса', () => {
    for (const r of CONTENT.ranks) {
      // запасной путь для ступени без событий: намёк даёт открывающая реплика босса (exchanges[0].prompt)
      const last = r.events[r.events.length - 1];
      const blob = last
        ? `${last.text} ${last.repeatText ?? ''}`
        : r.boss.exchanges[0]!.prompt;
      expect(blob, `${r.id} weakness ${r.boss.weakness}`).toMatch(HINT_WORDS[r.boss.weakness]!);
      expect(blob, `${r.id} immunity ${r.boss.immunity}`).toMatch(HINT_WORDS[r.boss.immunity]!);
    }
    expect(MOVES.map(m => m.id).every(id => id in HINT_WORDS)).toBe(true);
  });

  it('ступень 4 ставит флаг shang_secret, и у него есть потребитель — вариант концовки promotion', () => {
    const director = CONTENT.ranks.find(r => r.id === 'director')!;
    const flags = director.events.flatMap(e => e.choices.map(c => c.setFlag)).filter(Boolean);
    expect(flags).toContain('shang_secret');
    expect(director.events[1]!.choices[0]!.requiresFlag).toBeUndefined();
    expect(CONTENT.endings.promotion.variants?.some(v => v.requiresFlag === 'shang_secret')).toBe(true);
  });
});
