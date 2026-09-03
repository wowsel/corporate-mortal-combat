# Этап 7: Ступень 4 «Директор департамента» — Шанг Цунг и Рептилия — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Предпоследняя ступень карьеры: утечка данных, о которой докладывает Рептилия из IT-поддержки, тайная встреча с Шанг Цунгом и бой-подковёрная война с ним в серверной-подземелье. Появляется второстепенный персонаж (Рептилия, только портрет) и флаг `shang_secret`, который использует финал.

**Architecture:** Контент ступени — один файл `src/content/ranks/04-director.ts`, подключаемый в `src/content/index.ts` перед `DEV_RANKS`. Ассеты ступени — записи группы `rank4` в `assets/manifest.json`, генерируются пайплайном этапа 2. Движок не меняется: префетч группы `endings` на ступени ≥ 4 уже есть в `event.ts` с этапа 2.

**Tech Stack:** тот же, что на этапах 1–6. Генерация: `npm run gen -- --group rank4`.

**Spec:** `docs/superpowers/specs/2026-09-03-corporate-mortal-kombat-design.md`

## Global Constraints

- Ступень не последняя: ровно 2 события, 2–4 варианта в каждом, первый вариант без `requiresFlag`, каждый `requiresFlag` кем-то ставится. Доступные флаги прошлых ступеней: `intern_joker` (0), `baraka_respect` (1), `kitana_owes_you` (2), `sindel_budget_ally` (3). Ступень обязана поставить новый флаг `shang_secret` — его читает финал (этап 8).
- Шанг Цунг: терпение 185, атака 13, слабость `data`, иммунитет `blame`, `final: false`. Текст события перед боем содержит намёк на слабость (`/данн|цифр|график|отчёт/i`) и иммунитет (`/вин|стрелк|ответствен/i`) — это проверяет тест из этапа 3.
- Эффекты варианта в пределах ±15 на стат, дельты стресса ±5..10.
- Фон ступени один: `bg_server_dungeon` (1600×900, 2K). Портреты 512×512, спрайты 700×900, маджента `#FF00FF`, босс смотрит **влево** (герой вправо). Рептилия — только портрет `pt_reptile_neutral`, спрайтов нет.
- В палитре персонажей и локации **нет мадженты и розового**: зелёное свечение, янтарные индикаторы, чёрный шёлк, золото — всё контрастно к ключу. Зелёная кожа Рептилии на мадженте вырезается чисто.
- Порядок генерации: портрет neutral → idle → attack/hurt/defeated (референсы: стиль + портрет + idle) и портрет angry (референс: neutral). Портрет Рептилии и фон независимы.
- Dev-ступень `dev1` (Шао Кан) остаётся финальной до этапа 8.
- Все реплики и тексты на русском, тон — офисная сатира без грубости.
- Коммит после каждой задачи.

---

### Task 1: Контент ступени 4

**Files:**
- Create: `src/content/ranks/04-director.ts`
- Modify: `src/content/index.ts`, `test/content.test.ts` (добавить проверку флага `shang_secret`), `assets/manifest.json` (id ассетов должны существовать — добавляются в Task 2; **делать Task 1 и 2 одним коммитом**, иначе тест манифеста красный).

**Interfaces:**
- Produces: `export const RANK_DIRECTOR: Rank` с `id: 'director'`, `background: 'bg_server_dungeon'`, событиями `director_leak`, `director_intrigue`, боссом `shang_tsung`. Ставит флаг `shang_secret`. Ассеты: `bg_server_dungeon`, `pt_reptile_neutral`, `pt_shang_neutral`, `pt_shang_angry`, `sp_shang_idle`, `sp_shang_attack`, `sp_shang_hurt`, `sp_shang_defeated`.

- [ ] **Step 1: Написать `src/content/ranks/04-director.ts`**

```ts
import type { Rank } from '../../types';

export const RANK_DIRECTOR: Rank = {
  id: 'director',
  title: 'Директор департамента',
  background: 'bg_server_dungeon',
  events: [
    {
      id: 'director_leak',
      title: 'Утечка',
      speaker: { name: 'Рептилия', portrait: 'pt_reptile_neutral' },
      text: 'Директор, есссть минутка? Рептилия, IT-поддержка, тикет номер 6660. Квартальный отчёт вашего департамента утёк. Целиком. С комментариями. Кто-то открыл файл ночью с планшета, который в логах светится зелёным. Я никого не обвиняю, но в здании только один человек с таким планшетом, и он называет себя директором по трансссформации.',
      repeatText: 'Сссснова я, тикет 6660. Отчёт утёк опять, теперь уже с вашими правками. Я всё ещё никого не обвиняю. Я просто смотрю вон на тот зелёный огонёк в глубине серверной. И на вас.',
      choices: [
        {
          text: 'Немедленно завести инцидент по регламенту безопасности',
          effects: { competence: 10, loyalty: 5, stress: 10 },
          reaction: { portrait: 'pt_reptile_neutral', text: 'Регламент. Хорошо. Он хранится в подземелье, а я как раз тут живу — между стойками тепло. Тикет открыт, приоритет «критично», исполнитель… опять я.' },
        },
        {
          text: 'Разобраться тихо, своими силами, никому не сообщать',
          effects: { reputation: 5, loyalty: -5, stress: 5 },
          reaction: { portrait: 'pt_reptile_neutral', text: 'Тихо — это я умею. Меня двенадцать лет никто не замечает. Только учтите: в этой серверной тихо не бывает, тут всё пишется в лог. Даже шёпот.' },
        },
        {
          text: 'Попросить Китану поднять логи доступа — она вам должна',
          requiresFlag: 'kitana_owes_you',
          effects: { competence: 5, reputation: 10, stress: -5 },
          reaction: { portrait: 'pt_reptile_neutral', text: 'Китана вам должна? Ссссерьёзные связи. Она уже прислала выгрузку: файл открывали с планшета Шанг Цунга. Три раза. Последний — пока мы разговариваем.' },
        },
        {
          text: 'Предположить, что отчёт слила кофе-машина',
          requiresFlag: 'intern_joker',
          effects: { reputation: 5, stress: -5, competence: -5 },
          reaction: { portrait: 'pt_reptile_neutral', text: 'Не сссмешно. Хотя… кофе-машина действительно в корпоративной сети с эпохи Первой Династии. Проверю. Если это она — вы первый, кто раскрыл дело за счёт шутки.' },
        },
      ],
    },
    {
      id: 'director_intrigue',
      title: 'Интрига',
      speaker: { name: 'Шанг Цунг', portrait: 'pt_shang_neutral' },
      text: 'Полночь. Присаживайтесь — нет, не на тот алтарь, он под напряжением. Кабинет Синдел скоро освободится, и я хочу занять его вместе с вами. Взамен мелочь: ваш проект переезжает в мой департамент трансформации. Подпишите на планшете, он сам всё посчитает. И чтобы вы понимали, с кем говорите: обвинять меня бесполезно — я коллекционирую обвинения, вон полка. Переводить на меня стрелки тоже не советую: стрелки перевожу я, и лучше всех в компании. А вот отчёты с цифрами уберите со стола. У меня на данные аллергия.',
      repeatText: 'Вы вернулись. Значит, обдумали. Планшет всё ещё здесь, подпись всё ещё нужна. Напомню: обвинения и переводы стрелок — мимо, это моя стихия. А вот факты, графики и цифры я не переношу. Поэтому давайте без них.',
      choices: [
        {
          text: 'Вежливо отказаться и уйти',
          effects: { loyalty: 5, stress: 10 },
          reaction: { portrait: 'pt_shang_angry', text: 'Уйти? Конечно. Дверь заперта снаружи, но вы попробуйте. Мы обязательно продолжим разговор. На вашем performance review.' },
        },
        {
          text: 'Сделать вид, что согласны, и включить запись на телефоне',
          effects: { competence: 10, reputation: -5, stress: 10 },
          setFlag: 'shang_secret',
          reaction: { portrait: 'pt_shang_neutral', text: 'Мудро. Планшет показывает, что вы записываете. Записывайте. Только помните: у меня тоже есть запись. Ваша. С корпоратива. Теперь у нас общий секрет, директор.' },
        },
        {
          text: 'Сообщить, что Синдел уже в курсе — вы союзники по бюджету',
          requiresFlag: 'sindel_budget_ally',
          effects: { reputation: 10, loyalty: 5, stress: -5 },
          reaction: { portrait: 'pt_shang_angry', text: 'Синдел? Вы привели Синдел в мою серверную? Что ж. Это не меняет плана. Это меняет порядок кандидатов на трансформацию.' },
        },
        {
          text: 'Напомнить, что за вас вступится Барака со всей разработкой',
          requiresFlag: 'baraka_respect',
          effects: { loyalty: 10, competence: -5, stress: -5 },
          reaction: { portrait: 'pt_shang_neutral', text: 'Барака. Тимлид с зубами вместо аргументов. Хорошо, я запомню, что вы дружите с разработкой. Это редкая слабость для директора.' },
        },
      ],
    },
  ],
  boss: {
    id: 'shang_tsung',
    name: 'Шанг Цунг',
    title: 'Директор по трансформации',
    patience: 185,
    attack: 13,
    weakness: 'data',
    immunity: 'blame',
    final: false,
    sprites: {
      idle: 'sp_shang_idle', attack: 'sp_shang_attack', hurt: 'sp_shang_hurt', defeated: 'sp_shang_defeated',
    },
    portraits: { neutral: 'pt_shang_neutral', angry: 'pt_shang_angry' },
    intro: 'Присаживайтесь. Нет, не туда — там продакшен. Итак: ваш проект мне нужен. Вы — не особенно. Начнём трансформацию.',
    lines: {
      // hit звучит и как реакция на удар героя, и как реплика Шанг Цунга в его собственной атаке —
      // фразы должны работать в обе стороны
      hit: [
        'Цифры. Как вульгарно.',
        'Допустим. Записал в план трансформации.',
        'Интересная позиция. Она у вас последняя?',
        'Дальше. У меня ещё четыре департамента.',
      ],
      immune: [
        'Обвинение? Прекрасно. Ставлю на полку, к остальным.',
        'Я виноват? Разумеется. Я виноват во всём с эпохи Первой Династии. Это не аргумент, это биография.',
        'Переводить стрелки на директора по трансформации… Стрелки — это тоже трансформация. Мне нравится.',
      ],
      special: [
        'Смотрите: моё лицо становится вашим. И вашим голосом я говорю: «Передаю проект департаменту трансформации». Планшет уже записал.',
        'Узнаёте? Это вы на корпоративе. «Готов на всё ради компании». Всё — это всё, директор.',
      ],
      defeated: [
        'Хорошо. Проект ваш. Душа… тоже, пока. Планшет разрядился. Мы продолжим, когда Шао Кан освободит кабинет.',
      ],
    },
  },
};
```

Слабость `data` и иммунитет `blame` подсказаны прямо в тексте `director_intrigue`: «обвинять меня бесполезно… переводить стрелки — тоже… отчёты с цифрами уберите… на данные аллергия». `repeatText` дублирует намёк, чтобы после поражения игрок его не потерял.

- [ ] **Step 2: Подключить в `src/content/index.ts`**

```ts
import { RANK_INTERN } from './ranks/00-intern';
import { RANK_JUNIOR } from './ranks/01-junior';
import { RANK_SPECIALIST } from './ranks/02-specialist';
import { RANK_LEAD } from './ranks/03-lead';
import { RANK_DIRECTOR } from './ranks/04-director';
import { DEV_RANKS } from './ranks/dev';

export const RANKS: Rank[] = [RANK_INTERN, RANK_JUNIOR, RANK_SPECIALIST, RANK_LEAD, RANK_DIRECTOR, ...DEV_RANKS];
```

`src/content/ranks/dev.ts` не трогать: `dev1` с `dev_shao` остаётся последней и финальной ступенью до этапа 8. Индекс `RANK_DIRECTOR` в массиве — 4, поэтому `event.ts` при входе в её события вызовет `prefetchGroup('rank5')` (пока dev-заглушки, не сгенерированы — префетч отработает вхолостую) и `prefetchGroup('endings')` — иллюстрации концовок начнут грузиться заранее. Никаких изменений в движке.

- [ ] **Step 3: Проверить намёк и новый флаг тестом**

Тест намёка из этапа 3 (`test/content.test.ts`, `HINT_WORDS`) итерирует все ступени и автоматически покроет `director` (`data` → `/данн|цифр|график|отчёт/i`, `blame` → `/вин|стрелк|ответствен/i`). Добавить рядом проверку, что флаг для финала действительно ставится:

```ts
it('ступень 4 ставит флаг shang_secret для финала', () => {
  const director = CONTENT.ranks.find(r => r.id === 'director')!;
  const flags = director.events.flatMap(e => e.choices.map(c => c.setFlag)).filter(Boolean);
  expect(flags).toContain('shang_secret');
  expect(director.events[1]!.choices[0]!.requiresFlag).toBeUndefined();
});
```

- [ ] **Step 4: Не коммитить до Task 2** (иначе тест манифеста красный).

---

### Task 2: Ассеты ступени 4 в манифесте

**Files:**
- Modify: `assets/manifest.json`

**Interfaces:**
- Produces: 8 записей группы `rank4` с промптами. Описания персонажей для промптов:

```
SHANG_TSUNG: a sinister sorcerer reimagined as Director of Transformation of Outworld Corp, a man in his 50s. Long straight black hair slicked back, thin moustache and a pointed goatee, pale gaunt face with sharp cheekbones, eyes glowing a faint toxic green. Black silk mandarin-collar business suit with subtle gold dragon embroidery on the chest and cuffs, many heavy gold rings on both hands, a corporate lanyard with a badge. Holds a black tablet whose screen glows an eerie green like a soul-stealing artifact. Calm, theatrical, predatory. NO pink, NO magenta anywhere in the outfit or lighting.
```

```
REPTILE: a lizard-man system administrator from IT support of Outworld Corp. Green scaly reptilian skin, yellow slit-pupil eyes, no hair; wears a dark green hoodie with the hood pulled up over his head, a black headset with a microphone, a corporate lanyard, and holds a tangled bundle of colorful ethernet cables (blue, yellow, grey — no pink). Hunched, wary, slightly annoyed. NO pink, NO magenta anywhere.
```

Портрет angry Шанг Цунга: «…the left half of his face is mid-morph into a bare skull with a green glow in the eye socket» — узнаваемая фишка колдуна-перевёртыша. Кожа Рептилии зелёная, что далеко от ключа `#FF00FF`; для него спрайтов нет, поэтому хромакей ему не нужен, но запрет на розовое сохраняем ради единого стиля.

**Блоки SHANG TSUNG и REPTILE вставляются в каждый промпт целиком.** Генератор ничего не подставляет: в `manifest.json` не должно остаться текста `<описание>`.

- [ ] **Step 1: Фон**

```json
{
  "id": "bg_server_dungeon", "kind": "background", "group": "rank4", "size": [1600, 900], "resolution": "2K",
  "file": "img/bg/server_dungeon.webp", "model": "bytedance-seed/seedream-5-0-pro", "generated": false,
  "references": ["assets/reference/post-hero-and-shao-kahn.png"],
  "prompt": "Wide establishing shot of a corporate data center built inside a medieval stone dungeon: rows of black server racks with blinking green and amber status LEDs stand between massive stone pillars and arched vaults; iron chains and burning wall torches hang next to neatly bundled network cables; a stone sacrificial altar is used as a sysadmin desk with three monitors, a mechanical keyboard and a coffee mug; human skulls sit on top of the racks as decor; thin white fog rolls across the stone floor. Lighting: cold green server glow mixed with warm orange torchlight, no pink or magenta light. Empty of people. Wide-angle, eye level, deep depth of field, clean composition with the lower third free for UI. Monitor screens show abstract green graphs and unreadable glyphs; no readable text, no labels, no signage, no logos anywhere in the image."
}
```

- [ ] **Step 2: Портреты**

```json
{
  "id": "pt_reptile_neutral", "kind": "portrait", "group": "rank4", "size": [512, 512], "character": "reptile",
  "file": "img/portraits/reptile_neutral.webp", "model": "bytedance-seed/seedream-5-0-pro", "generated": false,
  "references": ["assets/reference/post-hero-and-shao-kahn.png"],
  "prompt": "Head-and-shoulders portrait, looking at camera sideways from under the hood with a suspicious narrow-eyed look, mouth slightly open showing a forked tongue tip. REPTILE: a lizard-man system administrator from IT support of Outworld Corp. Green scaly reptilian skin, yellow slit-pupil eyes, no hair; wears a dark green hoodie with the hood pulled up over his head, a black headset with a microphone, a corporate lanyard, and holds a tangled bundle of colorful ethernet cables (blue, yellow, grey — no pink). Hunched, wary, slightly annoyed. NO pink, NO magenta anywhere. Background: blurred server room, racks with green status LEDs, a skull on top of a rack."
},
{
  "id": "pt_shang_neutral", "kind": "portrait", "group": "rank4", "size": [512, 512], "character": "shang_tsung",
  "file": "img/portraits/shang_neutral.webp", "model": "bytedance-seed/seedream-5-0-pro", "generated": false,
  "references": ["assets/reference/post-hero-and-shao-kahn.png"],
  "prompt": "Head-and-shoulders portrait, looking directly at camera with a thin knowing smile and slightly raised eyebrow, chin lifted, hands folded so the gold rings are visible at the bottom of the frame. SHANG_TSUNG: a sinister sorcerer reimagined as Director of Transformation of Outworld Corp, a man in his 50s. Long straight black hair slicked back, thin moustache and a pointed goatee, pale gaunt face with sharp cheekbones, eyes glowing a faint toxic green. Black silk mandarin-collar business suit with subtle gold dragon embroidery on the chest and cuffs, many heavy gold rings on both hands, a corporate lanyard with a badge. Holds a black tablet whose screen glows an eerie green like a soul-stealing artifact. Calm, theatrical, predatory. NO pink, NO magenta anywhere in the outfit or lighting. Background: blurred stone dungeon wall with a torch and a rack of green server LEDs, faint green glow from below lighting his face."
},
{
  "id": "pt_shang_angry", "kind": "portrait", "group": "rank4", "size": [512, 512], "character": "shang_tsung",
  "file": "img/portraits/shang_angry.webp", "model": "bytedance-seed/seedream-5-0-pro", "generated": false,
  "references": ["assets/reference/post-hero-and-shao-kahn.png", "pt_shang_neutral"], "dependsOn": ["pt_shang_neutral"],
  "prompt": "Same man, same framing and background as the reference portrait. He snarls with bared teeth; the left half of his face is mid-morph into a bare grey skull, skin peeling away like smoke, the empty eye socket glowing bright toxic green; the right eye blazes green. Green energy wisps rise from his collar. SHANG_TSUNG: a sinister sorcerer reimagined as Director of Transformation of Outworld Corp, a man in his 50s. Long straight black hair slicked back, thin moustache and a pointed goatee, pale gaunt face with sharp cheekbones, eyes glowing a faint toxic green. Black silk mandarin-collar business suit with subtle gold dragon embroidery on the chest and cuffs, many heavy gold rings on both hands, a corporate lanyard with a badge. Holds a black tablet whose screen glows an eerie green like a soul-stealing artifact. Calm, theatrical, predatory. NO pink, NO magenta anywhere in the outfit or lighting."
}
```

- [ ] **Step 3: Спрайты** (`character: "shang_tsung"`, `size: [700, 900]`, `chroma: "#FF00FF"`, `flip: false`, `file: img/sprites/shang_<pose>.webp`)

| id | dependsOn | references | prompt |
|----|-----------|------------|--------|
| `sp_shang_idle` | `pt_shang_neutral` | стиль + `pt_shang_neutral` | «Full body, head to shoes fully visible, SHANG_TSUNG standing in a relaxed theatrical pose, three-quarter view facing LEFT, one hand holding the green-glowing tablet against his chest, the other hand raised with fingers spread as if about to cast a spell, faint green wisps around the fingers, polished black shoes, the long hair and the whole silhouette entirely inside the frame with a margin, nothing cropped at the canvas edge. Isolated on a flat uniform solid magenta background (#FF00FF), no floor, no shadow on the background, even studio lighting from the right.» |
| `sp_shang_attack` | `pt_shang_neutral`, `sp_shang_idle` | стиль + `pt_shang_neutral` + `sp_shang_idle` | «Same man as the reference sprite, still facing LEFT at the same three-quarter angle. SHANG_TSUNG lunging forward to the LEFT, thrusting the glowing tablet out like a weapon, other hand clawing the air, green energy streaming from the tablet, hair and the hem of the silk jacket flying but fully inside the frame with a margin on all sides, snarling. Same magenta background, same framing scale.» |
| `sp_shang_hurt` | `pt_shang_neutral`, `sp_shang_idle` | то же | «Same man, still facing LEFT at the same three-quarter angle. SHANG_TSUNG recoiling backward (his back moves to the RIGHT), clutching the tablet to his chest with both hands, its screen flickering and cracking, head turned away, face contorted, one gold ring flying off, hair fully inside the frame. Same magenta background, same framing scale.» |
| `sp_shang_defeated` | `pt_shang_neutral`, `sp_shang_idle` | то же | «Same man, still facing LEFT. SHANG_TSUNG on one knee, hunched, propping himself up with one hand on the floor, the tablet lying dark and cracked beside him, hair falling over his face, the faint green glow in his eyes dying out, exhausted sneer. Same magenta background, same framing scale.» |

Поза `defeated` ниже остальных — групповой кроп прижимает все позы к одной линии низа, это нормально: персонаж «осядет» на землю. Зелёное свечение планшета — дальний от мадженты цвет, despill его не тронет.

Каждый id из `references` обязан быть и в `dependsOn`, иначе падает `test/manifest.test.ts`. Все записи спрайтов: `kind: "sprite"`, `group: "rank4"`, `model: "bytedance-seed/seedream-5-0-pro"`, `generated: false`, `size: [700, 900]`, `character: "shang_tsung"`, `chroma: "#FF00FF"`, `flip: false`.

- [ ] **Step 4: Тесты и коммит (вместе с Task 1)**

Run: `npm run typecheck && npm test && npm run gen -- --dry-run --group rank4`
Expected: тесты PASS (реальный контент проходит валидатор, id из контента есть в манифесте, намёки на `data`/`blame` найдены, флаг `shang_secret` ставится, `requiresFlag` `kitana_owes_you`, `intern_joker`, `sindel_budget_ally`, `baraka_respect` уже ставятся прошлыми ступенями), dry-run показывает 8 записей на ~0.45 $ (1 × 2K = 0.09 + 7 × 1K = 0.315 + референсы ≈ 0.045).

```bash
git add -A && git commit -m "feat(rank4): director events, Reptile, Shang Tsung boss and asset manifest"
```

---

### Task 3: Генерация ассетов ступени 4

**Files:**
- Modify: `assets/manifest.json` (`generated`, `anchor`), `public/assets/img/**`

- [ ] **Step 1: Фон и портреты-якоря**

Run: `npm run gen -- --only bg_server_dungeon,pt_reptile_neutral,pt_shang_neutral`
Критерии для фона: стойки с зелёными и янтарными огнями между каменными колоннами, факелы и цепи рядом с кабелями, алтарь с тремя мониторами, черепа на стойках, туман на полу, пустой, без текста, нижняя треть свободна, **ни одного розового или маджентового источника света**. Для Рептилии: зелёная чешуя, капюшон надет, жёлтые глаза с вертикальным зрачком, гарнитура, кабели в руках без розового. Для Шанг Цунга: зачёсанные волосы, усы и бородка, зелёные глаза, чёрный шёлковый костюм с золотым драконом, кольца, зелёный планшет, лицо целое (череп — только в angry). Брак → правка промпта, `--force`.

- [ ] **Step 2: Остальное**

Run: `npm run gen -- --group rank4`
Затем `npm run assets:check`. Открыть `public/assets/img/sprites/shang_*.webp`: маджента вырезана без розовой каймы, зелёное свечение планшета и глаз не ушло в прозрачность и не обесцветилось despill'ом, чёрный костюм не «съеден» по краям, все позы одного масштаба, смотрят влево. Портрет angry — половина лица череп с зелёным свечением. Если модель добавила розовые блики на золотую вышивку или на экран — усилить в промпте «the tablet screen is pure green, no pink reflections» и перегенерировать только спрайты: `--only sp_shang_idle,sp_shang_attack,sp_shang_hurt,sp_shang_defeated --force`. Если Шанг Цунг смотрит вправо — `flip: true` и пересобрать кроп без перегенерации.

- [ ] **Step 3: Тесты**

Run: `npm test`
Expected: тест бюджета PASS (спрайты ≤ 150 КБ, портреты ≤ 80 КБ, фон ≤ 300 КБ, сумма ≤ 11.5 МБ). Если спрайт больше — перезапустить постобработку по сырым PNG с меньшим качеством (а не пережимать готовый WebP):

```bash
python3 tools/postprocess.py character --out-dir public/assets/img/sprites --size 700x900 --chroma FF00FF --quality 72 \
  sp_shang_idle=assets/raw/sp_shang_idle.png sp_shang_attack=assets/raw/sp_shang_attack.png \
  sp_shang_hurt=assets/raw/sp_shang_hurt.png sp_shang_defeated=assets/raw/sp_shang_defeated.png
```

Скрипт пишет файлы как `<id>.webp` (`sp_shang_idle.webp`), а в манифесте они `shang_<pose>.webp` — переименовать вручную (`gen-assets.ts` делает это сам, а при прямом вызове нет).

Тёмный фон подземелья с туманом обычно тяжёлый — при превышении 300 КБ так же перегнать его из сырого PNG с меньшим качеством:

```bash
python3 tools/postprocess.py plain --out public/assets/img/bg/server_dungeon.webp --size 1600x900 --quality 65 assets/raw/bg_server_dungeon.png
```

```bash
git add -A && git commit -m "assets(rank4): server dungeon background, Reptile portrait, Shang Tsung portraits and sprites"
```

---

### Task 4: Прогон в игре

- [ ] **Step 1:** `npm run dev`. Дойти до ступени 4 (или временно стартовать с `rank: 4` в `createInitialState` — не коммитить). Оба события на фоне серверной-подземелья: в «Утечке» портрет Рептилии, в «Интриге» — Шанг Цунга; реакция с портретом angry на первом варианте «Интриги»; варианты с `kitana_owes_you`, `intern_joker`, `sindel_budget_ally`, `baraka_respect` видны только при наличии флагов. Второй вариант «Интриги» ставит `shang_secret` (проверить в консоли: `state.flags`). В сети (DevTools → Network) видно, что при входе в события ступени начали грузиться `il_ending_*` — префетч `endings` отработал без правок движка.
- [ ] **Step 2:** Бой: Шанг Цунг слева-направо смотрит на героя, позы меняются без прыжков, зелёное свечение планшета видно на тёмном фоне. «Сослаться на данные» — двойной урон, «Перевести стрелки» — серая цифра и реплика из `immune`. Спецприём — `dim`, красная вспышка и реплика про ваше лицо по центру. Босс 185/13: победа за 6 ходов при компетентности ≥ 37 ((10 + 0.15×37)×2 ≈ 31, 6×31 = 186), за 5 ходов при компетентности ≥ 57. Босс снимает 13 + стресс×0.05 (при стрессе 60 ≈ 16, ожидаемо ≈ 18 за ход со спецприёмом), герой держится 5–6 ответов — запас один ход. Проверить на плейтесте компетентность и стресс на входе; если бой непроходим при разумной игре — не трогать 185/13, а поднять компетентность в вариантах ступени (событие 1, вариант 1: competence 15; событие 2, вариант 2: competence 15) и/или снизить дельты стресса до +5. Поражение — стресс +25, повтор с `repeatText` обоих событий.
- [ ] **Step 3:** Скриншоты `docs/screenshots/stage7-event.png`, `docs/screenshots/stage7-battle.png`. README: статус «этап 7 из 8», потраченная сумма.

```bash
git add -A && git commit -m "docs: stage 7 status"
```

## Что дальше

Этап 8 (`2026-09-03-08-final-shao-kahn.md`): ступень 5 «Зам Шао Кана», Шао Кан в тронном кабинете, приём «Ударить» и `FINISH HIM`, концовка Fatality, Джакс из охраны, финальная музыка, использование флага `shang_secret`, плейтест баланса всей лестницы, деплой на GitHub Pages; dev-заглушки удаляются.
