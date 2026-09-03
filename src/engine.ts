import type { AssetStore } from './assets';
import type { Audio } from './audio';
import type { Content } from './content';
import { createInitialState } from './state';
import type { GameState } from './types';

export type ScreenName = 'start' | 'event' | 'battle' | 'ending';

export interface Ctx {
  getState(): GameState;
  setState(next: GameState): void;
  content: Content;
  assets: AssetStore;
  audio: Audio;
  go(screen: ScreenName): void;
}

export interface Screen {
  mount(root: HTMLElement, ctx: Ctx): Promise<void>;
  unmount(): void;
}

export function createEngine(opts: {
  root: HTMLElement; content: Content; assets: AssetStore; audio: Audio;
  screens: Record<ScreenName, () => Screen>;
}) {
  let state: GameState = createInitialState();
  let current: Screen | null = null;
  let busy = false;
  let pending: ScreenName | null = null;

  const ctx: Ctx = {
    getState: () => state,
    setState: next => { state = next; },
    content: opts.content, assets: opts.assets, audio: opts.audio,
    go,
  };

  // busy поднимается ДО вызова mount, а сам mount уходит в микротаск: если экран
  // синхронно вызовет go() из mount (event без событий → battle), переход
  // встанет в очередь pending, а не выполнится вложенно.
  function go(name: ScreenName) {
    if (busy) { pending = name; return; }
    busy = true;
    current?.unmount();
    current = null;
    opts.root.replaceChildren();
    const screen = opts.screens[name]();
    current = screen;
    void Promise.resolve()
      .then(() => screen.mount(opts.root, ctx))
      .catch(e => {
        console.error(`screen ${name} failed to mount`, e);
        opts.root.textContent = `Ошибка экрана ${name}: ${String(e)}`;
      })
      .finally(() => {
        busy = false;
        const p = pending; pending = null;
        if (p) go(p);
      });
  }

  return { go, ctx };
}
