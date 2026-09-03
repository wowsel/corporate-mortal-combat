import { Texture } from 'pixi.js';
import type { AssetGroup, Manifest } from './types';

export interface AssetStore {
  loadGroup(group: AssetGroup, onProgress?: (p: number) => void): Promise<void>;
  prefetchGroup(group: AssetGroup): void;
  getImageUrl(id: string): string | null;
  getTexture(id: string): Texture;
  getAudioBuffer(id: string): AudioBuffer | null;
  has(id: string): boolean;
}

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

  const sizeFor = (id: string): [number, number] => {
    const e = entries.get(id);
    if (e?.size) return e.size;
    if (e?.kind === 'background' || e?.kind === 'illustration') return [1600, 900];
    if (e?.kind === 'portrait') return [512, 512];
    return [700, 900];
  };

  return {
    async loadGroup(_group, onProgress) { onProgress?.(1); },
    prefetchGroup() {},
    getImageUrl() { return null; },
    getTexture(id) {
      let t = textures.get(id);
      if (!t) {
        const [w, h] = sizeFor(id);
        t = Texture.from(placeholderCanvas(id, w, h));
        textures.set(id, t);
      }
      return t;
    },
    getAudioBuffer() { return null; },
    has(id) { return entries.has(id); },
  };
}
