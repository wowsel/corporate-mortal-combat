import { gsap } from 'gsap';
import { availableMoves, createBattle, resolveTurn } from '../battle';
import { introSteps, outcomeSteps, turnSteps } from '../choreo';
import type { Ctx, Screen } from '../engine';
import { createHud } from '../hud';
import { banner, damageNumber, dim, flash, grayscale, particles, shake, speechLine, wait } from '../render/effects';
import { getScene, type Scene } from '../render/scene';
import { afterBattle, checkEnding, currentRank } from '../state';
import type { BattleState, Boss, Move, Step } from '../types';

// bossAnim не выделен: turnSteps отдаёт ход одним списком шагов, разрезать его по границе
// ответа босса нельзя без изменения хореографии — вся анимация хода живёт в playerAnim
type Phase = 'intro' | 'awaitInput' | 'playerAnim' | 'over';

export function createBattleScreen(): Screen {
  let scene: Scene | null = null;
  const keys: ((e: KeyboardEvent) => void)[] = [];
  const onKey = (h: (e: KeyboardEvent) => void) => { keys.push(h); window.addEventListener('keydown', h); };
  const offKeys = () => { for (const h of keys.splice(0)) window.removeEventListener('keydown', h); };
  let alive = true;

  return {
    async mount(root, ctx: Ctx) {
      alive = true;
      const state = ctx.getState();
      const rank = currentRank(state, ctx.content.ranks);
      const boss: Boss = rank.boss;
      let battle: BattleState = createBattle(boss);
      let phase: Phase = 'intro';

      ctx.audio.playMusic(boss.final ? 'mu_final' : 'mu_battle');

      const el = document.createElement('div');
      el.className = 'screen battle';
      el.innerHTML = `
        <div class="battle-frame">
          <div class="battle-canvas"></div>
          <div class="battle-overlay">
            <button class="hud-mute battle-mute" type="button">${ctx.audio.muted ? '🔇' : '🔊'}</button>
            <div class="moves"></div>
            <div class="result-panel" hidden>
              <h2 class="result-title"></h2>
              <div class="result-hud"></div>
              <button class="btn-primary result-next">Дальше</button>
            </div>
          </div>
        </div>`;
      root.appendChild(el);

      const mute = el.querySelector<HTMLButtonElement>('.battle-mute')!;
      mute.addEventListener('click', () => { ctx.audio.setMuted(!ctx.audio.muted); mute.textContent = ctx.audio.muted ? '🔇' : '🔊'; });

      scene = getScene();
      await scene.mount(el.querySelector('.battle-canvas')!);
      if (!alive) return;

      const tex = (id: string) => ctx.assets.getTexture(id);
      scene.setBackground(tex(rank.background));
      scene.setFighter('hero', { idle: tex('sp_hero_idle'), attack: tex('sp_hero_attack'), hurt: tex('sp_hero_hurt'), win: tex('sp_hero_win') }, 'Вы', rank.title, tex('pt_hero_neutral'));
      scene.setFighter('boss', { idle: tex(boss.sprites.idle), attack: tex(boss.sprites.attack), hurt: tex(boss.sprites.hurt), defeated: tex(boss.sprites.defeated) }, boss.name, boss.title, tex(boss.portraits.neutral));
      // полоски не сбрасываются сами между боями: выставить полные значения до интро
      void scene.setBar('hero', battle.maxConfidence, battle.maxConfidence, 0);
      void scene.setBar('boss', battle.maxPatience, battle.maxPatience, 0);

      const movesEl = el.querySelector<HTMLElement>('.moves')!;
      const renderMoves = () => {
        const list = availableMoves(boss, battle);
        movesEl.replaceChildren(...list.map(({ move, enabled }, i) => {
          const b = document.createElement('button');
          b.className = `move-card ${move.id === 'strike' ? 'strike' : ''}`;
          b.disabled = !enabled || phase !== 'awaitInput';
          const expected = move.stat ? Math.round(10 + state.stats[move.stat] * 0.15 - (move.id === 'joke' ? state.stats.stress * 0.05 : 0)) : 0;
          b.innerHTML = `<span class="move-key">${i + 1}</span><span class="move-name">${move.name}</span><span class="move-stat">${move.stat ? `≈${Math.max(3, expected)}` : ''}</span>`;
          b.title = enabled ? move.hint : 'Не при свидетелях.';
          b.addEventListener('click', () => void onMove(move));
          return b;
        }));
      };

      const run = async (steps: Step[]) => {
        for (const s of steps) {
          // после unmount ни один шаг больше не трогает сцену: промисы твинов не резолвятся
          if (!alive || !scene) return;
          switch (s.t) {
            case 'pose': (s.who === 'hero' ? scene.hero : scene.boss).setPose(s.pose); break;
            case 'move': await (s.who === 'hero' ? scene.hero : scene.boss).moveTo(s.dx, s.ms); break;
            case 'camera': await scene.camera(s.zoom, s.ms); break;
            case 'flash': void flash(scene, s.color, s.ms); break;
            case 'shake': void shake(scene, s.amp, s.ms); break;
            case 'particles': particles(scene, s.at, s.kind); break;
            case 'damage': damageNumber(scene, s.at, s.value, s.muted); break;
            case 'bar': void scene.setBar(s.who, s.to, s.who === 'hero' ? battle.maxConfidence : battle.maxPatience, s.ms); break;
            case 'line': speechLine(scene, s.text, s.style); break;
            case 'banner': await banner(scene, s.text); break;
            case 'sound': ctx.audio.play(s.name, s.gain); break;
            case 'voice': ctx.audio.playVoice(s.id); break;
            case 'dim': await dim(scene, s.to, s.ms); break;
            case 'grayscale': await grayscale(scene, s.to, s.ms); break;
            case 'timeScale': scene.setTimeScale(s.to); break;
            case 'wait': await wait(s.ms); break;
            default: { const never: never = s; void never; break; }
          }
        }
      };

      const finish = async (outcome: 'win' | 'lose' | 'fatality') => {
        phase = 'over';
        scene?.stopTimer();
        const next = afterBattle(ctx.getState(), boss, outcome);
        ctx.setState(next);
        const panel = el.querySelector<HTMLElement>('.result-panel')!;
        panel.querySelector('.result-title')!.textContent = outcome === 'win' ? 'Ступень пройдена' : outcome === 'lose' ? 'Ступень повторяется' : 'Ну вот.';
        const hud = createHud(panel.querySelector('.result-hud')!, { mute: false });
        hud.update(state, rank.title);
        requestAnimationFrame(() => { if (alive) hud.update(next, currentRank(next, ctx.content.ranks).title); });
        panel.hidden = false;
        let navigated = false;
        const go = () => {
          if (navigated) return;
          navigated = true;
          const ending = checkEnding(ctx.getState(), ctx.content.ranks);
          ctx.go(ending ? 'ending' : 'event');
        };
        panel.querySelector('.result-next')!.addEventListener('click', go, { once: true });
        offKeys(); // снять цифровой обработчик, повесить Enter
        onKey(e => { if (e.ctrlKey || e.metaKey || e.altKey) return; if (e.key === 'Enter') go(); });
      };

      const onMove = async (move: Move) => {
        if (phase !== 'awaitInput') return;
        phase = 'playerAnim';
        renderMoves();
        const prev = battle;
        const result = resolveTurn(prev, move, ctx.getState().stats, boss);
        battle = result.battle;
        await run(turnSteps(result, boss, prev));
        if (!alive) return;
        if (result.outcome === 'continue') { phase = 'awaitInput'; renderMoves(); return; }
        await run(outcomeSteps(result, boss));
        if (!alive) return;
        await finish(result.outcome);
      };

      onKey(e => {
        if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
        const n = Number(e.key);
        if (phase !== 'awaitInput' || !(n >= 1 && n <= 5)) return;
        const list = availableMoves(boss, battle);
        const item = list[n - 1];
        if (item?.enabled) void onMove(item.move);
      });

      renderMoves();
      await run(introSteps(boss));
      if (!alive || !scene) return;
      scene.startTimer();
      phase = 'awaitInput';
      renderMoves();
    },
    unmount() {
      alive = false;
      offKeys();
      gsap.globalTimeline.timeScale(1);
      scene?.unmount();
      scene = null;
    },
  };
}
