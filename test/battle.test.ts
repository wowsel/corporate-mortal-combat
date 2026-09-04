import { describe, expect, it } from 'vitest';
import { EXCHANGE_COUNT, LOOP_TAIL, availableMoves, baseDamage, bossDamage, createBattle, moveDamage, nextExchange, resolveTurn } from '../src/battle';
import { MOVES, STRIKE_MOVE } from '../src/content/moves';
import type { Stats } from '../src/types';
import { makeBoss } from './fixtures';

const stats: Stats = { loyalty: 30, reputation: 20, competence: 30, stress: 10 };
const move = (id: string) => MOVES.find(m => m.id === id)!;
const never = () => 0.9;  // спецприёма нет, lineIndex special последний
const always = () => 0.1; // спецприём

describe('moveDamage', () => {
  const boss = makeBoss({ weakness: 'agree', immunity: 'joke' });
  it('нейтральный: 10 + 30*0.15 = 14.5 → 15', () => expect(moveDamage(move('data'), stats, boss)).toBe(15));
  it('слабость ×2: (10 + 4.5)*2 = 29', () => expect(moveDamage(move('agree'), stats, boss)).toBe(29));
  it('иммунитет ×0.25: joke = 10 + 3 - 0.5 = 12.5 * 0.25 → 3', () => expect(moveDamage(move('joke'), stats, boss)).toBe(3));
  it('joke штрафуется стрессом и не ниже 3', () => {
    const b = makeBoss({ weakness: 'agree', immunity: 'blame' });
    expect(moveDamage(move('joke'), { ...stats, stress: 90 }, b)).toBe(9); // 10 + 3 - 4.5 = 8.5 → 9
    expect(moveDamage(move('joke'), { ...stats, reputation: 0, stress: 100 }, b)).toBe(5); // 10 + 0 - 5 = 5, пол 3 не срабатывает
    const imm = makeBoss({ weakness: 'agree', immunity: 'joke' });
    expect(moveDamage(move('joke'), { ...stats, reputation: 0, stress: 100 }, imm)).toBe(1); // 5 * 0.25 = 1.25 → 1
  });
});

describe('baseDamage', () => {
  // ни слабость, ни иммунитет не совпадают ни с одним базовым приёмом: множитель ровно 1
  const neutral = makeBoss({ weakness: 'strike', immunity: 'strike' });
  const statSets: Stats[] = [
    stats,
    { loyalty: 0, reputation: 0, competence: 0, stress: 0 },
    { loyalty: 100, reputation: 100, competence: 100, stress: 100 },
  ];
  for (const st of statSets) {
    for (const m of MOVES) {
      it(`moveDamage = round(baseDamage) для ${m.id} при stress=${st.stress}`, () => {
        expect(moveDamage(m, st, neutral)).toBe(Math.round(baseDamage(m, st)));
      });
    }
  }
  it('strike без стата даёт 0', () => expect(baseDamage(STRIKE_MOVE, stats)).toBe(0));
  it('пол 3 у шутки при предельном стрессе', () => {
    expect(baseDamage(move('joke'), { loyalty: 0, reputation: 0, competence: 0, stress: 200 })).toBe(3);
  });
});

describe('bossDamage', () => {
  const boss = makeBoss({ attack: 10 });
  it('обычный: 10 + 0.5 → 11', () => expect(bossDamage(boss, stats, never)).toEqual({ damage: 11, special: false }));
  it('спецприём ×1.5 → 16', () => expect(bossDamage(boss, stats, always)).toEqual({ damage: 16, special: true }));
});

describe('createBattle', () => {
  it('заполняет полоски', () => {
    const b = createBattle(makeBoss({ patience: 120 }));
    expect(b).toEqual({ confidence: 100, maxConfidence: 100, patience: 120, maxPatience: 120, turn: 0, hitImmune: false, bossSpecialHit: false, finishHim: false, exchange: 0 });
  });
});

describe('availableMoves', () => {
  it('у обычного босса 4 приёма', () => {
    const b = createBattle(makeBoss());
    expect(availableMoves(makeBoss(), b).map(m => m.move.id)).toEqual(['agree', 'data', 'blame', 'joke']);
  });
  it('у финального 5, strike выключен до finishHim', () => {
    const boss = makeBoss({ final: true });
    const b = createBattle(boss);
    const list = availableMoves(boss, b);
    expect(list.length).toBe(5);
    expect(list[4]).toEqual({ move: STRIKE_MOVE, enabled: false });
    expect(availableMoves(boss, { ...b, finishHim: true })[4]!.enabled).toBe(true);
  });
});

describe('nextExchange', () => {
  it('идёт по порядку, потом крутит последние LOOP_TAIL', () => {
    const seq: number[] = []; let i = 0;
    for (let k = 0; k < EXCHANGE_COUNT + 4; k++) { seq.push(i); i = nextExchange(EXCHANGE_COUNT, i); }
    expect(seq).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 5, 6, 7, 5]);
    expect(LOOP_TAIL).toBe(3);
  });
  it('клампит у короткого босса', () => {
    expect(nextExchange(2, 1)).toBe(0);
    expect(nextExchange(1, 0)).toBe(0);
  });
});

describe('resolveTurn', () => {
  it('обычный ход: урон обоим, continue, turn+1, без lineIndex у игрока', () => {
    const boss = makeBoss({ patience: 100, attack: 10 });
    const r = resolveTurn(createBattle(boss), move('data'), stats, boss, never);
    expect(r.outcome).toBe('continue');
    expect(r.player).toEqual({ move: 'data', damage: 15, weakness: false, immune: false });
    expect(r.boss).toEqual({ damage: 11, special: false, lineIndex: 0 }); // rng: спецприём → реплика special (одна в фикстуре)
    expect(r.battle.patience).toBe(85); expect(r.battle.confidence).toBe(89); expect(r.battle.turn).toBe(1);
  });
  it('rng вызывается ровно дважды за обычный ход и ни разу при добивании', () => {
    let calls = 0; const rng = () => { calls++; return 0.9; };
    const boss = makeBoss({ patience: 100 });
    resolveTurn(createBattle(boss), move('data'), stats, boss, rng);
    expect(calls).toBe(2);
    calls = 0;
    const small = makeBoss({ patience: 10 });
    resolveTurn(createBattle(small), move('data'), stats, small, rng);
    expect(calls).toBe(0);
  });
  it('индекс обмена растёт каждый ход и зацикливается на хвосте', () => {
    const boss = makeBoss({ patience: 100000, attack: 0 });
    let b = createBattle(boss);
    const seen: number[] = [];
    for (let k = 0; k < 10; k++) { seen.push(b.exchange); b = resolveTurn(b, move('data'), stats, boss, never).battle; }
    expect(seen).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 5, 6]);
  });
  it('strike не двигает обмен', () => {
    const boss = makeBoss({ final: true });
    const b = { ...createBattle(boss), finishHim: true, exchange: 3 };
    expect(resolveTurn(b, STRIKE_MOVE, stats, boss, never).battle.exchange).toBe(3);
  });
  it('добивающий удар: win, босс не отвечает', () => {
    const boss = makeBoss({ patience: 10 });
    const r = resolveTurn(createBattle(boss), move('data'), stats, boss, never);
    expect(r.outcome).toBe('win'); expect(r.boss).toBeNull(); expect(r.battle.patience).toBe(0);
  });
  it('поражение при нуле уверенности', () => {
    const boss = makeBoss({ patience: 1000, attack: 200 });
    const r = resolveTurn(createBattle(boss), move('data'), stats, boss, never);
    expect(r.outcome).toBe('lose'); expect(r.battle.confidence).toBe(0);
  });
  it('удар по иммунитету ставит hitImmune', () => {
    const boss = makeBoss({ immunity: 'joke' });
    const r = resolveTurn(createBattle(boss), move('joke'), stats, boss, never);
    expect(r.player.immune).toBe(true); expect(r.battle.hitImmune).toBe(true);
  });
  it('спецприём босса ставит bossSpecialHit', () => {
    const boss = makeBoss();
    const r = resolveTurn(createBattle(boss), move('data'), stats, boss, always);
    expect(r.boss?.special).toBe(true); expect(r.battle.bossSpecialHit).toBe(true);
  });
  it('finishHim у финального при < 15%', () => {
    const boss = makeBoss({ final: true, patience: 100 });
    const b = { ...createBattle(boss), patience: 25 };
    const r = resolveTurn(b, move('data'), stats, boss, never); // 25 - 15 = 10 → 10%
    expect(r.battle.finishHim).toBe(true);
    const nb = makeBoss({ final: false, patience: 100 });
    expect(resolveTurn({ ...createBattle(nb), patience: 25 }, move('data'), stats, nb, never).battle.finishHim).toBe(false);
  });
  it('strike → fatality без ответа босса', () => {
    const boss = makeBoss({ final: true });
    const b = { ...createBattle(boss), finishHim: true };
    const r = resolveTurn(b, STRIKE_MOVE, stats, boss, never);
    expect(r.outcome).toBe('fatality'); expect(r.boss).toBeNull(); expect(r.player.damage).toBe(0);
  });
  it('strike недопустим, когда выключен', () => {
    const boss = makeBoss({ final: true });
    expect(() => resolveTurn(createBattle(boss), STRIKE_MOVE, stats, boss, never)).toThrow();
    expect(() => resolveTurn(createBattle(makeBoss()), STRIKE_MOVE, stats, makeBoss(), never)).toThrow();
  });
  it('не мутирует вход', () => {
    const boss = makeBoss();
    const b = createBattle(boss);
    resolveTurn(b, move('data'), stats, boss, never);
    expect(b.turn).toBe(0); expect(b.patience).toBe(100);
  });
});
