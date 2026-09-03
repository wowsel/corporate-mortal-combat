import type { Ctx, Screen } from '../engine';
import { checkEnding, createInitialState } from '../state';
import { placeholderBg } from './event';

export function createEndingScreen(): Screen {
  return {
    async mount(root, ctx: Ctx) {
      const id = checkEnding(ctx.getState(), ctx.content.ranks) ?? 'burnout';
      const ending = ctx.content.endings[id];
      ctx.audio.playMusic('mu_ending');
      const el = document.createElement('div');
      el.className = `screen ending ending-${id}`;
      const art = ctx.assets.getImageUrl(ending.illustration);
      el.innerHTML = `
        <div class="ending-art" style="${art ? `background-image:url(${art})` : `background:${placeholderBg(ending.illustration)}`}"></div>
        <div class="ending-panel">
          <h1>${ending.title}</h1>
          <p>${ending.text}</p>
          <p class="ending-meta">Недель в Outworld: ${ctx.getState().week}</p>
          <button class="btn-primary">Начать карьеру заново</button>
        </div>`;
      root.appendChild(el);
      el.querySelector('button')!.addEventListener('click', () => {
        ctx.setState(createInitialState());
        ctx.go('start');
      });
    },
    unmount() {},
  };
}
