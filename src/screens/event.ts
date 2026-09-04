import type { Ctx, Screen } from '../engine';
import { createHud } from '../hud';
import { applyChoice, checkEnding, currentEvent, currentRank, visibleChoices } from '../state';
import type { AssetGroup, Choice, GameEvent } from '../types';

export function createEventScreen(): Screen {
  let typing: number | null = null;
  let keyHandler: ((e: KeyboardEvent) => void) | null = null;

  function stopTyping() { if (typing !== null) { clearInterval(typing); typing = null; } }

  return {
    async mount(root, ctx: Ctx) {
      const state = ctx.getState();
      const rank = currentRank(state, ctx.content.ranks);
      const ev = currentEvent(state, ctx.content.ranks);
      if (!ev) { ctx.go('battle'); return; }
      ctx.audio.playMusic(state.rank >= 3 ? 'mu_council' : 'mu_office');
      // префетч следующей ступени и концовок (на этапе 1 — no-op заглушки)
      if (state.rank + 1 < ctx.content.ranks.length) ctx.assets.prefetchGroup(`rank${state.rank + 1}` as AssetGroup);
      if (state.rank >= 4) ctx.assets.prefetchGroup('endings');

      // фон и портрет читаются синхронно — дождаться группы ступени, иначе первое событие
      // новой ступени отрисуется заглушками, если префетч не успел
      await ctx.assets.loadGroup(`rank${state.rank}` as AssetGroup);

      const el = document.createElement('div');
      el.className = 'screen event';
      const bg = ctx.assets.getImageUrl(rank.background);
      el.innerHTML = `
        <div class="hud-slot"></div>
        <div class="vn-stage" style="${bg ? `background-image:url('${bg}')` : `background:${placeholderBg(rank.background)}`}">
          <div class="vn-portrait"></div>
          <div class="vn-dialog">
            <div class="vn-name"></div>
            <div class="vn-text"></div>
            <div class="vn-choices"></div>
            <button class="vn-next btn-primary" hidden>Дальше</button>
          </div>
        </div>`;
      root.appendChild(el);

      const hud = createHud(el.querySelector('.hud-slot')!);
      hud.update(state, rank.title);
      const muteBtn = hud.muteButton!;
      muteBtn.textContent = ctx.audio.muted ? '🔇' : '🔊';
      muteBtn.addEventListener('click', () => { ctx.audio.setMuted(!ctx.audio.muted); muteBtn.textContent = ctx.audio.muted ? '🔇' : '🔊'; });

      const portrait = el.querySelector<HTMLElement>('.vn-portrait')!;
      const nameEl = el.querySelector<HTMLElement>('.vn-name')!;
      const textEl = el.querySelector<HTMLElement>('.vn-text')!;
      const choicesEl = el.querySelector<HTMLElement>('.vn-choices')!;
      const nextBtn = el.querySelector<HTMLButtonElement>('.vn-next')!;

      const setPortrait = (id: string) => {
        const url = ctx.assets.getImageUrl(id);
        portrait.style.background = url ? `url('${url}') center/cover no-repeat` : placeholderBg(id);
        portrait.dataset.id = id;
        portrait.classList.remove('bump'); void portrait.offsetWidth; portrait.classList.add('bump');
      };

      const typeText = (text: string, onDone: () => void) => {
        stopTyping();
        textEl.textContent = '';
        let i = 0;
        const finish = () => { stopTyping(); textEl.textContent = text; textEl.onclick = null; onDone(); };
        textEl.onclick = finish;
        typing = window.setInterval(() => {
          i += 1;
          textEl.textContent = text.slice(0, i);
          ctx.audio.typeTick();
          if (i >= text.length) finish();
        }, 22);
      };

      const isRepeat = state.seenEvents.has(ev.id);
      setPortrait(ev.speaker.portrait);
      nameEl.textContent = ev.speaker.name;

      const showChoices = (event: GameEvent) => {
        const list = visibleChoices(event, state);
        choicesEl.replaceChildren(...list.map((c, i) => {
          const b = document.createElement('button');
          b.className = 'vn-choice';
          b.innerHTML = `<span class="vn-key">${i + 1}</span>${c.text}`;
          b.addEventListener('click', () => pick(event, c));
          return b;
        }));
        choicesEl.classList.add('show');
        let picked = false;
        keyHandler = e => {
          if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
          if (picked) return;
          const n = Number(e.key);
          if (n >= 1 && n <= list.length) { picked = true; pick(event, list[n - 1]!); }
        };
        window.addEventListener('keydown', keyHandler);
      };

      const pick = (event: GameEvent, choice: Choice) => {
        if (keyHandler) { window.removeEventListener('keydown', keyHandler); keyHandler = null; }
        choicesEl.classList.remove('show');
        choicesEl.replaceChildren();
        const next = applyChoice(ctx.getState(), event, choice);
        ctx.setState(next);
        hud.update(next, rank.title);
        let done = false;
        const proceed = () => {
          if (done) return;
          done = true;
          if (keyHandler) { window.removeEventListener('keydown', keyHandler); keyHandler = null; }
          const ending = checkEnding(ctx.getState(), ctx.content.ranks);
          if (ending) { ctx.go('ending'); return; }
          ctx.go(currentEvent(ctx.getState(), ctx.content.ranks) ? 'event' : 'battle');
        };
        if (choice.reaction) {
          setPortrait(choice.reaction.portrait);
          typeText(choice.reaction.text, () => {
            nextBtn.hidden = false;
            nextBtn.onclick = proceed;
            keyHandler = e => {
              if (e.ctrlKey || e.metaKey || e.altKey) return;
              if (e.key === 'Enter') proceed();
            };
            window.addEventListener('keydown', keyHandler);
          });
        } else proceed();
      };

      typeText(isRepeat && ev.repeatText ? ev.repeatText : ev.text, () => showChoices(ev));
    },
    unmount() {
      stopTyping();
      if (keyHandler) window.removeEventListener('keydown', keyHandler);
      keyHandler = null;
    },
  };
}

export function placeholderBg(id: string): string {
  let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `linear-gradient(160deg, hsl(${h % 360} 30% 18%), hsl(${(h + 40) % 360} 30% 8%))`;
}
