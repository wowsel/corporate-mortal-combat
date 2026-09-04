import { gsap } from 'gsap';
import { Application, Container, Graphics, Sprite, Text, TextStyle, Texture } from 'pixi.js';

export const W = 1280;
export const H = 720;
const GROUND_Y = 640;
const HERO_X = 380;
const BOSS_X = 900;

export interface FighterView {
  readonly container: Container;
  readonly baseX: number;
  setPose(pose: string): void;
  moveTo(dx: number, ms: number): Promise<void>;
}

type Track = (t: gsap.core.Tween | gsap.core.Timeline) => void;

class Fighter implements FighterView {
  container = new Container();
  private sprite = new Sprite(Texture.EMPTY);
  private textures: Record<string, Texture> = {};
  private breath: gsap.core.Tween | null = null;
  constructor(public readonly baseX: number, private readonly flip: boolean, private readonly track: Track) {
    this.sprite.anchor.set(0.5, 1);
    this.container.addChild(this.sprite);
    this.container.position.set(baseX, GROUND_Y);
  }
  setTextures(t: Record<string, Texture>, anchor: [number, number] | null = null) {
    this.textures = t;
    this.setPose('idle');
    const targetH = 520;
    const tex = t['idle'] ?? Texture.EMPTY;
    // якорь задан в пикселях исходной картинки (точка опоры — ступни); все позы одного размера
    if (anchor) this.sprite.anchor.set(anchor[0] / Math.max(1, tex.width), anchor[1] / Math.max(1, tex.height));
    else this.sprite.anchor.set(0.5, 1);
    const s = targetH / Math.max(1, tex.height);
    this.sprite.scale.set(this.flip ? -s : s, s);
    this.breath?.kill();
    this.breath = gsap.to(this.sprite.scale, { y: s * 1.015, duration: 1, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  }
  setPose(pose: string) { this.sprite.texture = this.textures[pose] ?? this.textures['idle'] ?? Texture.EMPTY; }
  moveTo(dx: number, ms: number) {
    // onInterrupt: при unmount твин убивают — промис обязан разрешиться, иначе шаг хореографии зависнет навсегда
    return new Promise<void>(res => {
      this.track(gsap.to(this.container, { x: this.baseX + dx, duration: ms / 1000, ease: 'power2.out', onComplete: res, onInterrupt: res }));
    });
  }
  stopBreath() { this.breath?.kill(); this.breath = null; }
}

class Bar {
  container = new Container();
  private ghost = new Graphics();
  private fill = new Graphics();
  private frame = new Graphics();
  private nameText: Text;
  private titleText: Text;
  private value = 1; private ghostValue = 1;
  constructor(private readonly x: number, private readonly width: number, private readonly rtl: boolean, private readonly track: Track) {
    this.frame.rect(0, 0, width, 26).fill({ color: 0x111111 }).stroke({ color: 0xc9a34a, width: 2 });
    this.nameText = new Text({ text: '', style: new TextStyle({ fontFamily: 'Impact, Arial Black, sans-serif', fontSize: 20, fill: 0xf1e6c8, letterSpacing: 1 }) });
    this.titleText = new Text({ text: '', style: new TextStyle({ fontFamily: 'sans-serif', fontSize: 12, fill: 0x9a927f }) });
    this.nameText.position.set(rtl ? width : 0, 30); this.nameText.anchor.set(rtl ? 1 : 0, 0);
    this.titleText.position.set(rtl ? width : 0, 52); this.titleText.anchor.set(rtl ? 1 : 0, 0);
    this.container.addChild(this.frame, this.ghost, this.fill, this.nameText, this.titleText);
    this.container.position.set(x, 24);
    this.redraw();
  }
  setLabels(name: string, title: string) { this.nameText.text = name; this.titleText.text = title; }
  private draw(g: Graphics, v: number, color: number) {
    g.clear();
    const w = (this.width - 6) * v;
    g.rect(this.rtl ? this.width - 3 - w : 3, 3, w, 20).fill({ color });
  }
  private redraw() { this.draw(this.ghost, this.ghostValue, 0xb03030); this.draw(this.fill, this.value, 0xe3c35a); }
  set(v: number, ms: number): Promise<void> {
    const target = Math.max(0, Math.min(1, v));
    return new Promise(res => {
      this.track(gsap.to(this, { value: target, duration: ms / 1000, ease: 'power2.out', onUpdate: () => this.redraw(), onComplete: res, onInterrupt: res }));
      this.track(gsap.to(this, { ghostValue: target, duration: (ms + 600) / 1000, delay: 0.15, ease: 'power1.out', onUpdate: () => this.redraw() }));
    });
  }
}

export interface Scene {
  mount(container: HTMLElement): Promise<void>;
  unmount(): void;
  setBackground(texture: Texture): void;
  setFighter(who: 'hero' | 'boss', textures: Record<string, Texture>, name: string, title: string, portrait: Texture, anchor?: [number, number] | null): void;
  hero: FighterView; boss: FighterView;
  setBar(who: 'hero' | 'boss', value: number, max: number, ms: number): Promise<void>;
  camera(zoom: number, ms: number): Promise<void>;
  setTimeScale(v: number): void;
  /**
   * Реестр твинов сцены: всё, что зарегистрировано, убивается в unmount.
   * Твины, чей промис ждёт хореография, обязаны отдавать `onInterrupt` рядом с `onComplete` —
   * иначе после unmount промис не разрешится и цикл шагов зависнет.
   */
  track(t: gsap.core.Tween | gsap.core.Timeline): void;
  layers: { root: Container; world: Container; fx: Container; banners: Container; overlay: Container };
  readonly app: Application;
  fighterPoint(who: 'hero' | 'boss'): { x: number; y: number };
  startTimer(): void; stopTimer(): void;
}

let instance: Scene | null = null;

export function getScene(): Scene {
  if (instance) return instance;
  const app = new Application();
  const rootC = new Container();       // масштабируется под окно
  const world = new Container();       // камера двигает/зумит
  const bg = new Sprite(Texture.EMPTY);
  const shadows = new Graphics();
  const fighters = new Container();
  const fx = new Container();
  const hud = new Container();
  const banners = new Container();
  const overlay = new Container();
  const vignette = new Graphics();
  const frameMask = new Graphics();
  const tracked = new Set<gsap.core.Tween | gsap.core.Timeline>();
  const track: Track = t => {
    // подчистка завершённых: реестр живёт от mount до unmount, за бой в него попадают сотни твинов
    for (const x of tracked) if (x.progress() === 1 && !x.isActive()) tracked.delete(x);
    tracked.add(t);
  };
  const hero = new Fighter(HERO_X, false, track);
  const boss = new Fighter(BOSS_X, true, track);
  const heroBar = new Bar(40, 500, false, track);
  const bossBar = new Bar(W - 40 - 500, 500, true, track);
  const heroPortrait = new Sprite(Texture.EMPTY);
  const bossPortrait = new Sprite(Texture.EMPTY);
  const timerText = new Text({ text: '99', style: new TextStyle({ fontFamily: 'Impact, Arial Black, sans-serif', fontSize: 44, fill: 0xf1e6c8 }) });
  let timer: gsap.core.Tween | null = null;
  let inited = false;
  let resizeHandler: (() => void) | null = null;

  shadows.ellipse(HERO_X, GROUND_Y + 6, 120, 18).fill({ color: 0x000000, alpha: 0.45 });
  shadows.ellipse(BOSS_X, GROUND_Y + 6, 150, 20).fill({ color: 0x000000, alpha: 0.45 });
  vignette.rect(0, 0, W, 80).fill({ color: 0x000000, alpha: 0.35 });
  vignette.rect(0, H - 100, W, 100).fill({ color: 0x000000, alpha: 0.5 });

  bg.anchor.set(0.5); bg.position.set(W / 2, H / 2);
  fighters.addChild(hero.container, boss.container);
  world.addChild(bg, shadows, fighters, fx);
  world.pivot.set(W / 2, H / 2); world.position.set(W / 2, H / 2);
  timerText.anchor.set(0.5, 0); timerText.position.set(W / 2, 20);
  // размеры портретов задаются в setFighter, когда есть реальная текстура: у Texture.EMPTY размер 0×0 и width=56 даст scale=Infinity
  heroPortrait.position.set(40 + 500 + 10, 24);
  bossPortrait.anchor.set(1, 0); bossPortrait.position.set(W - 40 - 500 - 10, 24);
  hud.addChild(heroBar.container, bossBar.container, heroPortrait, bossPortrait, timerText);
  frameMask.rect(0, 0, W, H).fill({ color: 0xffffff });
  // виньетка под HUD, иначе она затемняет полоски, имена и таймер
  rootC.addChild(world, vignette, hud, banners, overlay, frameMask);
  // маска-ребёнок: следует за scale/position rootC и обрезает фон (×1.06) и камеру по «письму»
  rootC.mask = frameMask;

  const fit = (container: HTMLElement) => {
    const w = container.clientWidth, h = container.clientHeight;
    const s = Math.min(w / W, h / H);
    rootC.scale.set(s);
    rootC.position.set((w - W * s) / 2, (h - H * s) / 2);
  };

  const cameraTween = (zoom: number, ms: number) => new Promise<void>(res => {
    track(gsap.to(world.scale, { x: zoom, y: zoom, duration: ms / 1000, ease: 'power2.out', onComplete: res, onInterrupt: res }));
    track(gsap.to(bg, { x: W / 2 - (zoom - 1) * 40, duration: ms / 1000, ease: 'power2.out' }));
  });

  instance = {
    app, hero, boss,
    layers: { root: rootC, world, fx, banners, overlay },
    async mount(container) {
      if (!inited) {
        await app.init({ backgroundAlpha: 0, antialias: true, resolution: Math.min(2, window.devicePixelRatio || 1), autoDensity: true, resizeTo: container });
        app.stage.addChild(rootC);
        inited = true;
      } else {
        app.resizeTo = container;
      }
      container.appendChild(app.canvas);
      app.canvas.style.position = 'absolute'; app.canvas.style.inset = '0';
      resizeHandler = () => fit(container);
      app.renderer.on('resize', resizeHandler);
      app.resize(); fit(container);
      gsap.globalTimeline.timeScale(1);
    },
    unmount() {
      gsap.globalTimeline.timeScale(1);
      // сначала реестр: kill() зовёт onInterrupt, промисы шагов разрешаются и цикл в battle-экране выходит по !alive
      for (const t of tracked) t.kill();
      tracked.clear();
      gsap.killTweensOf([world, world.scale, bg, hero.container, boss.container, heroBar, bossBar]);
      (hero as Fighter).stopBreath(); (boss as Fighter).stopBreath();
      // убить твины эффектов до уничтожения их объектов, иначе onComplete вызовет destroy() повторно
      for (const layer of [fx, banners, overlay]) {
        gsap.killTweensOf(layer.children);
        for (const c of layer.children) gsap.killTweensOf(c.scale);
        layer.removeChildren().forEach(c => { if (!c.destroyed) c.destroy({ children: true }); });
      }
      if (resizeHandler) app.renderer.off('resize', resizeHandler);
      resizeHandler = null;
      app.resizeTo = window; // иначе ResizePlugin прочитает clientWidth=0 у удалённого контейнера
      world.filters = []; rootC.filters = []; world.alpha = 1; world.scale.set(1); world.position.set(W / 2, H / 2);
      hero.container.position.set(HERO_X, GROUND_Y); boss.container.position.set(BOSS_X, GROUND_Y);
      this.stopTimer();
      app.canvas.remove();
    },
    setBackground(texture) {
      bg.texture = texture;
      const s = Math.max(W / texture.width, H / texture.height) * 1.06;
      bg.scale.set(s);
    },
    setFighter(who, textures, name, title, portrait, anchor) {
      const f = who === 'hero' ? hero : boss;
      (f as Fighter).setTextures(textures, anchor ?? null);
      (who === 'hero' ? heroBar : bossBar).setLabels(name, title);
      const p = who === 'hero' ? heroPortrait : bossPortrait;
      p.texture = portrait; p.width = 56; p.height = 56;
    },
    setBar(who, value, max, ms) { return (who === 'hero' ? heroBar : bossBar).set(value / (max || 1), ms); },
    camera: cameraTween,
    setTimeScale(v) { gsap.globalTimeline.timeScale(v); },
    track,
    fighterPoint(who) {
      const f = who === 'hero' ? hero : boss;
      return { x: f.container.x, y: f.container.y - 260 };
    },
    startTimer() {
      let last = 99; timerText.text = '99';
      timer?.kill();
      const t = { v: 99 }; // прокси-объект: `this.progress()` в onUpdate не компилируется под strict
      timer = gsap.to(t, { v: 0, duration: 99, ease: 'none', onUpdate: () => { const v = Math.max(0, Math.ceil(t.v)); if (v !== last) { last = v; timerText.text = String(v); } } });
      track(timer);
    },
    stopTimer() { timer?.kill(); timer = null; },
  };
  return instance;
}
