import { gsap } from 'gsap';
import { ColorMatrixFilter, Container, FillGradient, Graphics, Text, TextStyle } from 'pixi.js';
import { GlowFilter } from 'pixi-filters';
import { H, W, type Scene } from './scene';

type Settle = { onComplete: () => void; onInterrupt: () => void };

/**
 * Создаёт твин через `make`, регистрирует его в реестре сцены и ждёт завершения.
 * Резолвится `true` при нормальном завершении и `false`, если твин убили в `scene.unmount()`.
 * Все эффекты, чей промис ждёт контроллер боя, обязаны идти через эту обёртку:
 * иначе после unmount промис не разрешится и цикл шагов зависнет навсегда.
 */
function settle(scene: Scene, make: (cb: Settle) => gsap.core.Tween): Promise<boolean> {
  return new Promise<boolean>(res => {
    let done = false;
    const finish = (ok: boolean) => { if (!done) { done = true; res(ok); } };
    scene.track(make({ onComplete: () => finish(true), onInterrupt: () => finish(false) }));
  });
}

/** Пауза на прокси-твине (а не delayedCall): её тоже надо убивать при unmount. */
function delay(scene: Scene, ms: number): Promise<boolean> {
  const st = { v: 0 };
  return settle(scene, cb => gsap.to(st, { v: 1, duration: ms / 1000, ease: 'none', ...cb }));
}

async function wait(scene: Scene, ms: number): Promise<void> { await delay(scene, ms); }

export async function flash(scene: Scene, color: string, ms: number): Promise<void> {
  const g = new Graphics().rect(0, 0, W, H).fill({ color });
  g.alpha = 0.85;
  scene.layers.overlay.addChild(g);
  await settle(scene, cb => gsap.to(g, { alpha: 0, duration: ms / 1000, ease: 'power1.out', ...cb }));
  if (!g.destroyed) g.destroy();
}

export async function shake(scene: Scene, amp: number, ms: number): Promise<void> {
  const w = scene.layers.world;
  const ox = W / 2, oy = H / 2;
  const st = { p: 0 }; // прокси вместо this.progress(): под strict `this` в onUpdate не типизирован
  // прокси не является целью killTweensOf(world) — без реестра твин продолжал бы дёргать сцену после unmount
  await settle(scene, cb => gsap.to(st, {
    p: 1, duration: ms / 1000, ease: 'none',
    onUpdate: () => { const k = 1 - st.p; w.position.set(ox + (Math.random() * 2 - 1) * amp * k, oy + (Math.random() * 2 - 1) * amp * k); },
    ...cb,
  }));
  w.position.set(ox, oy);
}

export function particles(scene: Scene, at: 'hero' | 'boss' | 'screen', kind: 'paper' | 'sparks' | 'confetti'): void {
  const layer = scene.layers.fx;
  const count = kind === 'confetti' ? 120 : 18;
  const origin = at === 'screen' ? null : scene.fighterPoint(at);
  for (let i = 0; i < count; i++) {
    const g = new Graphics();
    if (kind === 'sparks') g.rect(0, 0, 6, 2).fill({ color: 0xffd36b });
    else g.rect(0, 0, 10, 14).fill({ color: kind === 'confetti' ? [0xffffff, 0xc9a34a, 0xb03030][i % 3]! : 0xf1eee6 });
    g.position.set(origin ? origin.x + (Math.random() - 0.5) * 60 : Math.random() * W, origin ? origin.y + (Math.random() - 0.5) * 120 : -20);
    g.rotation = Math.random() * Math.PI;
    layer.addChild(g);
    const dir = at === 'hero' ? -1 : 1;
    gsap.to(g, {
      x: g.x + (origin ? dir * (120 + Math.random() * 220) : (Math.random() - 0.5) * 200),
      y: g.y + (origin ? (kind === 'sparks' ? (Math.random() - 0.5) * 200 : 200 + Math.random() * 200) : H + 40),
      rotation: g.rotation + (Math.random() - 0.5) * 8,
      alpha: 0, duration: kind === 'sparks' ? 0.4 : 1.4 + Math.random() * 0.8, ease: kind === 'sparks' ? 'power2.out' : 'power1.in',
      onComplete: () => { if (!g.destroyed) g.destroy(); },
    });
  }
}

export function damageNumber(scene: Scene, at: 'hero' | 'boss', value: number, muted: boolean): void {
  const p = scene.fighterPoint(at);
  const t = new Text({ text: String(value), style: new TextStyle({ fontFamily: 'Impact, Arial Black, sans-serif', fontSize: muted ? 40 : 64, fill: muted ? 0x8a8a8a : 0xfff0b0, stroke: { color: 0x000000, width: 6 } }) });
  t.anchor.set(0.5); t.position.set(p.x, p.y - 60);
  scene.layers.fx.addChild(t);
  gsap.fromTo(t.scale, { x: 0.4, y: 0.4 }, { x: 1, y: 1, duration: 0.18, ease: 'back.out(2)' });
  gsap.to(t, { y: t.y - 90, alpha: 0, duration: 0.9, delay: 0.2, ease: 'power1.in', onComplete: () => { if (!t.destroyed) t.destroy(); } });
}

export async function banner(scene: Scene, text: string): Promise<void> {
  const grad = new FillGradient({
    start: { x: 0, y: 0 }, end: { x: 0, y: 1 },
    colorStops: [{ offset: 0, color: '#fff6d5' }, { offset: 0.5, color: '#e3c35a' }, { offset: 1, color: '#8a5f14' }],
  });
  const style = new TextStyle({
    fontFamily: 'Impact, Arial Black, sans-serif', fontSize: text.length > 12 ? 92 : 128, letterSpacing: 6,
    fill: grad,
    stroke: { color: 0x1a0d00, width: 10 },
    dropShadow: { color: 0x000000, blur: 8, distance: 6, alpha: 0.7 },
  });
  const t = new Text({ text, style });
  t.anchor.set(0.5); t.position.set(W / 2, H / 2 - 40);
  t.filters = [new GlowFilter({ distance: 24, outerStrength: 2.5, color: 0xffc94d })];
  scene.layers.banners.addChild(t);
  const drop = () => { if (!t.destroyed) t.destroy(); };
  // после unmount ни один следующий шаг баннера не должен создавать новых твинов
  if (!(await settle(scene, cb => gsap.fromTo(t.scale, { x: 3, y: 3 }, { x: 1, y: 1, duration: 0.25, ease: 'power3.out', ...cb })))) return drop();
  void shake(scene, 6, 200);
  if (!(await delay(scene, 900))) return drop();
  await settle(scene, cb => gsap.to(t, { alpha: 0, duration: 0.3, ...cb }));
  drop();
}

const SPEECH = 'speech';
// Геометрия пузыря (координаты сцены 1280×720): стоит в просвете между бойцами, растёт вниз от HUD.
// Замер по idle-спрайтам (все позы 700×900 → высота 520): герой в idle занимает x ≤ 450, босс — x ≥ 775
// (Шан Цзун — самый широкий, голова от 787), головы на y 128–275, HUD заканчивается на ~75.
// Отсюда центр просвета 612, коробка не шире 318 (перенос 290 + 2×14) и верх на 100: пузырь стоит
// рядом с лицом босса, не закрывая ни его, ни героя. Худший случай текста (реакция 75 + реплика 110)
// при ~30 знаках в строке — 8 строк ≈ 220 px; страховка — шрифт 17 px, если коробка длиннее допустимого.
const BUBBLE_CENTER_X = 612;
const BUBBLE_TOP = 100;
const BUBBLE_MAX_BOTTOM = 600;
const BUBBLE_WRAP = 290;
const BUBBLE_FONT = 20;
const BUBBLE_FONT_SMALL = 17;
const BUBBLE_PAD = 14;
const BUBBLE_FILL = 0xf5efe0;
const BUBBLE_STROKE = 0x3a2a10;

/**
 * Гасит закреплённый пузырь босса (если есть). Вызывается контроллером боя в момент выбора приёма:
 * пузырь висел, пока игрок читал и думал, ход сделан — убрать.
 */
export function clearSpeech(scene: Scene): void {
  const old = scene.layers.banners.getChildByLabel(SPEECH);
  if (!old) return;
  old.label = ''; // следующий пузырь не должен найти уходящий по метке
  gsap.to(old, { alpha: 0, duration: 0.25, onComplete: () => { if (!old.destroyed) old.destroy({ children: true }); } });
}

function drawBubbleBox(box: Graphics, t: Text): { w: number; h: number } {
  const w = t.width + BUBBLE_PAD * 2;
  const h = t.height + BUBBLE_PAD * 2;
  box.clear();
  box.roundRect(-w / 2, -h / 2, w, h, 10).fill({ color: BUBBLE_FILL }).stroke({ color: BUBBLE_STROKE, width: 2 });
  // хвостик вправо, к лицу босса (y ≈ 180 на сцене, то есть ~80 px ниже верха коробки; у короткой коробки — по центру):
  // заливка поверх рамки, затем обводка только двух внешних рёбер
  const x0 = w / 2 - 1, yTip = -h / 2 + Math.min(80, h - 30), yTop = yTip - 16, yBot = yTip + 12;
  box.poly([x0, yTop, x0 + 24, yTip, x0, yBot]).fill({ color: BUBBLE_FILL });
  box.moveTo(x0, yTop).lineTo(x0 + 24, yTip).lineTo(x0, yBot).stroke({ color: BUBBLE_STROKE, width: 2 });
  return { w, h };
}

/** Перерисовать коробку под текст и поставить пузырь правым нижним углом к точке привязки; если не влезает по высоте — шрифт меньше. */
function layoutBubble(c: Container): void {
  const t = c.getChildByLabel('text') as Text;
  const box = c.getChildByLabel('box') as Graphics;
  t.style.fontSize = BUBBLE_FONT;
  let size = drawBubbleBox(box, t);
  if (size.h > BUBBLE_MAX_BOTTOM - BUBBLE_TOP) { t.style.fontSize = BUBBLE_FONT_SMALL; size = drawBubbleBox(box, t); }
  c.position.set(BUBBLE_CENTER_X, BUBBLE_TOP + size.h / 2);
}

/**
 * Реплика босса.
 * `bubble` — облачко между бойцами; не гаснет само: висит до следующего пузыря, до хода игрока (`clearSpeech`)
 * или до unmount сцены (слой banners чистится там). `append` дописывает текст абзацем в висящий пузырь
 * (реакция на ответ героя + следующая реплика читаются вместе); без пузыря ведёт себя как обычный `bubble`.
 * Новый пузырь без `append` уничтожает предыдущий мгновенно — иначе две коробки лежат друг на друге.
 * `center` — крик спецприёма поверх затемнения, гаснет сам вместе с затемнением.
 */
export function speechLine(scene: Scene, text: string, style: 'bubble' | 'center', append = false): void {
  const layer = scene.layers.banners;
  if (style === 'center') {
    const t = new Text({ text, style: new TextStyle({ fontFamily: 'Impact, Arial Black, sans-serif', fontSize: 44, fill: 0xff6b6b, wordWrap: true, wordWrapWidth: 900, align: 'center' }) });
    t.anchor.set(0.5);
    t.position.set(W / 2, H / 2 + 80);
    t.alpha = 0;
    layer.addChild(t);
    gsap.to(t, { alpha: 1, y: t.y - 10, duration: 0.2 });
    gsap.to(t, { alpha: 0, duration: 0.3, delay: 1.2, onComplete: () => { if (!t.destroyed) t.destroy(); } });
    return;
  }
  const existing = layer.getChildByLabel(SPEECH) as Container | null;
  if (append && existing) {
    const t = existing.getChildByLabel('text') as Text;
    t.text = `${t.text}\n\n${text}`;
    layoutBubble(existing);
    return;
  }
  if (existing) { gsap.killTweensOf(existing); existing.destroy({ children: true }); }
  const c = new Container();
  c.label = SPEECH;
  const box = new Graphics();
  box.label = 'box';
  const t = new Text({ text, style: new TextStyle({ fontFamily: 'sans-serif', fontSize: BUBBLE_FONT, fill: 0x1a1a1a, wordWrap: true, wordWrapWidth: BUBBLE_WRAP, align: 'left', lineHeight: 24 }) });
  t.label = 'text';
  t.anchor.set(0.5);
  c.addChild(box, t);
  layoutBubble(c);
  c.alpha = 0;
  layer.addChild(c);
  scene.track(gsap.to(c, { alpha: 1, duration: 0.2 }));
}

export function dim(scene: Scene, to: number, ms: number): Promise<void> {
  const layer = scene.layers.overlay;
  let g = layer.getChildByLabel('dim') as Graphics | null;
  if (!g) { g = new Graphics().rect(0, 0, W, H).fill({ color: 0x000000 }); g.label = 'dim'; g.alpha = 0; layer.addChildAt(g, 0); }
  const target = g;
  return settle(scene, cb => gsap.to(target, { alpha: to, duration: ms / 1000, ...cb })).then(() => {});
}

export function grayscale(scene: Scene, to: number, ms: number): Promise<void> {
  // фильтр на корневом контейнере: сереет всё, включая полоски и таймер; баннер PERFORMANCE REVIEW
  // рисуется в layers.banners, который тоже внутри root — это принято: серый баннер читается как «провал»
  const root = scene.layers.root;
  let f = (root.filters as ColorMatrixFilter[] | null)?.find(x => x instanceof ColorMatrixFilter);
  if (!f) { f = new ColorMatrixFilter(); root.filters = [f]; }
  const state = { v: 0 };
  const filter = f;
  // прокси state вне killTweensOf: без реестра фильтр продолжал бы обновляться после unmount
  return settle(scene, cb => gsap.to(state, { v: to, duration: ms / 1000, onUpdate: () => { filter.reset(); filter.saturate(-state.v, false); }, ...cb })).then(() => {});
}

export { wait };
