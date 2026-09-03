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
});

describe('turnSteps: иммунитет', () => {
  const boss = makeBoss({ immunity: 'joke' });
  const b0 = createBattle(boss);
  const r = resolveTurn(b0, move('joke'), stats, boss, () => 0.9);
  const s = turnSteps(r, boss, b0);
  it('нет вспышки, тряски и партиклов на ударе игрока; цифра серая; звук immune; реплика immune', () => {
    const playerPart = s.slice(0, s.findIndex(x => x.t === 'pose' && x.who === 'boss' && x.pose === 'attack'));
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
    expect(has(turnSteps(r, boss, b0), x => x.t === 'banner' && x.text === 'FINISH HIM')).toBe(true);
    const b1 = { ...b0, finishHim: true };
    const r2 = resolveTurn(b1, move('data'), stats, boss, () => 0.9);
    expect(has(turnSteps(r2, boss, b1), x => x.t === 'banner' && x.text === 'FINISH HIM')).toBe(false);
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
  it('победа: defeated, win, slow-mo, баннер, конфетти, звук win', () => {
    const r = resolveTurn(createBattle(boss), move('data'), stats, boss, () => 0.9);
    const s = outcomeSteps(r, boss);
    expect(has(s, x => x.t === 'pose' && x.who === 'boss' && x.pose === 'defeated')).toBe(true);
    expect(has(s, x => x.t === 'pose' && x.who === 'hero' && x.pose === 'win')).toBe(true);
    expect(has(s, x => x.t === 'timeScale' && x.to === 0.5)).toBe(true);
    expect(has(s, x => x.t === 'timeScale' && x.to === 1)).toBe(true);
    expect(has(s, x => x.t === 'banner' && x.text === 'FLAWLESS PRESENTATION')).toBe(true);
    expect(has(s, x => x.t === 'particles' && x.at === 'screen' && x.kind === 'confetti')).toBe(true);
    expect(has(s, x => x.t === 'sound' && x.name === 'win')).toBe(true);
    expect(has(s, x => x.t === 'line' && x.text === 'Ладно…')).toBe(true);
  });
  it('поражение: hurt, grayscale, PERFORMANCE REVIEW, звук lose', () => {
    const big = makeBoss({ patience: 1000, attack: 200 });
    const r = resolveTurn(createBattle(big), move('data'), stats, big, () => 0.9);
    const s = outcomeSteps(r, big);
    expect(bannerFor(r)).toBe('PERFORMANCE REVIEW');
    expect(has(s, x => x.t === 'grayscale' && x.to === 1)).toBe(true);
    expect(has(s, x => x.t === 'banner' && x.text === 'PERFORMANCE REVIEW')).toBe(true);
    expect(has(s, x => x.t === 'sound' && x.name === 'lose')).toBe(true);
  });
  it('fatality: FATALITY, красная вспышка, сильная тряска', () => {
    const fb = makeBoss({ final: true });
    const b = { ...createBattle(fb), finishHim: true };
    const r = resolveTurn(b, STRIKE_MOVE, stats, fb, () => 0.9);
    const s = outcomeSteps(r, fb);
    expect(bannerFor(r)).toBe('FATALITY');
    expect(has(s, x => x.t === 'banner' && x.text === 'FATALITY')).toBe(true);
    expect(has(s, x => x.t === 'shake' && x.amp >= 20)).toBe(true);
    expect(has(s, x => x.t === 'pose' && x.who === 'boss' && x.pose === 'defeated')).toBe(true);
  });
  it('outcomeSteps пуст при continue', () => {
    const r = resolveTurn(createBattle(makeBoss()), move('data'), stats, makeBoss(), () => 0.9);
    expect(outcomeSteps(r, makeBoss())).toEqual([]);
  });
});
