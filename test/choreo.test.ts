import { describe, expect, it } from 'vitest';
import { resolveTurn, createBattle } from '../src/battle';
import { bannerFor, introSteps, outcomeSteps, turnSteps } from '../src/choreo';
import { MOVES, STRIKE_MOVE } from '../src/content/moves';
import type { Step, Stats } from '../src/types';
import { makeBoss } from './fixtures';

const stats: Stats = { loyalty: 30, reputation: 20, competence: 30, stress: 10 };
const move = (id: string) => MOVES.find(m => m.id === id)!;
const types = (steps: Step[]) => steps.map(s => s.t);
const has = (steps: Step[], pred: (s: Step) => boolean) => steps.some(pred);

describe('introSteps', () => {
  it('ROUND 1, реплика босса, FIGHT!', () => {
    const s = introSteps(makeBoss());
    expect(s.filter(x => x.t === 'banner').map(x => (x as any).text)).toEqual(['ROUND 1', 'FIGHT!']);
    expect(has(s, x => x.t === 'line' && x.text === 'Ну, начнём.')).toBe(true);
  });
});

describe('turnSteps: обычный удар', () => {
  const boss = makeBoss();
  const b0 = createBattle(boss);
  const r = resolveTurn(b0, move('data'), stats, boss, () => 0.9);
  const s = turnSteps(r, boss, b0);
  it('герой атакует: attack, шаг, камера, вспышка, hurt босса, тряска, цифра, полоска, реплика', () => {
    expect(has(s, x => x.t === 'pose' && x.who === 'hero' && x.pose === 'attack')).toBe(true);
    expect(has(s, x => x.t === 'flash')).toBe(true);
    expect(has(s, x => x.t === 'shake')).toBe(true);
    expect(has(s, x => x.t === 'particles' && x.at === 'boss')).toBe(true);
    expect(has(s, x => x.t === 'damage' && x.at === 'boss' && x.value === 15 && !x.muted)).toBe(true);
    expect(has(s, x => x.t === 'bar' && x.who === 'boss' && x.to === r.battle.patience)).toBe(true);
    expect(has(s, x => x.t === 'line' && x.style === 'bubble' && x.text === 'Ай.')).toBe(true);
  });
  it('босс отвечает и все возвращаются в idle', () => {
    expect(has(s, x => x.t === 'pose' && x.who === 'boss' && x.pose === 'attack')).toBe(true);
    expect(has(s, x => x.t === 'damage' && x.at === 'hero' && x.value === 11)).toBe(true);
    expect(has(s, x => x.t === 'bar' && x.who === 'hero' && x.to === r.battle.confidence)).toBe(true);
    // хвост при continue: pose boss idle, move boss 0, camera 1, pose hero idle
    const tail = s.slice(-4);
    expect(types(tail)).toEqual(['pose', 'move', 'camera', 'pose']);
    expect(has(tail, x => x.t === 'camera' && x.zoom === 1)).toBe(true);
    expect(has(tail, x => x.t === 'move' && x.dx === 0)).toBe(true);
    const idles = s.filter(x => x.t === 'pose' && x.pose === 'idle');
    expect(idles.length).toBeGreaterThanOrEqual(2);
  });
  it('тряска пропорциональна урону: 4 + 15*0.3 = 8.5', () => {
    const shake = s.find(x => x.t === 'shake') as Extract<Step, { t: 'shake' }>;
    expect(shake.amp).toBeCloseTo(8.5);
  });
  it('порядок: вспышка перед цифрой урона, а контрудар босса — перед возвратом в idle', () => {
    const flashIdx = s.findIndex(x => x.t === 'flash');
    const damageIdx = s.findIndex(x => x.t === 'damage' && x.at === 'boss');
    const bossAttackIdx = s.findIndex(x => x.t === 'pose' && x.who === 'boss' && x.pose === 'attack');
    const bossDamageIdx = s.findIndex(x => x.t === 'damage' && x.at === 'hero');
    const heroIdleIdx = s.map((x, i) => ({ x, i })).filter(({ x }) => x.t === 'pose' && x.pose === 'idle').pop()!.i;
    expect(flashIdx).toBeGreaterThanOrEqual(0);
    expect(damageIdx).toBeGreaterThan(flashIdx);
    expect(bossAttackIdx).toBeGreaterThan(damageIdx);
    expect(bossDamageIdx).toBeGreaterThan(bossAttackIdx);
    expect(heroIdleIdx).toBeGreaterThan(bossDamageIdx);
  });
});

describe('turnSteps: иммунитет', () => {
  const boss = makeBoss({ immunity: 'joke' });
  const b0 = createBattle(boss);
  const r = resolveTurn(b0, move('joke'), stats, boss, () => 0.9);
  const s = turnSteps(r, boss, b0);
  it('нет вспышки, тряски и партиклов на ударе игрока; цифра серая; звук immune; реплика immune', () => {
    const bossAttackIdx = s.findIndex(x => x.t === 'pose' && x.who === 'boss' && x.pose === 'attack');
    expect(bossAttackIdx).toBeGreaterThan(0);
    const playerPart = s.slice(0, bossAttackIdx);
    expect(has(playerPart, x => x.t === 'flash')).toBe(false);
    expect(has(playerPart, x => x.t === 'shake')).toBe(false);
    expect(has(playerPart, x => x.t === 'particles')).toBe(false);
    expect(has(playerPart, x => x.t === 'damage' && x.muted)).toBe(true);
    expect(has(playerPart, x => x.t === 'sound' && x.name === 'immune')).toBe(true);
    expect(has(playerPart, x => x.t === 'line' && x.text === 'Не смешно.')).toBe(true);
  });
});

describe('turnSteps: спецприём босса', () => {
  const boss = makeBoss();
  const b0 = createBattle(boss);
  const r = resolveTurn(b0, move('data'), stats, boss, () => 0.1);
  const s = turnSteps(r, boss, b0);
  it('dim, красная вспышка, реплика по центру, звук special', () => {
    expect(has(s, x => x.t === 'dim' && x.to === 0.4)).toBe(true);
    expect(has(s, x => x.t === 'dim' && x.to === 0)).toBe(true);
    expect(has(s, x => x.t === 'flash' && x.color !== '#ffffff')).toBe(true);
    expect(has(s, x => x.t === 'line' && x.style === 'center' && x.text === 'Вот тебе!')).toBe(true);
    expect(has(s, x => x.t === 'sound' && x.name === 'special')).toBe(true);
  });
  it('порядок: dim 0.4 -> реплика по центру -> красная вспышка -> dim 0 -> атака босса', () => {
    const dimOnIdx = s.findIndex(x => x.t === 'dim' && x.to === 0.4);
    const centerLineIdx = s.findIndex(x => x.t === 'line' && x.style === 'center');
    const preFlashIdx = s.findIndex(x => x.t === 'flash' && x.color === '#c81e1e');
    const dimOffIdx = s.findIndex(x => x.t === 'dim' && x.to === 0);
    const attackPoseIdx = s.findIndex(x => x.t === 'pose' && x.who === 'boss' && x.pose === 'attack');
    expect(dimOnIdx).toBeGreaterThanOrEqual(0);
    expect(centerLineIdx).toBeGreaterThan(dimOnIdx);
    expect(preFlashIdx).toBeGreaterThan(centerLineIdx);
    expect(dimOffIdx).toBeGreaterThan(preFlashIdx);
    expect(attackPoseIdx).toBeGreaterThan(dimOffIdx);
  });
});

describe('turnSteps: добивающий удар', () => {
  const boss = makeBoss({ patience: 10 });
  const b0 = createBattle(boss);
  const r = resolveTurn(b0, move('data'), stats, boss, () => 0.9);
  it('босс не атакует', () => {
    const s = turnSteps(r, boss, b0);
    expect(has(s, x => x.t === 'pose' && x.who === 'boss' && x.pose === 'attack')).toBe(false);
  });
});

describe('turnSteps: FINISH HIM', () => {
  const boss = makeBoss({ final: true, patience: 100 });
  const b0 = { ...createBattle(boss), patience: 25 };
  const r = resolveTurn(b0, move('data'), stats, boss, () => 0.9);
  it('баннер FINISH HIM появляется при переходе finishHim и не повторяется', () => {
    const s0 = turnSteps(r, boss, b0);
    expect(has(s0, x => x.t === 'banner' && x.text === 'FINISH HIM')).toBe(true);
    const b1 = { ...b0, finishHim: true };
    const r2 = resolveTurn(b1, move('data'), stats, boss, () => 0.9);
    expect(has(turnSteps(r2, boss, b1), x => x.t === 'banner' && x.text === 'FINISH HIM')).toBe(false);
  });
  it('порядок: FINISH HIM появляется после контратаки босса', () => {
    const s0 = turnSteps(r, boss, b0);
    const bossDamageIdx = s0.findIndex(x => x.t === 'damage' && x.at === 'hero');
    const finishBannerIdx = s0.findIndex(x => x.t === 'banner' && x.text === 'FINISH HIM');
    expect(bossDamageIdx).toBeGreaterThanOrEqual(0);
    expect(finishBannerIdx).toBeGreaterThan(bossDamageIdx);
  });
});

describe('bannerFor / outcomeSteps', () => {
  const boss = makeBoss({ patience: 10 });
  it('FLAWLESS без иммунитета и спецприёма, иначе PROMOTION', () => {
    const r = resolveTurn(createBattle(boss), move('data'), stats, boss, () => 0.9);
    expect(bannerFor(r)).toBe('FLAWLESS PRESENTATION');
    expect(bannerFor({ ...r, battle: { ...r.battle, hitImmune: true } })).toBe('PROMOTION!!!');
    expect(bannerFor({ ...r, battle: { ...r.battle, bossSpecialHit: true } })).toBe('PROMOTION!!!');
  });
  it('победа: точная последовательность шагов', () => {
    const r = resolveTurn(createBattle(boss), move('data'), stats, boss, () => 0.9);
    const s = outcomeSteps(r, boss);
    expect(s).toEqual([
      { t: 'pose', who: 'boss', pose: 'defeated' },
      { t: 'pose', who: 'hero', pose: 'win' },
      { t: 'timeScale', to: 0.5 },
      { t: 'wait', ms: 1000 },
      { t: 'timeScale', to: 1 },
      { t: 'line', text: 'Ладно…', style: 'bubble' },
      { t: 'banner', text: 'FLAWLESS PRESENTATION' },
      { t: 'voice', id: 'vo_flawless' },
      { t: 'sound', name: 'banner' },
      { t: 'sound', name: 'win' },
      { t: 'particles', at: 'screen', kind: 'confetti' },
      { t: 'wait', ms: 1500 },
    ]);
  });
  it('поражение: точная последовательность шагов', () => {
    const big = makeBoss({ patience: 1000, attack: 200 });
    const r = resolveTurn(createBattle(big), move('data'), stats, big, () => 0.9);
    const s = outcomeSteps(r, big);
    expect(bannerFor(r)).toBe('PERFORMANCE REVIEW');
    expect(s).toEqual([
      { t: 'pose', who: 'hero', pose: 'hurt' },
      { t: 'grayscale', to: 1, ms: 600 },
      { t: 'banner', text: 'PERFORMANCE REVIEW' },
      { t: 'voice', id: 'vo_performance_review' },
      { t: 'sound', name: 'banner' },
      { t: 'sound', name: 'lose' },
      { t: 'wait', ms: 1500 },
    ]);
  });
  it('fatality: точная последовательность шагов', () => {
    const fb = makeBoss({ final: true });
    const b = { ...createBattle(fb), finishHim: true };
    const r = resolveTurn(b, STRIKE_MOVE, stats, fb, () => 0.9);
    const s = outcomeSteps(r, fb);
    expect(bannerFor(r)).toBe('FATALITY');
    expect(s).toEqual([
      { t: 'pose', who: 'hero', pose: 'attack' },
      { t: 'move', who: 'hero', dx: 200, ms: 120 },
      { t: 'flash', ms: 120, color: '#c81e1e' },
      { t: 'sound', name: 'hit', gain: 1 },
      { t: 'pose', who: 'boss', pose: 'defeated' },
      { t: 'bar', who: 'boss', to: 0, ms: 200 },
      { t: 'shake', ms: 600, amp: 24 },
      { t: 'particles', at: 'boss', kind: 'sparks' },
      { t: 'banner', text: 'FATALITY' },
      { t: 'voice', id: 'vo_fatality' },
      { t: 'sound', name: 'banner' },
      { t: 'wait', ms: 1800 },
    ]);
  });
  it('turnSteps на fatality: не проигрывает фиктивный удар героя, вся анимация — в outcomeSteps', () => {
    const fb = makeBoss({ final: true });
    const b = { ...createBattle(fb), finishHim: true };
    const r = resolveTurn(b, STRIKE_MOVE, stats, fb, () => 0.9);
    const ts = turnSteps(r, fb, b);
    expect(ts).toEqual([]);
    expect(has(ts, x => x.t === 'damage')).toBe(false);
    expect(has(ts, x => x.t === 'pose' && x.who === 'boss' && x.pose === 'hurt')).toBe(false);
    expect(has(outcomeSteps(r, fb), x => x.t === 'banner' && x.text === 'FATALITY')).toBe(true);
  });
  it('outcomeSteps пуст при continue', () => {
    const r = resolveTurn(createBattle(makeBoss()), move('data'), stats, makeBoss(), () => 0.9);
    expect(outcomeSteps(r, makeBoss())).toEqual([]);
  });
});
