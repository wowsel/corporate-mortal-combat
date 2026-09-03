# Этап 2: Пайплайн ассетов и герой — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Генерация картинок, музыки и голоса диктора из манифеста через OpenRouter, постобработка спрайтов, реальный загрузчик ассетов по группам; герой, титульный арт, иллюстрации концовок, музыка и диктор появляются в игре вместо прямоугольников.

**Architecture:** `assets/manifest.json` — единственный источник правды об ассетах: id, группа, файл, промпт, референсы, зависимости. `tools/gen-assets.ts` (Node, `tsx`) сортирует манифест по зависимостям и генерирует недостающее: картинки через Image API, аудио через streaming chat completions. `tools/postprocess.py` (Pillow + NumPy) вырезает маджента-фон с despill, кадрирует четыре позы персонажа одним холстом, пишет якорь. `src/assets.ts` грузит группы из `public/assets/` и отдаёт текстуры, URL и аудиоданные; отсутствующее заменяет заглушкой.

**Tech Stack:** Node 24, `tsx`, Python 3 + Pillow 12 + NumPy, ffmpeg (есть на машине), OpenRouter API (`bytedance-seed/seedream-5-0-pro`, `google/lyria-3-clip-preview`, `openai/gpt-audio-mini`), PixiJS 8 `Assets`.

**Spec:** `docs/superpowers/specs/2026-09-03-corporate-mortal-kombat-design.md`

## Global Constraints

- `npm install --ignore-scripts`. Новые dev-зависимости: `tsx`, `@types/node`.
- Ключ только из `.env` в корне: `OPENROUTER_API_KEY=...`. Никогда не логировать ключ, не коммитить `.env`.
- Сгенерированные файлы лежат в `public/assets/img/**` и `public/assets/audio/**`, в манифесте поле `file` — путь относительно `public/assets/`. Сырые PNG в `assets/raw/` (в `.gitignore`).
- Хромакей спрайтов `#FF00FF`. Спрайты одного персонажа обрабатываются вместе: общий bbox, один холст 700×900, один якорь.
- Бюджет веса файла: спрайт ≤ 150 КБ, портрет ≤ 80 КБ, фон/иллюстрация ≤ 300 КБ, музыка ≤ 400 КБ, реплика ≤ 40 КБ.
- Image API: `POST https://openrouter.ai/api/v1/images`, ответ `data[0].b64_json`. Аудио: `POST /api/v1/chat/completions` со `stream: true`, `modalities: ["text","audio"]`, чанки `choices[0].delta.audio.data`.
- Перед любой генерацией — `--dry-run` с оценкой стоимости; генерация группами, не всё сразу.
- Коммит после каждой задачи.

---

### Task 1: Раскладка каталогов, `tsx`, чтение `.env`

**Files:**
- Modify: `package.json`, `.gitignore`, `README.md`, `vite.config.ts`
- Create: `tools/env.ts`, `public/assets/.gitkeep`, `assets/raw/.gitkeep`

**Interfaces:**
- Produces: `loadEnv(): Record<string,string>` читает `.env` из корня; `requireKey(): string` бросает понятную ошибку, если ключа нет. Скрипты `npm run gen -- <args>`, `npm run assets:check`.

- [ ] **Step 1: Зависимость и скрипты**

Run: `npm install --ignore-scripts --save-dev tsx@^4 @types/node@^24`

В `tsconfig.json`: `"types": ["vite/client", "node"]`, `"lib": ["ES2023", "DOM", "DOM.Iterable"]` — иначе `process`, `Buffer` в `tools/*.ts` не типизированы и `npm run typecheck` падает (tools входят в `include`). При конфликте DOM/Node типов `fetch` полагаться на `skipLibCheck: true`.

В `package.json` добавить в `scripts`:

```json
"gen": "tsx tools/gen-assets.ts",
"assets:check": "tsx tools/check-assets.ts",
"test:py": "python3 tools/postprocess_test.py"
```

- [ ] **Step 2: `.gitignore`**

Убедиться, что есть строки `.env`, `assets/raw/`, `node_modules/`, `dist/`. Добавить `public/assets/**/*.tmp`.

- [ ] **Step 3: `tools/env.ts`**

```ts
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function loadEnv(root = process.cwd()): Record<string, string> {
  const out: Record<string, string> = {};
  const p = resolve(root, '.env');
  if (existsSync(p)) {
    for (const raw of readFileSync(p, 'utf8').split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq < 0) continue;
      const k = line.slice(0, eq).trim();
      let v = line.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      out[k] = v;
    }
  }
  return { ...out, ...Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined)) as Record<string, string> };
}

export function requireKey(): string {
  const key = loadEnv()['OPENROUTER_API_KEY'];
  if (!key) throw new Error('OPENROUTER_API_KEY не найден: положите его в .env в корне проекта (OPENROUTER_API_KEY=sk-or-...)');
  return key;
}
```

- [ ] **Step 4: `vite.config.ts`**

`publicDir` по умолчанию `public`, `base: './'` остаётся. Добавить `build: { target: 'es2022', outDir: 'dist', assetsDir: 'bundle' }`: иначе бандлы Vite (`index-<hash>.js`) окажутся в `dist/assets/` рядом с игровыми `public/assets/**`. Решение по логотипу: «CORPORATE MORTAL KOMBAT» остаётся HTML-заголовком из этапа 1, отдельной картинки нет; промпт `il_title` резервирует под него верхнюю треть.

- [ ] **Step 5: Проверка и коммит**

Run: `npx tsx -e "import('./tools/env.ts').then(m => console.log(Object.keys(m.loadEnv()).includes('PATH')))"`
Expected: `true`.

```bash
git add -A && git commit -m "chore: tsx, env loader, public/assets layout"
```

---

### Task 2: Манифест: типы, загрузка, топосортировка, тест целостности

**Files:**
- Create: `tools/manifest.ts`, `test/manifest.test.ts`
- Modify: `src/types.ts` (поле `file` теперь относительно `public/assets/`; добавить `voice?: string`, `resolution?: '1K' | '2K'`)

**Interfaces:**
- Produces: `readManifest(path?): Manifest`, `writeManifest(m, path?): void`, `topoSort(entries): AssetEntry[]` (бросает при цикле или неизвестном id), `publicPath(entry): string` (= `public/assets/<file>`), `KIND_BUDGET_KB: Record<AssetKind, number>`.

- [ ] **Step 1: Тест `test/manifest.test.ts`** (заменяет минимальный тест этапа 1 целиком)

```ts
import { existsSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import manifestJson from '../assets/manifest.json';
import { CONTENT } from '../src/content';
import type { AssetEntry, Manifest } from '../src/types';
import { KIND_BUDGET_KB, publicPath, topoSort } from '../tools/manifest';

const manifest = manifestJson as Manifest;

function collectContentAssetIds(): string[] {
  const ids: string[] = [];
  for (const r of CONTENT.ranks) {
    ids.push(r.background);
    for (const ev of r.events) { ids.push(ev.speaker.portrait); for (const c of ev.choices) if (c.reaction) ids.push(c.reaction.portrait); }
    ids.push(...Object.values(r.boss.sprites), ...Object.values(r.boss.portraits));
  }
  for (const e of Object.values(CONTENT.endings)) ids.push(e.illustration);
  ids.push('sp_hero_idle', 'sp_hero_attack', 'sp_hero_hurt', 'sp_hero_win', 'pt_hero_neutral', 'pt_hero_worried', 'il_title');
  return ids;
}

describe('manifest', () => {
  it('id уникальны', () => {
    const ids = manifest.entries.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('dependsOn и references-по-id ссылаются на существующие записи, циклов нет', () => {
    expect(() => topoSort(manifest.entries)).not.toThrow();
    const ids = new Set(manifest.entries.map(e => e.id));
    for (const e of manifest.entries) {
      for (const r of e.references ?? []) if (!r.includes('/')) {
        expect(ids.has(r), `${e.id} → ${r}`).toBe(true);
        expect(e.dependsOn ?? [], `${e.id}: reference ${r} must also be in dependsOn`).toContain(r);
      }
    }
  });
  it('каждый id из контента есть в манифесте', () => {
    const ids = new Set(manifest.entries.map(e => e.id));
    for (const id of collectContentAssetIds()) expect(ids.has(id), id).toBe(true);
  });
  it('у сгенерированных файл существует и укладывается в бюджет', () => {
    let total = 0;
    for (const e of manifest.entries.filter(e => e.generated)) {
      const p = publicPath(e);
      expect(existsSync(p), `${e.id}: ${p}`).toBe(true);
      const kb = statSync(p).size / 1024;
      total += kb;
      expect(kb, `${e.id} ${kb.toFixed(0)}KB > ${KIND_BUDGET_KB[e.kind]}KB`).toBeLessThanOrEqual(KIND_BUDGET_KB[e.kind]);
    }
    expect(total).toBeLessThanOrEqual(11.5 * 1024);
  });
  it('у спрайтов и портретов есть character и size, у аудио — duration', () => {
    for (const e of manifest.entries) {
      if (e.kind === 'sprite') { expect(e.character, e.id).toBeTruthy(); expect(e.size, e.id).toEqual([700, 900]); }
      if (e.kind === 'portrait') expect(e.size, e.id).toEqual([512, 512]);
      if (e.kind === 'background' || e.kind === 'illustration') expect(e.size, e.id).toEqual([1600, 900]);
      if (e.kind === 'music' || e.kind === 'voice') expect(typeof e.duration, e.id).toBe('number');
    }
  });
});

describe('topoSort', () => {
  const mk = (id: string, dependsOn?: string[]): AssetEntry => ({ id, kind: 'sprite', group: 'core', file: `${id}.webp`, model: 'm', prompt: 'p', generated: false, dependsOn });
  it('зависимости раньше зависимых', () => {
    const order = topoSort([mk('b', ['a']), mk('c', ['b']), mk('a')]).map(e => e.id);
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'));
    expect(order.indexOf('b')).toBeLessThan(order.indexOf('c'));
  });
  it('цикл — ошибка', () => expect(() => topoSort([mk('a', ['b']), mk('b', ['a'])])).toThrow(/cycle/));
  it('неизвестная зависимость — ошибка', () => expect(() => topoSort([mk('a', ['zzz'])])).toThrow(/zzz/));
});
```

- [ ] **Step 2: Убедиться, что падает**

Run: `npm test -- manifest`
Expected: FAIL, `tools/manifest` не найден.

- [ ] **Step 3: `tools/manifest.ts`**

```ts
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AssetEntry, AssetKind, Manifest } from '../src/types';

export const MANIFEST_PATH = resolve(process.cwd(), 'assets/manifest.json');
export const PUBLIC_ASSETS = resolve(process.cwd(), 'public/assets');
export const RAW_DIR = resolve(process.cwd(), 'assets/raw');

export const KIND_BUDGET_KB: Record<AssetKind, number> = {
  sprite: 150, portrait: 80, background: 300, illustration: 300, music: 400, voice: 40,
};

export function readManifest(path = MANIFEST_PATH): Manifest {
  return JSON.parse(readFileSync(path, 'utf8')) as Manifest;
}

export function writeManifest(m: Manifest, path = MANIFEST_PATH): void {
  writeFileSync(path, JSON.stringify(m, null, 2) + '\n');
}

export function publicPath(e: AssetEntry): string {
  return resolve(PUBLIC_ASSETS, e.file);
}

export function rawPath(e: AssetEntry): string {
  const ext = e.kind === 'music' || e.kind === 'voice' ? 'mp3' : 'png';
  return resolve(RAW_DIR, `${e.id}.${ext}`);
}

export function topoSort(entries: AssetEntry[]): AssetEntry[] {
  const byId = new Map(entries.map(e => [e.id, e]));
  const state = new Map<string, 'visiting' | 'done'>();
  const out: AssetEntry[] = [];
  const visit = (id: string, path: string[]) => {
    const st = state.get(id);
    if (st === 'done') return;
    if (st === 'visiting') throw new Error(`dependency cycle: ${[...path, id].join(' → ')}`);
    const e = byId.get(id);
    if (!e) throw new Error(`unknown dependency "${id}" (from ${path[path.length - 1] ?? '?'})`);
    state.set(id, 'visiting');
    for (const d of e.dependsOn ?? []) visit(d, [...path, id]);
    state.set(id, 'done');
    out.push(e);
  };
  for (const e of entries) visit(e.id, []);
  return out;
}
```

- [ ] **Step 4: Обновить `src/types.ts`**

К `AssetEntry` добавить:

```ts
  voice?: string;        // для kind voice: голос TTS
  resolution?: '1K' | '2K';
```

и комментарий у `file`: `// путь относительно public/assets/`.

- [ ] **Step 5: Тесты зелёные (кроме проверок реального манифеста, которые чинятся в Task 6) и коммит**

Run: `npm test -- manifest`
Expected: `topoSort` PASS; тесты на реальный манифест могут падать на `size`/`character` — это ожидаемо до Task 6. Если падают — временно пометить `it.todo` с комментарием `// until Task 6`, снять в Task 6.

```bash
git add -A && git commit -m "feat: manifest tooling and integrity tests"
```

---

### Task 3: Клиент OpenRouter (`tools/openrouter.ts`)

**Files:**
- Create: `tools/openrouter.ts`

**Interfaces:**
- Produces:

```ts
export interface ImageRequest { model: string; prompt: string; aspectRatio: string; resolution: '1K' | '2K'; references: string[] /* data URLs */; seed?: number }
export function generateImage(req: ImageRequest, key: string): Promise<{ png: Buffer; cost: number | null }>
export interface AudioRequest { model: string; prompt: string; voice?: string; format: 'mp3' | 'wav' }
export function generateAudio(req: AudioRequest, key: string): Promise<{ audio: Buffer; format: string; cost: number | null }>
export function toDataUrl(pngPath: string): string
export function withRetry<T>(fn: () => Promise<T>, tries?: number): Promise<T>
```

- [ ] **Step 1: Написать `tools/openrouter.ts`**

```ts
import { readFileSync } from 'node:fs';

const BASE = 'https://openrouter.ai/api/v1';
const HEADERS = (key: string) => ({
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
  'HTTP-Referer': 'https://github.com/wowsel/corporate-mortal-combat',
  'X-Title': 'Corporate Mortal Kombat asset pipeline',
});

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}

export async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) {
      last = e;
      // 400/401/402/403 — неверный запрос, ключ или нет средств: повтор бессмыслен
      if (e instanceof ApiError && e.status >= 400 && e.status < 404) break;
      await new Promise(r => setTimeout(r, 2000 * (i + 1)));
    }
  }
  throw last;
}

export function toDataUrl(path: string): string {
  const buf = readFileSync(path);
  const mime = path.endsWith('.png') ? 'image/png' : path.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
  return `data:${mime};base64,${buf.toString('base64')}`;
}

export interface ImageRequest {
  model: string; prompt: string; aspectRatio: string; resolution: '1K' | '2K'; references: string[]; seed?: number;
}

export async function generateImage(req: ImageRequest, key: string): Promise<{ png: Buffer; cost: number | null }> {
  const body: Record<string, unknown> = {
    model: req.model, prompt: req.prompt, aspect_ratio: req.aspectRatio, resolution: req.resolution, n: 1,
  };
  if (req.seed !== undefined) body['seed'] = req.seed;
  if (req.references.length) body['input_references'] = req.references.map(url => ({ type: 'image_url', image_url: { url } }));
  const res = await fetch(`${BASE}/images`, { method: 'POST', headers: HEADERS(key), body: JSON.stringify(body) });
  if (!res.ok) throw new ApiError(`images ${res.status}: ${(await res.text()).slice(0, 500)}`, res.status);
  const json = await res.json() as { data?: { b64_json?: string; media_type?: string }[]; usage?: { cost?: number } };
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error(`images: no b64_json in response: ${JSON.stringify(json).slice(0, 300)}`);
  return { png: Buffer.from(b64, 'base64'), cost: json.usage?.cost ?? null };
}

export interface AudioRequest {
  model: string; prompt: string;
  voice?: string;            // голоса chat-completions-аудио OpenAI: alloy, ash, ballad, coral, echo, sage, shimmer, verse
  format: 'mp3' | 'wav';
  audioParams?: boolean;     // false — не посылать поле `audio` вовсе (для моделей, которые его отвергают)
}

export async function generateAudio(req: AudioRequest, key: string): Promise<{ audio: Buffer; format: string; cost: number | null }> {
  const body: Record<string, unknown> = {
    model: req.model, stream: true, modalities: ['text', 'audio'],
    messages: [{ role: 'user', content: req.prompt }],
    stream_options: { include_usage: true }, // без этого usage.cost в стриме не приходит
  };
  if (req.audioParams !== false) body['audio'] = req.voice ? { voice: req.voice, format: req.format } : { format: req.format };
  const res = await fetch(`${BASE}/chat/completions`, { method: 'POST', headers: HEADERS(key), body: JSON.stringify(body) });
  if (!res.ok || !res.body) throw new ApiError(`audio ${res.status}: ${(await res.text()).slice(0, 500)}`, res.status);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  const chunks: string[] = [];
  let cost: number | null = null;
  let format = req.format;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') continue;
      try {
        const j = JSON.parse(payload) as { choices?: { delta?: { audio?: { data?: string; format?: string } } }[]; usage?: { cost?: number } };
        const a = j.choices?.[0]?.delta?.audio;
        if (a?.data) chunks.push(a.data);
        if (a?.format) format = a.format as 'mp3' | 'wav';
        if (j.usage?.cost !== undefined) cost = j.usage.cost;
      } catch { /* keep-alive или мусор */ }
    }
  }
  if (!chunks.length) throw new Error('audio: stream contained no audio chunks');
  return { audio: Buffer.from(chunks.join(''), 'base64'), format, cost };
}
```

- [ ] **Step 2: Пробный запрос вручную (дёшево, одна картинка 1K)**

Создать `tools/smoke.ts`:

```ts
import { writeFileSync } from 'node:fs';
import { requireKey } from './env';
import { generateAudio, generateImage } from './openrouter';

const key = requireKey();
const what = process.argv[2] ?? 'image';
if (what === 'image') {
  const r = await generateImage({ model: 'bytedance-seed/seedream-5-0-pro', prompt: 'a red office stapler on a wooden desk, photorealistic, soft window light', aspectRatio: '1:1', resolution: '1K', references: [] }, key);
  writeFileSync('assets/raw/_smoke.png', r.png); console.log('image ok', r.png.length, 'bytes, cost', r.cost);
} else if (what === 'voice') {
  const r = await generateAudio({ model: 'openai/gpt-audio-mini', prompt: 'Say exactly, in a deep dramatic fighting-game announcer voice, nothing else: "FIGHT!"', voice: 'ash', format: 'mp3' }, key);
  writeFileSync(`assets/raw/_smoke_voice.${r.format}`, r.audio); console.log('voice ok', r.audio.length, r.format, 'cost', r.cost);
} else {
  const withAudio = process.argv[3] !== 'noaudio';
  const r = await generateAudio({ model: 'google/lyria-3-clip-preview', prompt: 'Instrumental. Dark orchestral fighting-game theme with taiko drums and a ringing office telephone in the rhythm, 30 seconds, loopable.', format: 'mp3', audioParams: withAudio }, key);
  writeFileSync(`assets/raw/_smoke_music.${r.format}`, r.audio); console.log('music ok', r.audio.length, r.format, 'cost', r.cost);
}
```

Run по очереди: `npx tsx tools/smoke.ts image`, `npx tsx tools/smoke.ts voice`, `npx tsx tools/smoke.ts music`.
Expected: три файла в `assets/raw/`, открываются. Записать в README фактический формат аудио, который вернули gpt-audio-mini и Lyria (mp3 или wav), и стоимость. Если Lyria игнорирует `audio.format` и отдаёт wav — нормально, конвертация в Task 5. Если Lyria отвергает поле `audio` (400) — повторить `npx tsx tools/smoke.ts music noaudio`; если так работает, в Task 5 для `kind: music` передавать `audioParams: false`. Голос диктора: `ash` (самый низкий из голосов chat-completions; `onyx` — голос другого, TTS-эндпоинта, и здесь даст 400). Модель диктора — `gpt-audio-mini` вместо `gpt-audio` из спеки: дешевле, качества для восьми слов хватает; это осознанное отклонение.

- [ ] **Step 3: Коммит**

```bash
git add tools/openrouter.ts tools/smoke.ts README.md && git commit -m "feat: OpenRouter image and streaming audio client"
```

---

### Task 4: Постобработка (`tools/postprocess.py`)

**Files:**
- Create: `tools/postprocess.py`, `tools/postprocess_test.py`

**Interfaces:**
- CLI: `python3 tools/postprocess.py character --out-dir public/assets/img/sprites --size 700x900 --chroma FF00FF --flip 0 sp_x_idle=assets/raw/sp_x_idle.png sp_x_attack=... sp_x_hurt=... sp_x_defeated=...` → пишет `<out-dir>/<id>.webp` для каждого, печатает JSON `{"anchor": [x, y], "files": {"sp_x_idle": "…webp", …}}`.
- CLI: `python3 tools/postprocess.py plain --out <path.webp> --size 1600x900 --quality 72 <raw.png>` → cover-кроп до размера, WebP.

- [ ] **Step 1: Тест `tools/postprocess_test.py`**

```python
import json, os, subprocess, sys, tempfile
from PIL import Image

def make_sprite(path, box, color):
    img = Image.new('RGB', (400, 600), (255, 0, 255))
    px = img.load()
    for x in range(box[0], box[2]):
        for y in range(box[1], box[3]):
            px[x, y] = color
    img.save(path)

def main():
    with tempfile.TemporaryDirectory() as d:
        a = os.path.join(d, 'a.png'); b = os.path.join(d, 'b.png')
        make_sprite(a, (150, 200, 250, 560), (200, 40, 40))   # фигура пониже, «красный галстук»
        make_sprite(b, (120, 100, 280, 560), (40, 60, 200))   # фигура шире и выше
        out = os.path.join(d, 'out')
        res = subprocess.run([sys.executable, 'tools/postprocess.py', 'character', '--out-dir', out, '--size', '700x900',
                              '--chroma', 'FF00FF', f'x_idle={a}', f'x_attack={b}'], capture_output=True, text=True, check=True)
        meta = json.loads(res.stdout)
        assert 'anchor' in meta and len(meta['anchor']) == 2, meta
        ia = Image.open(os.path.join(out, 'x_idle.webp')).convert('RGBA')
        ib = Image.open(os.path.join(out, 'x_attack.webp')).convert('RGBA')
        assert ia.size == (700, 900) and ib.size == (700, 900)
        # фон прозрачный, фигура непрозрачная
        assert ia.getpixel((5, 5))[3] == 0
        assert ia.getpixel((350, 850))[3] > 200, ia.getpixel((350, 850))
        # обе позы стоят на одной линии: нижняя непрозрачная строка совпадает
        def bottom(img):
            alpha = img.split()[3]
            bbox = alpha.getbbox(); return bbox[3]
        assert abs(bottom(ia) - bottom(ib)) <= 2, (bottom(ia), bottom(ib))
        # despill не должен гасить красный: галстук остаётся красным
        r, g, bch, _ = ia.getpixel((350, 850))
        assert r > 170 and g < 90 and bch < 90, (r, g, bch)
        # а настоящий маджентовый налёт — гасит
        c = os.path.join(d, 'c.png'); make_sprite(c, (150, 200, 250, 560), (220, 40, 220))
        outc = os.path.join(d, 'outc')
        subprocess.run([sys.executable, 'tools/postprocess.py', 'character', '--out-dir', outc, '--size', '700x900',
                        '--chroma', 'FF00FF', f'y_idle={c}'], capture_output=True, text=True, check=True)
        ic = Image.open(os.path.join(outc, 'y_idle.webp')).convert('RGBA')
        px = ic.getpixel((350, 850))
        assert px[3] > 200, px                          # фигура не вырезана (расстояние до ключа велико по Y? нет — по CbCr она близка, см. ниже)
        assert not (px[0] > 150 and px[2] > 150 and px[1] < 100), px  # но розовость подавлена
        # ВНИМАНИЕ: фигура (220,40,220) по CbCr близка к ключу (dist ≈ 20 < near) и будет вырезана целиком —
        # это корректное поведение хромакея, поэтому ассерт alpha > 200 выше НЕВЕРЕН. Заменить блок «маджентовый налёт»
        # на фигуру (180,90,170) (dist ≈ 60 → alpha ≈ 0.2, частично прозрачна) и проверять только подавление розовости
        # у пикселей с alpha > 0. Исполнитель: реализовать именно этот вариант, а не тот, что выше.
        # plain
        big = os.path.join(d, 'bg.png'); Image.new('RGB', (2048, 1536), (10, 20, 30)).save(big)
        outbg = os.path.join(d, 'bg.webp')
        subprocess.run([sys.executable, 'tools/postprocess.py', 'plain', '--out', outbg, '--size', '1600x900', '--quality', '72', big], check=True)
        assert Image.open(outbg).size == (1600, 900)
        print('postprocess ok')

if __name__ == '__main__':
    main()
```

- [ ] **Step 2: Убедиться, что падает**

Run: `npm run test:py`
Expected: ошибка, `tools/postprocess.py` не найден.

- [ ] **Step 3: `tools/postprocess.py`**

```python
#!/usr/bin/env python3
"""Постобработка сгенерированных картинок.

character: хромакей + общий кроп нескольких поз одного персонажа + якорь.
plain:     cover-кроп до размера + WebP.
"""
import argparse, json, os, sys
import numpy as np
from PIL import Image, ImageFilter


def hex_rgb(s):
    s = s.lstrip('#'); return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))


def rgb_to_ycbcr(arr):
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    y = 0.299 * r + 0.587 * g + 0.114 * b
    cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
    cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b
    return y, cb, cr


def chroma_key(img, key_rgb, near=45.0, far=115.0):
    """Возвращает RGBA: маска по расстоянию в CbCr до ключа, мягкая кромка, despill.

    Расстояние в CbCr от чистой мадженты до нейтрального серого ≈ 136; near/far ≈ 1/3 и 5/6
    от него, чтобы сглаженная кромка «50% фон + 50% субъект» (≈68) получила alpha ≈ 0.3, а не 0.95.
    """
    arr = np.asarray(img.convert('RGB')).astype(np.float32)
    _, cb, cr = rgb_to_ycbcr(arr)
    kcb, kcr = rgb_to_ycbcr(np.array(key_rgb, dtype=np.float32).reshape(1, 1, 3))[1:]
    dist = np.sqrt((cb - kcb) ** 2 + (cr - kcr) ** 2)
    alpha = np.clip((dist - near) / (far - near), 0.0, 1.0)
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    kr, kg, kb = key_rgb
    # despill только там, где цвет действительно «маджентовый» (оба канала ключа выше третьего);
    # красный галстук (200,40,40) или твид (150,110,80) не трогаем: у них min(r,b) <= g → spill = 0
    if kr > 128 and kb > 128 and kg < 128:
        spill = np.clip((np.minimum(r, b) - g) / 60.0, 0.0, 1.0)
        lim = g + (np.maximum(r, b) - g) * 0.35
        r = r * (1 - spill) + np.minimum(r, lim) * spill
        b = b * (1 - spill) + np.minimum(b, lim) * spill
    elif kg > 128 and kr < 128:  # зелёный ключ
        spill = np.clip((g - np.maximum(r, b)) / 60.0, 0.0, 1.0)
        lim = (r + b) / 2 + (g - (r + b) / 2) * 0.35
        g = g * (1 - spill) + np.minimum(g, lim) * spill
    # лёгкая эрозия + размытие альфы: убирает однопиксельную грязную кромку
    alpha = np.clip((alpha - 0.06) / 0.94, 0.0, 1.0)
    out = np.stack([r, g, b, alpha * 255], axis=-1)
    rgba = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGBA')
    a = rgba.split()[3].filter(ImageFilter.GaussianBlur(0.8))
    rgba.putalpha(a)
    return rgba


def alpha_bbox(rgba, thresh=24):
    a = np.asarray(rgba.split()[3])
    ys, xs = np.where(a > thresh)
    if len(xs) == 0:
        return (0, 0, rgba.width, rgba.height)
    return (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)


def do_character(args):
    w, h = map(int, args.size.lower().split('x'))
    key = hex_rgb(args.chroma)
    items = []
    for spec in args.items:
        aid, path = spec.split('=', 1)
        rgba = chroma_key(Image.open(path), key)
        if args.flip:
            rgba = rgba.transpose(Image.FLIP_LEFT_RIGHT)
        items.append((aid, rgba, alpha_bbox(rgba)))
    # общий bbox по всем позам (все сырые картинки одного размера — иначе приводим к первому)
    base_size = items[0][1].size
    norm = []
    for aid, rgba, bbox in items:
        if rgba.size != base_size:
            rgba = rgba.convert('RGBa').resize(base_size, Image.LANCZOS).convert('RGBA'); bbox = alpha_bbox(rgba)
        norm.append((aid, rgba, bbox))
    x0 = min(b[0] for _, _, b in norm); y0 = min(b[1] for _, _, b in norm)
    x1 = max(b[2] for _, _, b in norm); y1 = max(b[3] for _, _, b in norm)
    pad = int(0.04 * max(x1 - x0, y1 - y0))
    x0 = max(0, x0 - pad); y0 = max(0, y0 - pad); x1 = min(base_size[0], x1 + pad); y1 = min(base_size[1], y1 + pad)
    cw, ch = x1 - x0, y1 - y0
    scale = min(w / cw, h / ch)
    nw, nh = int(round(cw * scale)), int(round(ch * scale))
    ox = (w - nw) // 2
    oy = h - nh  # прижимаем к низу: ноги у всех поз на одной линии
    os.makedirs(args.out_dir, exist_ok=True)
    files = {}
    for aid, rgba, _ in norm:
        # ресайз в премультиплицированном режиме (RGBa): иначе LANCZOS подмешает в кромку
        # тёмно-фиолетовый RGB прозрачных пикселей фона
        crop = rgba.crop((x0, y0, x1, y1)).convert('RGBa').resize((nw, nh), Image.LANCZOS).convert('RGBA')
        canvas = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        # alpha_composite, а не paste с маской: paste умножает RGB на альфу и даёт чёрный ореол
        canvas.alpha_composite(crop, (ox, oy))
        out = os.path.join(args.out_dir, f'{aid}.webp')
        canvas.save(out, 'WEBP', quality=args.quality, method=6)
        files[aid] = out
    # якорь: центр по x, нижняя непрозрачная строка по всем позам (обычно h - небольшой отступ)
    bottoms = []
    for aid in files:
        img = Image.open(files[aid]).convert('RGBA')
        bottoms.append(alpha_bbox(img)[3])
    anchor = [w // 2, int(max(bottoms))]
    print(json.dumps({'anchor': anchor, 'files': files}))


def do_plain(args):
    w, h = map(int, args.size.lower().split('x'))
    img = Image.open(args.src).convert('RGB')
    scale = max(w / img.width, h / img.height)
    nw, nh = int(round(img.width * scale)), int(round(img.height * scale))
    img = img.resize((nw, nh), Image.LANCZOS)
    left = (nw - w) // 2; top = (nh - h) // 2
    img = img.crop((left, top, left + w, top + h))
    os.makedirs(os.path.dirname(args.out) or '.', exist_ok=True)
    img.save(args.out, 'WEBP', quality=args.quality, method=6)
    print(json.dumps({'file': args.out, 'size': [w, h]}))


def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest='cmd', required=True)
    c = sub.add_parser('character')
    c.add_argument('--out-dir', required=True); c.add_argument('--size', default='700x900')
    c.add_argument('--chroma', default='FF00FF'); c.add_argument('--flip', type=int, default=0)
    c.add_argument('--quality', type=int, default=80); c.add_argument('items', nargs='+')
    c.set_defaults(fn=do_character)
    q = sub.add_parser('plain')
    q.add_argument('--out', required=True); q.add_argument('--size', required=True)
    q.add_argument('--quality', type=int, default=72); q.add_argument('src')
    q.set_defaults(fn=do_plain)
    args = p.parse_args(); args.fn(args)


if __name__ == '__main__':
    main()
```

- [ ] **Step 4: Тест зелёный, коммит**

Run: `npm run test:py`
Expected: `postprocess ok`.

```bash
git add tools/postprocess.py tools/postprocess_test.py && git commit -m "feat: chroma-key postprocessing with grouped pose crop"
```

---

### Task 5: Генератор (`tools/gen-assets.ts`) и отчёт (`tools/check-assets.ts`)

**Files:**
- Create: `tools/gen-assets.ts`, `tools/check-assets.ts`

**Interfaces:**
- CLI `npm run gen -- [--only id,id] [--group name] [--force] [--dry-run]`.
- Логика: `topoSort`; фильтр по `--only`/`--group`; пропуск `generated && !force`; для картинок — `generateImage` с референсами (пути → data URL; id → `assets/raw/<id>.png`), сохранение raw, постобработка (персонажи — когда сгенерированы все 4 позы персонажа, иначе только raw), запись `generated: true` и `anchor`; для аудио — `generateAudio`, конвертация в mp3 через ffmpeg при необходимости, запись `generated: true`. Стоимость суммируется и печатается.

- [ ] **Step 1: `tools/gen-assets.ts`**

```ts
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import type { AssetEntry, Manifest } from '../src/types';
import { requireKey } from './env';
import { PUBLIC_ASSETS, RAW_DIR, publicPath, rawPath, readManifest, topoSort, writeManifest } from './manifest';
import { generateAudio, generateImage, toDataUrl, withRetry } from './openrouter';

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(n);
const opt = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const only = opt('--only')?.split(',').map(s => s.trim()).filter(Boolean);
const group = opt('--group');
const force = flag('--force');
const dryRun = flag('--dry-run');

const PRICE = { img1k: 0.045, img2k: 0.09, ref: 0.003, music: 0.04, voice: 0.02 };
// Выставить по результату smoke-теста Task 3: false, если Lyria отвергает поле `audio`
const MUSIC_AUDIO_PARAMS = true;

function aspectOf(size: [number, number] | undefined): string {
  if (!size) return '1:1';
  const [w, h] = size;
  const r = w / h;
  if (Math.abs(r - 16 / 9) < 0.05) return '16:9';
  if (Math.abs(r - 7 / 9) < 0.05) return '3:4';
  if (Math.abs(r - 1) < 0.05) return '1:1';
  return r > 1 ? '3:2' : '2:3';
}

function resolutionOf(e: AssetEntry): '1K' | '2K' {
  return e.resolution ?? (e.kind === 'background' || e.kind === 'illustration' ? '2K' : '1K');
}

function estimate(e: AssetEntry): number {
  if (e.kind === 'music') return PRICE.music;
  if (e.kind === 'voice') return PRICE.voice;
  return (resolutionOf(e) === '2K' ? PRICE.img2k : PRICE.img1k) + (e.references?.length ?? 0) * PRICE.ref;
}

function refToDataUrl(ref: string, byId: Map<string, AssetEntry>): string {
  if (ref.includes('/')) return toDataUrl(resolve(process.cwd(), ref));
  const e = byId.get(ref);
  if (!e) throw new Error(`reference "${ref}" not in manifest`);
  const raw = rawPath(e);
  if (!existsSync(raw)) throw new Error(`reference "${ref}" has no raw file at ${raw}; generate it first`);
  return toDataUrl(raw);
}

function postprocessPlain(e: AssetEntry): void {
  const out = publicPath(e);
  mkdirSync(dirname(out), { recursive: true });
  const size = e.size ?? [1600, 900];
  const q = e.kind === 'portrait' ? 80 : 72;
  execFileSync('python3', ['tools/postprocess.py', 'plain', '--out', out, '--size', `${size[0]}x${size[1]}`, '--quality', String(q), rawPath(e)], { stdio: ['ignore', 'pipe', 'inherit'] });
}

function postprocessCharacter(character: string, manifest: Manifest): void {
  const poses = manifest.entries.filter(x => x.kind === 'sprite' && x.character === character);
  if (!poses.every(x => existsSync(rawPath(x)))) { console.log(`  [${character}] not all poses generated yet, skipping crop`); return; }
  const outDir = dirname(publicPath(poses[0]!));
  mkdirSync(outDir, { recursive: true });
  const items = poses.map(x => `${x.id}=${rawPath(x)}`);
  const flip = poses.some(x => x.flip) ? '1' : '0';
  const res = execFileSync('python3', ['tools/postprocess.py', 'character', '--out-dir', outDir, '--size', '700x900', '--chroma', (poses[0]!.chroma ?? '#FF00FF').replace('#', ''), '--flip', flip, '--quality', '80', ...items], { encoding: 'utf8' });
  const meta = JSON.parse(res) as { anchor: [number, number]; files: Record<string, string> };
  for (const x of poses) {
    x.anchor = meta.anchor;
    x.generated = true;
    // файл должен совпадать с manifest.file
    const want = publicPath(x);
    const got = meta.files[x.id]!;
    if (resolve(got) !== want) renameSync(got, want);
  }
}

function toMp3(buf: Buffer, format: string, target: string, kind: 'music' | 'voice'): void {
  // всегда через ffmpeg: нормализуем битрейт под бюджет (музыка 96k стерео, голос 64k моно)
  mkdirSync(dirname(target), { recursive: true });
  const tmp = resolve(RAW_DIR, `${basename(target)}.${format}.tmp`);
  writeFileSync(tmp, buf);
  try {
    const extra = kind === 'voice' ? ['-ac', '1', '-b:a', '64k'] : ['-b:a', '96k'];
    const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', tmp, '-codec:a', 'libmp3lame', ...extra, target]);
    if (r.status !== 0) throw new Error(`ffmpeg failed: ${r.stderr?.toString()}`);
  } finally { rmSync(tmp, { force: true }); }
}

async function main() {
  const manifest = readManifest();
  const byId = new Map(manifest.entries.map(e => [e.id, e]));
  let todo = topoSort(manifest.entries).filter(e => (force || !e.generated));
  if (only) todo = todo.filter(e => only.includes(e.id));
  if (group) todo = todo.filter(e => e.group === group);
  const noPrompt = todo.filter(e => !e.prompt.trim());
  todo = todo.filter(e => e.prompt.trim().length > 0);
  if (noPrompt.length) console.log(`skipped ${noPrompt.length} entries without prompt: ${noPrompt.map(e => e.id).join(', ')}`);
  if (!todo.length) { console.log('nothing to generate'); return; }

  const est = todo.reduce((s, e) => s + estimate(e), 0);
  console.log(`${todo.length} assets to generate, estimated cost ≈ $${est.toFixed(2)}`);
  for (const e of todo) console.log(`  ${e.kind.padEnd(12)} ${e.id.padEnd(28)} ${e.model}  ~$${estimate(e).toFixed(3)}`);
  if (dryRun) return;

  const key = requireKey();
  mkdirSync(RAW_DIR, { recursive: true });
  let spent = 0;
  const touchedCharacters = new Set<string>();

  for (const e of todo) {
    // утверждённый raw не пересъёмываем без --force: иначе --group core снимет idle заново,
    // и остальные позы получат другой референс, чем тот, что смотрели глазами
    if (!force && existsSync(rawPath(e))) {
      console.log(`  ${e.id}: raw exists, skip generation (use --force to redo)`);
      if (e.kind === 'sprite' && e.character) touchedCharacters.add(e.character);
      else if (e.kind !== 'music' && e.kind !== 'voice' && !e.generated) { postprocessPlain(e); e.generated = true; }
      continue;
    }
    console.log(`→ ${e.id}`);
    try {
      if (e.kind === 'music' || e.kind === 'voice') {
        const r = await withRetry(() => generateAudio({ model: e.model, prompt: e.prompt, voice: e.voice, format: 'mp3', audioParams: e.kind === 'music' ? MUSIC_AUDIO_PARAMS : true }, key));
        toMp3(r.audio, r.format, publicPath(e), e.kind);
        spent += r.cost ?? estimate(e);
        e.generated = true;
      } else {
        const refs = (e.references ?? []).map(ref => refToDataUrl(ref, byId));
        const prompt = `${manifest.stylePrefix}\n\n${e.prompt}`;
        const r = await withRetry(() => generateImage({ model: e.model, prompt, aspectRatio: aspectOf(e.size), resolution: resolutionOf(e), references: refs, seed: e.seed }, key));
        writeFileSync(rawPath(e), r.png);
        spent += r.cost ?? estimate(e);
        if (e.kind === 'sprite' && e.character) touchedCharacters.add(e.character);
        else { postprocessPlain(e); e.generated = true; }
      }
      writeManifest(manifest); // сохраняем прогресс после каждого ассета
    } catch (err) {
      console.error(`  ✗ ${e.id}: ${String(err).slice(0, 400)}`);
    }
  }
  for (const c of touchedCharacters) {
    try { postprocessCharacter(c, manifest); } catch (err) { console.error(`  ✗ crop ${c}: ${String(err).slice(0, 400)}`); }
  }
  writeManifest(manifest);
  console.log(`done, spent ≈ $${spent.toFixed(2)}. Public dir: ${PUBLIC_ASSETS}`);
}

main().catch(e => { console.error(e); process.exit(1); });
```

Также: записи с пустым `prompt` пропускать с сообщением `skip (no prompt)` — это dev-заглушки, которые заполняются на следующих этапах.

- [ ] **Step 2: `tools/check-assets.ts`**

```ts
import { existsSync, statSync } from 'node:fs';
import { KIND_BUDGET_KB, publicPath, rawPath, readManifest } from './manifest';

const m = readManifest();
const rows = m.entries.map(e => {
  const pub = publicPath(e);
  const has = existsSync(pub);
  const kb = has ? statSync(pub).size / 1024 : 0;
  const over = has && kb > KIND_BUDGET_KB[e.kind];
  return { id: e.id, kind: e.kind, group: e.group, generated: e.generated, raw: existsSync(rawPath(e)), file: has, kb: Math.round(kb), over };
});
console.table(rows);
const missing = rows.filter(r => !r.file);
const total = rows.reduce((s, r) => s + r.kb, 0);
console.log(`total ${rows.length}, generated ${rows.filter(r => r.file).length}, missing ${missing.length}, over budget ${rows.filter(r => r.over).length}, size ${(total / 1024).toFixed(1)} MB`);
if (missing.length) console.log('missing:', missing.map(r => r.id).join(', '));
```

- [ ] **Step 3: Проверка**

Run: `npm run gen -- --dry-run`
Expected: список записей из манифеста (пока dev-заглушки без промптов) и оценка. `npm run assets:check` печатает таблицу.

```bash
git add tools/gen-assets.ts tools/check-assets.ts && git commit -m "feat: asset generator CLI and status report"
```

---

### Task 6: Манифест этапа 2: стиль, герой, титул, концовки, музыка, диктор

**Files:**
- Modify: `assets/manifest.json`

**Interfaces:**
- Produces: записи с реальными промптами. Dev-записи (`bg_dev*`, `pt_dev*`, `sp_dev*`, `pt_dev2*`, `sp_dev2*`) остаются без промптов до этапов 3 и 8, но получают `size`, `character`, `file`.

- [ ] **Step 1: `stylePrefix`**

```
Photorealistic cinematic still, 35mm lens, shallow depth of field. Setting: a mundane modern corporate office of "Outworld Corp" that is decorated with skulls, dark iron trophies and bone ornaments as if they were normal office decor. Soft warm office lighting mixed with cold fluorescent panels, muted warm color grade, fine skin and fabric detail. Match the style, lighting and color grading of the reference image exactly. No text, no captions, no watermarks.
```

- [ ] **Step 2: Описание героя (вставляется целиком в каждый промпт, где он упомянут: портреты, спрайты, иллюстрации)**

```
HERO: a slim man in his early 40s, curly dark brown hair, round wire-rim glasses, thin goatee, tired polite face; brown tweed three-piece suit with waistcoat, beige shirt, dark red striped tie, small "Employee of the Month" badge on the lapel. Same face and outfit as the man in the reference image.
```

- [ ] **Step 3: Записи героя** (`group: core`, `model: bytedance-seed/seedream-5-0-pro`, `character: hero`)

| id | kind | file | size | prompt (после HERO-описания) | references | dependsOn |
|----|------|------|------|-------|------------|-----------|
| `pt_hero_neutral` | portrait | `img/portraits/hero_neutral.webp` | 512×512 | «Head-and-shoulders portrait of HERO, looking at camera, calm slightly nervous smile, blurred openspace office with a skull on a shelf behind.» | `assets/reference/post-hero-and-shao-kahn.png` | — |
| `pt_hero_worried` | portrait | `img/portraits/hero_worried.webp` | 512×512 | «…same framing, worried expression, eyebrows raised, sweat on temple.» | reference + `pt_hero_neutral` | `pt_hero_neutral` |
| `sp_hero_idle` | sprite | `img/sprites/hero_idle.webp` | 700×900 | «Full body, head to shoes fully visible, HERO standing in a relaxed but alert stance, three-quarter view facing RIGHT, holding a slim laptop under his left arm, weight on back foot. Isolated on a flat uniform solid magenta background (#FF00FF), no floor, no shadow on background, even studio lighting from the left.» | reference + `pt_hero_neutral` | `pt_hero_neutral` |
| `sp_hero_attack` | sprite | `img/sprites/hero_attack.webp` | 700×900 | «…HERO lunging forward to the RIGHT, pointing decisively at a presentation slide with a laser pointer, other hand holding the laptop open, confident face. Same magenta background.» | reference + `pt_hero_neutral` + `sp_hero_idle` | `sp_hero_idle` |
| `sp_hero_hurt` | sprite | `img/sprites/hero_hurt.webp` | 700×900 | «…HERO recoiling backward to the LEFT, papers flying from his hands, glasses askew, wincing. Same magenta background.» | то же | `sp_hero_idle` |
| `sp_hero_win` | sprite | `img/sprites/hero_win.webp` | 700×900 | «…HERO in a modest triumphant pose, fist slightly raised, holding a framed "Employee of the Month" certificate, relieved smile. Same magenta background.» | то же | `sp_hero_idle` |

`chroma: "#FF00FF"`, `flip: false`. Если сгенерированный герой смотрит влево — поставить `flip: true` и пересобрать кроп без перегенерации.

- [ ] **Step 4: Титул и концовки** (`kind: illustration`, 1600×900, `resolution: 2K`, `references: ["assets/reference/post-hero-and-shao-kahn.png", "pt_hero_neutral"]`, `dependsOn: ["pt_hero_neutral"]` — иначе лицо героя на иллюстрациях не совпадёт со спрайтами). Блок HERO из Step 2 вставляется целиком и в промпты иллюстраций. В `manifest.json` не должно остаться плейсхолдеров вида `HERO:` без развёрнутого описания: генератор ничего не подставляет.

| id | group | file | prompt |
|----|-------|------|--------|
| `il_title` | core | `img/il/title.webp` | «Wide cinematic shot: HERO shaking hands with Shao Kahn — a towering muscular warlord in a horned skull helmet, spiked pauldrons and red cape — in a cramped manager's office with skull trophies, a map poster labelled OUTWORLD (single word, correct spelling) and an "Employee of the Month" frame. Both look at camera. Composition leaves the upper third empty for a logo.» |
| `il_ending_promotion` | endings | `img/il/ending_promotion.webp` | «HERO sitting behind a massive dark stone executive desk in a throne-like office, nameplate on the desk, skull-topped pen holder, Shao Kahn's horned helmet on a stand behind him, tired but satisfied smile, golden evening light.» |
| `il_ending_burnout` | endings | `img/il/ending_burnout.webp` | «HERO asleep face down on a keyboard in a dark openspace at night, monitor glow, dozens of sticky notes, cold coffee, a skull on the desk wearing his glasses.» |
| `il_ending_fatality` | endings | `img/il/ending_fatality.webp` | «HERO standing with a torn tweed jacket and a raised fist, breathing hard, in a wrecked office; a huge horned skull helmet lies on the floor among broken monitors and scattered papers; colleagues in the background frozen mid-step, dramatic backlight.» |

- [ ] **Step 5: Музыка** (`kind: music`, `model: google/lyria-3-clip-preview`, `duration: 30`, `file: audio/<id>.mp3`)

| id | group | prompt |
|----|-------|--------|
| `mu_title` | core | «Instrumental, loopable 30s. Epic dark orchestral fighting-game title theme: taiko drums, low brass, choir hits — but with a ringing 90s office desk phone and a typewriter woven into the rhythm. No vocals, no lyrics.» |
| `mu_office` | rank0 | «Instrumental, loopable 30s. Light corporate lounge / elevator jazz with electric piano and soft bossa drums, undercut by an ominous low cello drone. No vocals.» |
| `mu_council` | rank3 | «Instrumental, loopable 30s. Dark corporate ambient: slow synth pads, distant gong, ticking clock, occasional low choir. Tense, boardroom before a decision. No vocals.» |
| `mu_battle` | rank0 | «Instrumental, loopable 30s. Driving 90s industrial techno fighting-game battle theme, 140 BPM, distorted synth bass, metallic percussion, short orchestral stabs. No vocals.» |
| `mu_final` | rank5 | «Instrumental, loopable 30s. Final boss theme: heavy war drums, male choir chanting, dissonant brass, 120 BPM, relentless. No vocals with words.» |
| `mu_ending` | endings | «Instrumental 30s. Triumphant yet slightly ironic orchestral fanfare resolving into a calm corporate-lounge piano outro. No vocals.» |

- [ ] **Step 6: Диктор** (`kind: voice`, `model: openai/gpt-audio-mini`, `voice: ash`, `duration: 2`, group `core`, `file: audio/<id>.mp3`)

Промпт для каждого: `Say exactly the following phrase and nothing else, in the deep, slow, dramatic, slightly distorted voice of a 1990s arcade fighting-game announcer: "<PHRASE>"`.

| id | PHRASE |
|----|--------|
| `vo_round1` | ROUND ONE |
| `vo_fight` | FIGHT! |
| `vo_flawless` | FLAWLESS PRESENTATION |
| `vo_promotion` | PROMOTION! |
| `vo_performance_review` | PERFORMANCE REVIEW |
| `vo_finish_him` | FINISH HIM |
| `vo_fatality` | FATALITY |
| `vo_title` | CORPORATE MORTAL KOMBAT |

- [ ] **Step 7: Привести dev-записи к схеме**

У `sp_dev_*` и `sp_dev2_*`: `character: "dev_mileena"` / `"dev_shao"`, `size: [700, 900]`, `file: img/sprites/<id>.webp`. У `pt_dev*`: `size: [512, 512]`. У `bg_dev*`: `size: [1600, 900]`. У `il_ending_*` — заменены реальными записями выше. Пути `file` у всех записей — без префикса `assets/`.

- [ ] **Step 8: Тесты и коммит**

Run: `npm test -- manifest` (снять `it.todo`, если ставили в Task 2) и `npm run gen -- --dry-run`.
Expected: тесты PASS; dry-run показывает 24 записи к генерации (6 картинок героя, 4 иллюстрации, 6 музыки, 8 реплик), dev-записи без промпта перечислены отдельной строкой `skipped`, оценка около 1.1 $.

```bash
git add assets/manifest.json test/manifest.test.ts && git commit -m "feat: manifest with hero, title, endings, music and announcer prompts"
```

---

### Task 7: Генерация ассетов этапа 2

**Files:**
- Modify: `assets/manifest.json` (флаги `generated`, `anchor`), `public/assets/**` (новые файлы), `README.md`

- [ ] **Step 1: Портрет героя**

Run: `npm run gen -- --only pt_hero_neutral`
Открыть `assets/raw/pt_hero_neutral.png` и `public/assets/img/portraits/hero_neutral.webp`. Критерии: похож на мужчину с референса (кудри, очки, твид), офис с черепом сзади, без текста. Если не похож — поправить промпт и `--force`.

- [ ] **Step 2: Idle героя**

Run: `npm run gen -- --only sp_hero_idle`
Критерии на raw: фон ровная маджента без градиента, фигура целиком в кадре, смотрит вправо. Кроп сработает только когда есть все 4 позы, поэтому пока проверяем raw.

- [ ] **Step 3: Остальные позы и портрет worried**

Run: `npm run gen -- --group core` (сгенерирует `pt_hero_worried`, `sp_hero_attack`, `sp_hero_hurt`, `sp_hero_win`, `il_title`, `mu_title`, `vo_*`; dev-записи без промптов пропускаются — добавить в `gen-assets.ts` пропуск записей с пустым `prompt` с сообщением `skip (no prompt)`).
Утверждённые в Step 1–2 raw не пересъёмываются (генератор пропускает существующие raw без `--force`), кроп персонажа запускается, когда появились все четыре raw. Затем `npm run assets:check`. Открыть четыре `hero_*.webp`: кромка без розовой и без тёмной каймы, все четыре стоят на одной линии, размер 700×900, `anchor` записан в манифест. Если у одной позы фигура обрезана по краю — перегенерировать эту позу `--only sp_hero_hurt --force`, кроп пересчитается автоматически (в `gen-assets.ts` кроп персонажа запускается, если тронута хоть одна поза).

- [ ] **Step 4: Концовки и остальная музыка**

Run: `npm run gen -- --group endings` и `npm run gen -- --only mu_office,mu_battle,mu_council,mu_final`.
Проверить, что все mp3 играют (`ffprobe public/assets/audio/mu_title.mp3`), длительность около 30 с, размер ≤ 400 КБ (96 кбит/с × 30 с ≈ 360 КБ). Если Lyria вернула клип длиннее 30 с и файл больше — обрезать: `ffmpeg -y -i in.mp3 -t 30 -b:a 96k out.mp3`.

- [ ] **Step 5: Бюджет и тесты**

Run: `npm run assets:check && npm test`
Expected: все записи `core`, `endings` и `mu_*` сгенерированы, тест бюджета PASS. Записать в README фактическую потраченную сумму.

```bash
git add -A && git commit -m "assets: hero sprites and portraits, title, endings, music, announcer"
```

Если генерация недоступна (нет ключа/средств), задача останавливается здесь и помечается в README как «ожидает генерации», остальные задачи этапа выполняются на заглушках.

---

### Task 8: Реальный загрузчик (`src/assets.ts`) и аудиоданные

**Files:**
- Modify: `src/assets.ts`, `src/audio.ts`, `src/screens/start.ts`

**Interfaces:**
- `AssetStore` меняется: `getAudioData(id): ArrayBuffer | null` вместо `getAudioBuffer`; добавляется `getAnchor(id): [number, number] | null`. `loadGroup(group, onProgress)` реально грузит файлы записей группы с `generated: true` (картинки через `Assets.load` Pixi, аудио через `fetch` → `ArrayBuffer`), прогресс по количеству. `prefetchGroup` = `loadGroup` без ожидания. Не сгенерированные записи считаются загруженными мгновенно (заглушка).
- `audio.ts`: декодирует `ArrayBuffer` в `AudioBuffer` при первом обращении и кэширует по id; `playMusic`/`playVoice` используют кэш.

- [ ] **Step 1: Переписать `src/assets.ts`**

```ts
import { Assets, Texture } from 'pixi.js';
import type { AssetEntry, AssetGroup, Manifest } from './types';

export interface AssetStore {
  loadGroup(group: AssetGroup, onProgress?: (p: number) => void): Promise<void>;
  prefetchGroup(group: AssetGroup): void;
  getImageUrl(id: string): string | null;
  getTexture(id: string): Texture;
  getAudioData(id: string): ArrayBuffer | null;
  getAnchor(id: string): [number, number] | null;
  has(id: string): boolean;
}

const BASE = `${import.meta.env.BASE_URL}assets/`;

function hashColor(id: string): string {
  let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `hsl(${h % 360} 45% 40%)`;
}

export function placeholderCanvas(id: string, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = hashColor(id); ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, w - 6, h - 6);
  ctx.fillStyle = '#fff'; ctx.font = `${Math.max(14, Math.floor(w / 14))}px sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(id, w / 2, h / 2);
  return c;
}

export function createAssetStore(manifest: Manifest): AssetStore {
  const entries = new Map(manifest.entries.map(e => [e.id, e]));
  const textures = new Map<string, Texture>();
  const audio = new Map<string, ArrayBuffer>();
  const loaded = new Set<string>();
  const groupPromises = new Map<AssetGroup, Promise<void>>();

  const urlOf = (e: AssetEntry) => `${BASE}${e.file}`;
  const sizeFor = (e: AssetEntry | undefined): [number, number] => e?.size ?? (e?.kind === 'portrait' ? [512, 512] : e?.kind === 'sprite' ? [700, 900] : [1600, 900]);

  async function loadOne(e: AssetEntry): Promise<void> {
    if (loaded.has(e.id) || !e.generated) return;
    try {
      if (e.kind === 'music' || e.kind === 'voice') {
        const res = await fetch(urlOf(e));
        if (!res.ok) throw new Error(String(res.status));
        audio.set(e.id, await res.arrayBuffer());
      } else {
        const tex = await Assets.load<Texture>({ alias: e.id, src: urlOf(e) });
        textures.set(e.id, tex);
      }
    } catch (err) {
      console.warn(`asset ${e.id} failed to load, using placeholder`, err);
    } finally {
      loaded.add(e.id);
    }
  }

  function loadGroup(group: AssetGroup, onProgress?: (p: number) => void): Promise<void> {
    const existing = groupPromises.get(group);
    if (existing) { onProgress?.(1); return existing; }
    const list = manifest.entries.filter(e => e.group === group);
    let done = 0;
    const p = Promise.all(list.map(e => loadOne(e).then(() => { done += 1; onProgress?.(list.length ? done / list.length : 1); }))).then(() => { onProgress?.(1); });
    groupPromises.set(group, p);
    return p;
  }

  return {
    loadGroup,
    prefetchGroup(group) { void loadGroup(group); },
    getImageUrl(id) {
      const e = entries.get(id);
      return e && e.generated ? urlOf(e) : null;
    },
    getTexture(id) {
      const t = textures.get(id);
      if (t) return t;
      let ph = textures.get(`__ph_${id}`);
      if (!ph) { const [w, h] = sizeFor(entries.get(id)); ph = Texture.from(placeholderCanvas(id, w, h)); textures.set(`__ph_${id}`, ph); }
      return ph;
    },
    getAudioData(id) { return audio.get(id) ?? null; },
    getAnchor(id) { return entries.get(id)?.anchor ?? null; },
    has(id) { return entries.has(id); },
  };
}
```

- [ ] **Step 2: `src/audio.ts` — декодирование**

Заменить `assets.getAudioBuffer(id)` на:

```ts
const decoded = new Map<string, AudioBuffer>();
async function bufferFor(id: string): Promise<AudioBuffer | null> {
  const ac = ensure(); if (!ac) return null;
  const cached = decoded.get(id); if (cached) return cached;
  const data = assets.getAudioData(id); if (!data) return null;
  try {
    const buf = await ac.decodeAudioData(data.slice(0));
    decoded.set(id, buf); return buf;
  } catch (e) { console.warn('decode failed', id, e); return null; }
}
```

`playVoice(id)`: `void bufferFor(id).then(b => { if (b) playBuffer(b, 0.9); })`.
`playMusic(id)`: в начале `if (wantedMusic === id) return; wantedMusic = id;` (ранний выход по желаемому треку, а не по `music?.id`, который до конца декода ещё не установлен — иначе два монтирования экрана запустят два источника); после `await bufferFor(id)` проверяет, что `wantedMusic === id` (пользователь мог уйти на другой экран), затем fade-out старого и fade-in нового. `stopMusic()` сбрасывает `wantedMusic = null`, чтобы повисший декод не включил музыку после ухода с экрана.

- [ ] **Step 3: `src/screens/start.ts`**

После загрузки групп: показать `il_title` фоном (уже есть). Автоплей до жеста запрещён, поэтому первый `pointerdown` где угодно на титуле вызывает `unlock()` и `playMusic('mu_title')` (обработчик `{ once: true }`) — пользователь слышит тему, пока читает. Кнопка «Начать карьеру»: `playVoice('vo_title')`, пауза 1200 мс (`setTimeout`), затем `go('event')`, где включится `mu_office`. Убрать из кнопки вызов `playMusic('mu_title')`, добавленный на этапе 1.

- [ ] **Step 4: Проверка**

Run: `npm run typecheck && npm test && npm run dev`
В браузере: титул с артом, клик → голос «CORPORATE MORTAL KOMBAT» → событие с музыкой лаунжа. В консоли нет ошибок загрузки для сгенерированных файлов; для dev-заглушек — предупреждений нет (они `generated: false`, грузиться не пытаются).

```bash
git add -A && git commit -m "feat: real asset loader with groups, audio decoding, title voice"
```

---

### Task 9: Спрайты с якорем в сцене боя и префетч групп

**Files:**
- Modify: `src/render/scene.ts`, `src/screens/battle.ts`, `src/screens/event.ts`

**Interfaces:**
- `Scene.setFighter(who, textures, name, title, portrait, anchor?: [number, number] | null)` — если якорь задан, `sprite.anchor.set(ax / texW, ay / texH)`; иначе `(0.5, 1)`.
- `event.ts`: при монтировании вызывает `ctx.assets.prefetchGroup('rank' + (rank + 1))` если такая группа есть у ранга, и `prefetchGroup('endings')` на ранге ≥ 4.

- [ ] **Step 1: `scene.ts`**

Расширить сигнатуру в трёх местах: `interface Scene.setFighter(who, textures, name, title, portrait, anchor?: [number, number] | null)`, реализация `setFighter` в `getScene()` передаёт `anchor` дальше: `(f as Fighter).setTextures(textures, anchor ?? null)`, и сам `Fighter.setTextures(t, anchor)`:

```ts
const tex = t['idle'] ?? Texture.EMPTY;
if (anchor) this.sprite.anchor.set(anchor[0] / Math.max(1, tex.width), anchor[1] / Math.max(1, tex.height));
else this.sprite.anchor.set(0.5, 1);
```

Масштаб как раньше: `targetH / tex.height`. Все четыре текстуры персонажа одного размера после группового кропа, поэтому один якорь подходит всем позам.

- [ ] **Step 2: `battle.ts`**

Перед `setBackground`/`setFighter` дождаться группы текущей ступени: `await ctx.assets.loadGroup(\`rank${state.rank}\` as AssetGroup); if (!alive) return;` — `getTexture` синхронный, и если префетч не успел, персонаж останется заглушкой на весь бой; `loadGroup` дедуплицирует промисы, так что после префетча это бесплатно. Передавать `ctx.assets.getAnchor('sp_hero_idle')` и `ctx.assets.getAnchor(boss.sprites.idle)` в `setFighter`. Использовать `pt_hero_neutral` для портрета героя в HUD (уже так).

- [ ] **Step 3: `event.ts` — префетч**

Убедиться, что префетч следующей ступени и `endings` уже стоит в `event.mount` (добавлен на этапе 1). Ничего не менять. Также добавить в `event.mount` перед рендером `await ctx.assets.loadGroup(\`rank${state.rank}\` as AssetGroup)` — иначе при переходе на новую ступень фон и портрет первого события могут отрисоваться заглушками, если префетч не успел.

- [ ] **Step 4: Проверка в браузере**

Пройти до боя: герой — реальный спрайт, стоит на земле, при смене поз не прыгает; босс пока прямоугольник. Победа: поза `win`. Концовка: иллюстрация. Скриншоты в `docs/screenshots/stage2-battle.png`, `stage2-title.png`, `stage2-ending.png`.

```bash
git add -A && git commit -m "feat: anchored sprites in battle, group prefetch"
```

---

### Task 10: Финальная проверка этапа

- [ ] **Step 1:** `npm run typecheck && npm test && npm run test:py && npm run build`.
- [ ] **Step 2:** `npm run assets:check` — все записи `core`, `endings`, `mu_*` сгенерированы, нет превышений бюджета.
- [ ] **Step 3:** README: раздел «Ассеты» (как положить ключ, `npm run gen -- --dry-run`, `--group`, `--only … --force`, где лежат raw), фактическая стоимость этапа, статус «этап 2 из 8».
- [ ] **Step 4:** Удалить `tools/smoke.ts` и `assets/raw/_smoke*` (smoke больше не нужен, клиент проверен реальной генерацией).

```bash
git add -A && git commit -m "docs: stage 2 status, asset pipeline usage"
```

## Что дальше

Этап 3 (`2026-09-03-03-rank0-mileena.md`): контент ступени 0 вместо `dev`, фон опенспейса, Милина в четырёх позах и двух портретах, снятие dev-записей ступени 0 из манифеста.
