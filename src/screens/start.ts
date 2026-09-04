import type { Ctx, Screen } from '../engine';
import { createInitialState } from '../state';
import { placeholderBg } from './event';

export function createStartScreen(): Screen {
  let goTimer: number | null = null;

  return {
    async mount(root, ctx: Ctx) {
      const el = document.createElement('div');
      el.className = 'screen start';
      const art = ctx.assets.getImageUrl('il_title');
      el.innerHTML = `
        <div class="start-art" style="${art ? `background-image:url('${art}')` : `background:${placeholderBg('il_title')}`}"></div>
        <div class="start-panel">
          <h1 class="logo"><span>CORPORATE</span><span>MORTAL KOMBAT</span></h1>
          <p class="tagline">Никто не приходит утром в офис и не кидается в директора фаерболами.<br>С боссами приходится ладить.</p>
          <div class="progress"><div class="progress-fill"></div></div>
          <button class="btn-primary" disabled>Начать карьеру</button>
        </div>`;
      root.appendChild(el);
      // автоплей до жеста запрещён: первое касание титула разблокирует контекст и включает тему
      el.addEventListener('pointerdown', () => {
        ctx.audio.unlock();
        ctx.audio.playMusic('mu_title');
      }, { once: true });
      const fill = el.querySelector<HTMLElement>('.progress-fill')!;
      const btn = el.querySelector<HTMLButtonElement>('.btn-primary')!;
      // по контракту loadGroup не реджектится; ловим на всякий случай — иначе исключение
      // оборвёт mount и стартовый экран останется с выключенной кнопкой навсегда
      try {
        await ctx.assets.loadGroup('core', p => { fill.style.width = `${p * 50}%`; });
        await ctx.assets.loadGroup('rank0', p => { fill.style.width = `${50 + p * 50}%`; });
      } catch (e) {
        console.error('loadGroup failed, continuing with placeholders', e);
      }
      fill.style.width = '100%';
      btn.disabled = false;
      btn.addEventListener('click', () => {
        // кнопка гасится сразу: двойной клик за 1200 мс не должен дать два перехода
        btn.disabled = true;
        ctx.audio.unlock();
        ctx.audio.playVoice('vo_title');
        // пауза под реплику имеет смысл, только если реплика реально загружена;
        // без неё (этап 1, сбой загрузки, `generated: false`) не заставляем ждать 1.2 с
        const delay = ctx.assets.getAudioData('vo_title') !== null ? 1200 : 150;
        goTimer = window.setTimeout(() => {
          goTimer = null;
          ctx.setState(createInitialState());
          ctx.go('event');
        }, delay);
      });
    },
    unmount() {
      if (goTimer !== null) { clearTimeout(goTimer); goTimer = null; }
    },
  };
}
