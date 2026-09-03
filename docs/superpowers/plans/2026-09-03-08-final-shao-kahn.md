# Этап 8: Финал — Шао Кан, Fatality, плейтест, деплой — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Финальная ступень «Зам Шао Кана» с настоящим Шао Каном, эпилоги концовок с портретами (в том числе Джакс из охраны после Fatality), удаление dev-контента, плейтест баланса всей лестницы симуляцией, деплой на GitHub Pages.

**Architecture:** Контент ступени 5 — `src/content/ranks/05-deputy.ts` (`events: []`, `boss.final: true`). Эпилоги — новое необязательное поле `epilogue` у `Ending`, показывается экраном концовки (единственная правка движка на этапе). Баланс проверяется скриптом `tools/simulate.ts` поверх чистых `battle.ts` и `state.ts`. Деплой — GitHub Actions workflow, собирающий `dist/` и публикующий в Pages.

**Tech Stack:** тот же. Генерация: `npm run gen -- --group rank5`, `--group endings` (Джакс). GitHub Actions `actions/deploy-pages`.

**Spec:** `docs/superpowers/specs/2026-09-03-corporate-mortal-kombat-design.md`

## Global Constraints

- Шао Кан: терпение 260, атака 16, слабость `agree`, иммунитет `data`, `final: true`, `events: []`. Единственный босс с `final: true`, он последний.
- «Ударить» включается только после `FINISH HIM` (уже в движке); контент этого не трогает.
- Все dev-записи (`src/content/ranks/dev.ts`, `bg_dev_throne`, `pt_dev2_*`, `sp_dev2_*`) удаляются на этом этапе.
- Ориентир баланса при «правильной» стратегии (всегда слабость): победа над каждым боссом в 60–85% симуляций при статах, которые даёт честное прохождение; при случайной стратегии — 25–50%. Регулируются только `patience` и `attack` боссов.
- Коммит после каждой задачи.

---

### Task 1: Контент финала и удаление dev

**Files:**
- Create: `src/content/ranks/05-deputy.ts`
- Modify: `src/content/index.ts`
- Delete: `src/content/ranks/dev.ts`

**Interfaces:**
- Produces: `RANK_DEPUTY: Rank` (`id: 'deputy'`, `title: 'Заместитель Шао Кана'`, `background: 'bg_throne_office'`, `events: []`, босс `shao_kahn`). Ассеты: `bg_throne_office`, `pt_shao_neutral`, `pt_shao_angry`, `sp_shao_idle/attack/hurt/defeated`.

- [ ] **Step 1: `src/content/ranks/05-deputy.ts`**

```ts
import type { Rank } from '../../types';

export const RANK_DEPUTY: Rank = {
  id: 'deputy',
  title: 'Заместитель Шао Кана',
  background: 'bg_throne_office',
  events: [],
  boss: {
    id: 'shao_kahn',
    name: 'Шао Кан',
    title: 'Генеральный директор Внешнего Мира',
    patience: 260,
    attack: 16,
    weakness: 'agree',
    immunity: 'data',
    final: true,
    sprites: { idle: 'sp_shao_idle', attack: 'sp_shao_attack', hurt: 'sp_shao_hurt', defeated: 'sp_shao_defeated' },
    portraits: { neutral: 'pt_shao_neutral', angry: 'pt_shao_angry' },
    intro: 'У тебя пять минут. Слайды — на стену. Императора не интересуют цифры. Императора интересует, кто с ним согласен.',
    lines: {
      hit: [
        'Продолжай. Пока что ты жив.',
        'Хм. Милина была права насчёт тебя.',
        'Это… приемлемо.',
        'Смелее. Я слышал презентации и похуже. Их авторов ты видел на полке.',
        'Ты начинаешь мне нравиться. Это опасно для нас обоих.',
      ],
      immune: [
        'Цифры? Я император, а не бухгалтер.',
        'Твой график ничего не значит. Я сам решаю, что растёт.',
        'Данные врут. Синдел мне это доказывала тридцать лет подряд.',
      ],
      special: [
        'ТЫ ЕЩЁ НЕ ГОТОВ!',
        'Слабо. Очень слабо.',
        'ЭТО ВНЕШНИЙ МИР, А НЕ ЗЕМНОЕ ЦАРСТВО!',
      ],
      defeated: [
        'Годится. Твой стол — у окна. Табличку закажи сам.',
      ],
    },
  },
};
```

- [ ] **Step 2: `src/content/index.ts`**

```ts
import { RANK_INTERN } from './ranks/00-intern';
import { RANK_JUNIOR } from './ranks/01-junior';
import { RANK_SPECIALIST } from './ranks/02-specialist';
import { RANK_LEAD } from './ranks/03-lead';
import { RANK_DIRECTOR } from './ranks/04-director';
import { RANK_DEPUTY } from './ranks/05-deputy';

export const RANKS: Rank[] = [RANK_INTERN, RANK_JUNIOR, RANK_SPECIALIST, RANK_LEAD, RANK_DIRECTOR, RANK_DEPUTY];
```

Удалить `src/content/ranks/dev.ts` и импорт `DEV_RANKS`.

- [ ] **Step 3: Не коммитить до Task 2** (манифест).

---

### Task 2: Эпилоги концовок (единственная правка движка)

**Files:**
- Modify: `src/types.ts`, `src/content/endings.ts`, `src/screens/ending.ts`, `src/styles/screens.css`, `src/content/schema.ts`, `test/schema.test.ts`, `test/manifest.test.ts`

**Interfaces:**
- `Ending.epilogue?: { name: string; portrait: string; text: string }`.
- Экран концовки рендерит под основным текстом карточку с портретом, именем и репликой.
- `validateContent` проверяет id портретов эпилогов по манифесту (сигнатура расширяется: `validateContent(ranks, manifest, endings?)`).

- [ ] **Step 1: Тип и контент**

В `src/types.ts`:

```ts
export interface Ending {
  id: EndingId;
  title: string;
  text: string;
  illustration: string;
  epilogue?: { name: string; portrait: string; text: string };
}
```

В `src/content/endings.ts` добавить к каждой концовке:

```ts
promotion: { ..., epilogue: { name: 'Шао Кан', portrait: 'pt_shao_neutral', text: 'В понедельник в девять. Принеси кофе. Кофе-машину так никто и не починил.' } },
burnout:   { ..., epilogue: { name: 'Вы', portrait: 'pt_hero_worried', text: 'Я просто на минутку закрою глаза. Синергия подождёт.' } },
fatality:  { ..., epilogue: { name: 'Джакс, начальник охраны', portrait: 'pt_jax_neutral', text: 'Сэр. Пройдёмте. Классический геймплей у нас не предусмотрен политикой компании. Впечатляюще, конечно, но пройдёмте.' } },
```

- [ ] **Step 2: Валидатор и тест**

В `validateContent(ranks, manifest, endings?: Record<string, Ending>)`: если `endings` переданы — для каждой проверить `asset(e.illustration)` и, при наличии, `asset(e.epilogue.portrait)`. В `src/main.ts` передавать `CONTENT.endings`. В `test/schema.test.ts` добавить:

```ts
it('эпилог с несуществующим портретом — ошибка', () => {
  const endings = { ...CONTENT.endings, fatality: { ...CONTENT.endings.fatality, epilogue: { name: 'x', portrait: 'pt_ghost', text: 'y' } } };
  expect(validateContent(CONTENT.ranks, manifestJson as Manifest, endings).join()).toMatch(/pt_ghost/);
});
```

В `test/manifest.test.ts` в `collectContentAssetIds` добавить портреты эпилогов.

- [ ] **Step 3: Экран концовки**

В `src/screens/ending.ts` после `<p>${ending.text}</p>`:

```ts
${ending.epilogue ? `
  <div class="epilogue">
    <div class="epilogue-portrait" style="${portraitStyle(ctx, ending.epilogue.portrait)}"></div>
    <div><div class="epilogue-name">${ending.epilogue.name}</div><div class="epilogue-text">${ending.epilogue.text}</div></div>
  </div>` : ''}
```

где `portraitStyle` возвращает `background-image:url(...)` или `background:${placeholderBg(id)}`. Стили:

```css
.epilogue { display: flex; gap: 14px; align-items: flex-start; margin-top: 12px; padding: 12px; border: 1px solid rgba(201,163,74,0.35); background: rgba(255,255,255,0.03); }
.epilogue-portrait { width: 84px; height: 84px; flex: none; background-size: cover; background-position: center top; border: 1px solid rgba(201,163,74,0.5); }
.epilogue-name { font-family: var(--font-display); color: var(--gold); letter-spacing: 1px; margin-bottom: 4px; }
.epilogue-text { font-style: italic; }
```

- [ ] **Step 4: Не коммитить до Task 3.**

---

### Task 3: Манифест: тронный кабинет, Шао Кан, Джакс

**Files:**
- Modify: `assets/manifest.json`

Описание для промптов:

```
SHAO KAHN: a towering, massively muscular warlord-CEO, 2.3 m tall. Bare chest with a black leather harness bearing a silver skull medallion, spiked pauldrons, red cape, bronze gauntlets; on his head a horned skull-faced war helmet with a golden crest; glowing red eyes. Over the harness, an unbuttoned dark charcoal suit jacket that is far too small for him, and a corporate lanyard with a CEO badge. Same design as the warlord in the reference image.
```

```
JAX: head of corporate security — a very tall broad Black man with a shaved head, calm authoritative face, black security uniform shirt with a radio on the shoulder, dark tie, and two massive chrome cybernetic arms; earpiece.
```

- [ ] **Step 1: Фон** (`bg_throne_office`, group `rank5`, 1600×900, 2K)

«A CEO's office that is half throne room: a black stone throne behind a huge dark wooden executive desk with three monitors and a nameplate; tall arched windows with red drapes overlooking a stormy city; wall of trophies — skulls, a shattered Earthrealm globe, framed quarterly charts; iron braziers next to a printer; a map poster with the single word OUTWORLD. Empty of people, dramatic warm side light, lower third free for UI.»

- [ ] **Step 2: Портреты Шао Кана** (`pt_shao_neutral`, `pt_shao_angry`, 512×512, character `shao_kahn`)

neutral: «Head-and-shoulders portrait of SHAO KAHN looking down at camera with imperial contempt, helmet on, red eyes glowing softly; blurred throne office behind.» angry (`dependsOn: pt_shao_neutral`): «Same figure and framing; roaring, mouth open showing teeth, eyes blazing red, cape flaring.»

- [ ] **Step 3: Спрайты Шао Кана** (700×900, `character: shao_kahn`, chroma `#FF00FF`, `flip: false`, файлы `img/sprites/shao_<pose>.webp`)

| id | dependsOn | prompt |
|----|-----------|--------|
| `sp_shao_idle` | `pt_shao_neutral` | «Full body head to boots, SHAO KAHN standing wide-legged with arms crossed, three-quarter view facing LEFT, a laser pointer in one huge fist. Isolated on a flat uniform solid magenta background (#FF00FF), no floor, no shadow, even studio light from the right. **Cape kept close to the body.**» |
| `sp_shao_attack` | `sp_shao_idle` | «Same figure as the reference sprite. SHAO KAHN lunging LEFT, slamming a giant fist down onto an invisible desk, papers exploding, mouth open in a roar. Same magenta background, same scale.» |
| `sp_shao_hurt` | `sp_shao_idle` | «Same figure. SHAO KAHN staggering back to the RIGHT, one hand to the helmet, cape swinging, surprised anger. Same magenta background, same scale.» |
| `sp_shao_defeated` | `sp_shao_idle` | «Same figure. SHAO KAHN on one knee, head bowed, one hand on the floor, the other holding out a signed contract; helmet slightly tilted. Same magenta background, same scale.» |

- [ ] **Step 4: Джакс** (`pt_jax_neutral`, group `endings`, 512×512, character `jax`)

«Head-and-shoulders portrait of JAX in a dim office corridor lit by an emergency light, looking at camera with a tired, unimpressed expression, one chrome hand raised in a “come with me” gesture.»

- [ ] **Step 5: Удалить dev-записи** (`bg_dev_throne`, `pt_dev2_neutral`, `pt_dev2_angry`, `sp_dev2_*`).

- [ ] **Step 6: Тесты и коммит (Task 1–3)**

Run: `npm run typecheck && npm test && npm run gen -- --dry-run --group rank5`
Expected: PASS; dry-run 7 записей ≈ 0.42 $ (+ Джакс в `endings` 0.045 $).

```bash
git add -A && git commit -m "feat(final): Shao Kahn rank, ending epilogues with portraits, remove dev content"
```

---

### Task 4: Генерация

- [ ] **Step 1:** `npm run gen -- --only bg_throne_office,pt_shao_neutral` — проверить: шлем, красные глаза, пиджак поверх доспеха, кабинет-тронный зал.
- [ ] **Step 2:** `npm run gen -- --group rank5` и `npm run gen -- --only pt_jax_neutral`. Проверить спрайты: плащ не режется краем холста (если режется — в промпт «cape tucked behind the body», `--force` для этой позы), масштаб одинаковый, смотрит влево.
- [ ] **Step 3:** `npm run assets:check` — все 54 картинки и 14 аудио сгенерированы, бюджет соблюдён. `npm test` PASS.

```bash
git add -A && git commit -m "assets(final): throne office, Shao Kahn, Jax"
```

---

### Task 5: Симуляция баланса

**Files:**
- Create: `tools/simulate.ts`, `test/balance.test.ts`

**Interfaces:**
- `simulateRun(ranks, strategy, rng): { reachedRank: number; ending: EndingId; turnsPerBoss: number[]; defeats: number }` — чистая функция поверх `state.ts` и `battle.ts`: для каждой ступени выбирает варианты событий по стратегии (`'first' | 'random' | 'best'`), потом бьётся выбранной боевой стратегией (`'weakness' | 'random' | 'neutral'`) до победы или Выгорания.
- CLI `npx tsx tools/simulate.ts [runs=500]` печатает таблицу: босс → доля побед с первого раза, средние ходы, средний стресс на входе.

- [ ] **Step 1: `tools/simulate.ts`**

```ts
import { availableMoves, createBattle, resolveTurn } from '../src/battle';
import { CONTENT } from '../src/content';
import { afterBattle, applyChoice, checkEnding, createInitialState, currentEvent, visibleChoices } from '../src/state';
import type { Boss, EndingId, GameState, Rank } from '../src/types';

export type EventStrategy = 'first' | 'random' | 'best';
export type FightStrategy = 'weakness' | 'random' | 'neutral';

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function pickChoice(state: GameState, choices: ReturnType<typeof visibleChoices>, strat: EventStrategy, rng: () => number) {
  if (strat === 'first') return choices[0]!;
  if (strat === 'random') return choices[Math.floor(rng() * choices.length)]!;
  // best: максимизируем сумму позитивных статов минус стресс
  return [...choices].sort((a, b) => score(b.effects) - score(a.effects))[0]!;
  function score(e?: Partial<Record<string, number>>) { if (!e) return 0; return (e['loyalty'] ?? 0) + (e['reputation'] ?? 0) + (e['competence'] ?? 0) - 2 * (e['stress'] ?? 0); }
}

function fight(state: GameState, boss: Boss, strat: FightStrategy, rng: () => number): { outcome: 'win' | 'lose'; turns: number } {
  let b = createBattle(boss);
  for (let turn = 0; turn < 60; turn++) {
    const moves = availableMoves(boss, b).filter(m => m.enabled && m.move.id !== 'strike').map(m => m.move);
    let move = moves[0]!;
    if (strat === 'weakness') move = moves.find(m => m.id === boss.weakness) ?? move;
    else if (strat === 'random') move = moves[Math.floor(rng() * moves.length)]!;
    else move = moves.find(m => m.id !== boss.weakness && m.id !== boss.immunity) ?? move;
    const r = resolveTurn(b, move, state.stats, boss, rng);
    b = r.battle;
    if (r.outcome === 'win') return { outcome: 'win', turns: turn + 1 };
    if (r.outcome === 'lose') return { outcome: 'lose', turns: turn + 1 };
  }
  return { outcome: 'lose', turns: 60 };
}

export function simulateRun(ranks: Rank[], ev: EventStrategy, fs: FightStrategy, rng: () => number) {
  let s = createInitialState();
  const firstTry: boolean[] = [];
  const turns: number[] = [];
  const stressAtBoss: number[] = [];
  let defeats = 0;
  for (let guard = 0; guard < 200; guard++) {
    const e = currentEvent(s, ranks);
    if (e) { s = applyChoice(s, e, pickChoice(s, visibleChoices(e, s), ev, rng)); }
    else {
      const boss = ranks[s.rank]!.boss;
      if (firstTry.length === s.rank) { stressAtBoss.push(s.stats.stress); }
      const f = fight(s, boss, fs, rng);
      if (firstTry.length === s.rank) { firstTry.push(f.outcome === 'win'); turns.push(f.turns); }
      if (f.outcome === 'lose') defeats++;
      s = afterBattle(s, boss, f.outcome);
    }
    const end: EndingId | null = checkEnding(s, ranks);
    if (end) return { ending: end, firstTry, turns, stressAtBoss, defeats, reachedRank: s.rank };
  }
  return { ending: 'burnout' as EndingId, firstTry, turns, stressAtBoss, defeats, reachedRank: s.rank };
}

export function summarize(ranks: Rank[], ev: EventStrategy, fs: FightStrategy, runs: number) {
  const rng = mulberry32(42);
  const wins = ranks.map(() => 0), tries = ranks.map(() => 0), turnSum = ranks.map(() => 0), stressSum = ranks.map(() => 0);
  let promotions = 0;
  for (let i = 0; i < runs; i++) {
    const r = simulateRun(ranks, ev, fs, rng);
    if (r.ending === 'promotion') promotions++;
    r.firstTry.forEach((w, k) => { tries[k]!++; if (w) wins[k]!++; turnSum[k]! += r.turns[k]!; stressSum[k]! += r.stressAtBoss[k]!; });
  }
  return {
    promotionRate: promotions / runs,
    bosses: ranks.map((r, k) => ({ boss: r.boss.name, firstTryWin: tries[k] ? wins[k]! / tries[k]! : 0, avgTurns: tries[k] ? turnSum[k]! / tries[k]! : 0, avgStress: tries[k] ? stressSum[k]! / tries[k]! : 0 })),
  };
}

if (process.argv[1]?.endsWith('simulate.ts')) {
  const runs = Number(process.argv[2] ?? 500);
  for (const [ev, fs] of [['best', 'weakness'], ['random', 'random'], ['first', 'neutral']] as const) {
    const s = summarize(CONTENT.ranks, ev, fs, runs);
    console.log(`\n=== events=${ev} fight=${fs}: promotion ${(s.promotionRate * 100).toFixed(0)}%`);
    console.table(s.bosses.map(b => ({ ...b, firstTryWin: `${(b.firstTryWin * 100).toFixed(0)}%`, avgTurns: b.avgTurns.toFixed(1), avgStress: b.avgStress.toFixed(0) })));
  }
}
```

- [ ] **Step 2: Тест-ограничитель `test/balance.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { summarize } from '../tools/simulate';

describe('balance', () => {
  it('при правильной стратегии каждый босс берётся с первого раза в 60–95%, промоушен ≥ 50%', () => {
    const s = summarize(CONTENT.ranks, 'best', 'weakness', 300);
    for (const b of s.bosses) { expect(b.firstTryWin, b.boss).toBeGreaterThanOrEqual(0.6); expect(b.firstTryWin, b.boss).toBeLessThanOrEqual(0.95); }
    expect(s.promotionRate).toBeGreaterThanOrEqual(0.5);
  });
  it('при случайной стратегии игра не тривиальна: промоушен ≤ 40%, но первый босс берётся ≥ 30%', () => {
    const s = summarize(CONTENT.ranks, 'random', 'random', 300);
    expect(s.promotionRate).toBeLessThanOrEqual(0.4);
    expect(s.bosses[0]!.firstTryWin).toBeGreaterThanOrEqual(0.3);
  });
  it('бой при слабости длится 4–9 ходов', () => {
    const s = summarize(CONTENT.ranks, 'best', 'weakness', 300);
    for (const b of s.bosses) { expect(b.avgTurns, b.boss).toBeGreaterThanOrEqual(4); expect(b.avgTurns, b.boss).toBeLessThanOrEqual(9); }
  });
});
```

- [ ] **Step 3: Прогон и тюнинг**

Run: `npx tsx tools/simulate.ts 1000`
Если тест красный — менять только `patience` и `attack` конкретного босса в его файле ступени (шаг 10 терпения / 1 атаки), повторять до зелёного. Записать финальную таблицу боссов в README (раздел «Баланс») и обновить таблицу в спеке, если числа изменились.

```bash
git add -A && git commit -m "test: balance simulation across the whole ladder"
```

---

### Task 6: Ручной плейтест полной игры

- [ ] **Step 1:** `npm run dev`, полное прохождение до «Заместителя Шао Кана»: все шесть боёв, музыка меняется (лаунж → совет → бой → финал → концовка), диктор на баннерах, FINISH HIM у Шао Кана, эпилог с портретом Шао Кана.
- [ ] **Step 2:** Второе прохождение: на финале дождаться FINISH HIM и нажать «Ударить» → FATALITY → концовка с Джаксом.
- [ ] **Step 3:** Третье: намеренно проигрывать первому боссу до Выгорания → концовка с портретом героя.
- [ ] **Step 4:** Ресайз окна на экране боя и события, mute, хоткеи. Консоль без ошибок.
- [ ] **Step 5:** Скриншоты всех шести боёв и трёх концовок в `docs/screenshots/final-*.png`. Гифка одного удара по желанию.

Найденные баги — исправлять в соответствующих модулях с коммитами `fix: ...`.

---

### Task 7: Деплой на GitHub Pages

**Files:**
- Create: `.github/workflows/pages.yml`
- Modify: `README.md`

- [ ] **Step 1: Workflow**

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: npm }
      - run: npm ci --ignore-scripts
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: { name: github-pages, url: ${{ steps.deployment.outputs.page_url }} }
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Проверка сборки локально**

Run: `npm run build && npx vite preview`
Открыть превью, пройти первую ступень: ассеты грузятся по относительным путям (`base: './'`), звук работает.

- [ ] **Step 3: Репозиторий и Pages**

Создать репозиторий на GitHub (`gh repo create wowsel/corporate-mortal-combat --public --source . --push`), в настройках Pages выбрать «GitHub Actions». Дождаться зелёного workflow, открыть URL, пройти первую ступень.

- [ ] **Step 4: README**

Ссылка на игру, скриншот титула, раздел «Как играть» (хоткеи 1–5, Enter), раздел «Как это сделано» (ссылка на спеку и планы), статус «этап 8 из 8, готово», итоговая стоимость генерации ассетов.

```bash
git add -A && git commit -m "ci: GitHub Pages deploy; docs: release notes" && git push
```

## Что дальше

Ничего обязательного. Идеи после релиза: мобильная раскладка, сохранение прогресса, «Новая игра+» с другим героем, ачивки («Прошёл без единой шутки»).
