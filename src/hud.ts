import { STAT_KEYS } from './state';
import type { GameState, StatKey } from './types';

const LABELS: Record<StatKey, string> = { loyalty: 'Лояльность', reputation: 'Репутация', competence: 'Компетентность', stress: 'Стресс' };

export function createHud(container: HTMLElement, opts: { mute?: boolean } = { mute: true }) {
  container.classList.add('hud');
  container.innerHTML = `
    <div class="hud-left"><div class="hud-title"></div><div class="hud-week"></div></div>
    <div class="hud-stats">${STAT_KEYS.map(k => `
      <div class="hud-stat" data-key="${k}">
        <span class="hud-label">${LABELS[k]}</span>
        <div class="hud-bar"><div class="hud-fill"></div></div>
        <span class="hud-value">0</span>
      </div>`).join('')}</div>
    ${opts.mute === false ? '' : '<button class="hud-mute" type="button" aria-label="Звук">🔊</button>'}`;
  let prev: GameState | null = null;

  return {
    muteButton: container.querySelector<HTMLButtonElement>('.hud-mute'),
    update(state: GameState, rankTitle: string) {
      container.querySelector('.hud-title')!.textContent = rankTitle;
      container.querySelector('.hud-week')!.textContent = `Неделя ${state.week}`;
      for (const k of STAT_KEYS) {
        const el = container.querySelector<HTMLElement>(`.hud-stat[data-key="${k}"]`)!;
        el.querySelector<HTMLElement>('.hud-fill')!.style.width = `${state.stats[k]}%`;
        el.querySelector('.hud-value')!.textContent = String(state.stats[k]);
        const delta = prev ? state.stats[k] - prev.stats[k] : 0;
        if (delta !== 0) {
          const pop = document.createElement('span');
          pop.className = `hud-pop ${delta > 0 ? 'up' : 'down'}`;
          pop.textContent = (delta > 0 ? '+' : '−') + Math.abs(delta);
          el.appendChild(pop);
          pop.addEventListener('animationend', () => pop.remove());
        }
      }
      prev = { ...state, stats: { ...state.stats } };
    },
    destroy() { container.replaceChildren(); container.classList.remove('hud'); },
  };
}
