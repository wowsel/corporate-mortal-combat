import { Assets, Texture } from 'pixi.js';
import type { AssetEntry, AssetGroup, Manifest } from './types';

/**
 * Контракт хранилища ассетов. Экраны написаны в расчёте на эти гарантии:
 * - `loadGroup` никогда не реджектится: сбой отдельного ассета логируется и заменяется заглушкой;
 *   `onProgress` вызывается монотонно и всегда заканчивается ровно на 1;
 * - повторный `loadGroup` уже запущенной группы дедуплицируется: он не перезапускает загрузку,
 *   отдаёт тот же промис и сразу сообщает `onProgress(1)` — реальный прогресс идущей загрузки
 *   такой вызов не видит. Полоску прогресса рисует только первый вызов (стартовый экран);
 * - `prefetchGroup` — fire-and-forget: не бросает, ничего не возвращает, ошибки глотает;
 * - `getTexture` никогда не возвращает null: для незагруженного id отдаётся текстура-заглушка;
 * - `getImageUrl` возвращает null, если картинки нет, иначе URL, безопасный для подстановки
 *   в CSS `url('…')` (без кавычек, скобок и переводов строк внутри);
 * - `getAudioData` возвращает null, если звука нет (декодированием занимается audio.ts);
 * - `getAnchor` возвращает точку крепления спрайта в пикселях исходной картинки или null.
 * Записи с `generated: false` считаются загруженными мгновенно: файлов ещё нет,
 * запрашивать их нельзя (ни сетевых запросов, ни предупреждений в консоли).
 */
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
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `hsl(${h % 360} 45% 40%)`;
}

export function placeholderCanvas(id: string, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = hashColor(id);
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, w - 6, h - 6);
  ctx.fillStyle = '#fff'; ctx.font = `${Math.max(14, Math.floor(w / 14))}px sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(id, w / 2, h / 2);
  return c;
}

export function createAssetStore(manifest: Manifest): AssetStore {
  const entries = new Map(manifest.entries.map(e => [e.id, e]));
  const textures = new Map<string, Texture>();
  const audio = new Map<string, ArrayBuffer>();
  const loaded = new Set<string>();
  const groupPromises = new Map<AssetGroup, Promise<void>>();

  const urlOf = (e: AssetEntry) => `${BASE}${e.file}`;
  const sizeFor = (e: AssetEntry | undefined): [number, number] =>
    e?.size ?? (e?.kind === 'portrait' ? [512, 512] : e?.kind === 'sprite' ? [700, 900] : [1600, 900]);

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
    // по контракту: догоняющий вызов не подписывается на реальный прогресс, а сразу
    // репортит 1 — иначе пришлось бы держать список подписчиков на каждую группу
    if (existing) { onProgress?.(1); return existing; }
    const list = manifest.entries.filter(e => e.group === group);
    let done = 0;
    const p = Promise.all(list.map(e => loadOne(e).then(() => {
      done += 1;
      onProgress?.(list.length ? done / list.length : 1);
    }))).then(() => { onProgress?.(1); });
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
      if (!ph) {
        const [w, h] = sizeFor(entries.get(id));
        ph = Texture.from(placeholderCanvas(id, w, h));
        textures.set(`__ph_${id}`, ph);
      }
      return ph;
    },
    getAudioData(id) { return audio.get(id) ?? null; },
    getAnchor(id) { return entries.get(id)?.anchor ?? null; },
    has(id) { return entries.has(id); },
  };
}
