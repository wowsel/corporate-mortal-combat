import type { Ctx, Screen } from '../engine';
import { checkEnding, createInitialState, resolveEnding } from '../state';
import { placeholderBg } from './event';

export function createEndingScreen(): Screen {
  return {
    async mount(root, ctx: Ctx) {
      // core — ради il_title у концовки «Партнёрство» (титульный арт: рукопожатие); группа уже в кэше с титула
      await Promise.all([ctx.assets.loadGroup('endings'), ctx.assets.loadGroup('core')]);
      const state = ctx.getState();
      const id = checkEnding(state, ctx.content.ranks) ?? 'burnout';
      const ending = resolveEnding(ctx.content.endings[id], state.flags);
      ctx.audio.playMusic(ctx.content.endings[id].music ?? 'mu_ending');
      const el = document.createElement('div');
      el.className = `screen ending ending-${id}`;
      const art = ctx.assets.getImageUrl(ending.illustration);
      el.innerHTML = `
        <div class="ending-art" style="${art ? `background-image:url('${art}')` : `background:${placeholderBg(ending.illustration)}`}"></div>
        <div class="ending-panel">
          <h1></h1>
          <p class="ending-text"></p>
          <p class="ending-meta">Недель в Outworld: ${state.week}</p>
          <button class="btn-primary">Начать карьеру заново</button>
        </div>`;
      const panel = el.querySelector('.ending-panel')!;
      // тексты — через textContent, как и эпилог: одна конвенция на весь экран
      panel.querySelector('h1')!.textContent = ending.title;
      panel.querySelector('.ending-text')!.textContent = ending.text;
      if (ending.epilogue) {
        const { name, portrait, text } = ending.epilogue;
        const card = document.createElement('div');
        card.className = 'epilogue';
        const portraitEl = document.createElement('div');
        portraitEl.className = 'epilogue-portrait';
        const url = ctx.assets.getImageUrl(portrait);
        portraitEl.style.background = url ? `url('${url}') center top/cover no-repeat` : placeholderBg(portrait);
        portraitEl.dataset.id = portrait;
        const body = document.createElement('div');
        const nameEl = document.createElement('div');
        nameEl.className = 'epilogue-name';
        nameEl.textContent = name;
        const textEl = document.createElement('div');
        textEl.className = 'epilogue-text';
        textEl.textContent = text;
        body.appendChild(nameEl);
        body.appendChild(textEl);
        card.appendChild(portraitEl);
        card.appendChild(body);
        panel.insertBefore(card, panel.querySelector('.ending-meta'));
      }
      root.appendChild(el);
      el.querySelector('button')!.addEventListener('click', () => {
        ctx.setState(createInitialState());
        ctx.go('start');
      });
    },
    unmount() {},
  };
}
