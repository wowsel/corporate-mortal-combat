import type { AssetStore } from './assets';
import type { SoundName } from './types';

const MUTE_KEY = 'cmk.muted';

export interface Audio {
  unlock(): void;
  play(name: SoundName, gain?: number): void;
  playVoice(id: string): void;
  playMusic(id: string): void;
  stopMusic(): void;
  typeTick(): void;
  readonly muted: boolean;
  setMuted(m: boolean): void;
}

export function createAudio(assets: AssetStore): Audio {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let muted = safeRead() === '1';
  let music: { src: AudioBufferSourceNode; gain: GainNode; id: string } | null = null;
  let lastType = 0;

  function safeRead(): string | null { try { return localStorage.getItem(MUTE_KEY); } catch { return null; } }
  function safeWrite(v: string) { try { localStorage.setItem(MUTE_KEY, v); } catch { /* ignore */ } }

  function ensure(): AudioContext | null {
    if (!ctx) {
      try {
        ctx = new AudioContext();
        master = ctx.createGain();
        master.gain.value = muted ? 0 : 1;
        master.connect(ctx.destination);
      } catch { return null; }
    }
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    return ctx;
  }

  function noise(ac: AudioContext, seconds: number): AudioBuffer {
    const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * seconds), ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function env(ac: AudioContext, node: AudioNode, peak: number, attack: number, decay: number): GainNode {
    const g = ac.createGain();
    const t = ac.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    node.connect(g); g.connect(master!);
    return g;
  }

  function tone(ac: AudioContext, type: OscillatorType, f0: number, f1: number, dur: number, peak: number) {
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, ac.currentTime);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), ac.currentTime + dur);
    env(ac, o, peak, 0.005, dur);
    o.start(); o.stop(ac.currentTime + dur + 0.05);
  }

  function burst(ac: AudioContext, dur: number, peak: number, filterHz: number, q = 1) {
    const s = ac.createBufferSource(); s.buffer = noise(ac, dur);
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = filterHz; f.Q.value = q;
    s.connect(f); env(ac, f, peak, 0.003, dur);
    s.start(); s.stop(ac.currentTime + dur + 0.05);
  }

  const sfx: Record<SoundName, (ac: AudioContext, gain: number) => void> = {
    hit: (ac, g) => { burst(ac, 0.18, 0.9 * g, 900, 0.7); tone(ac, 'sine', 140, 40, 0.25, 0.8 * g); },
    immune: (ac, g) => { tone(ac, 'square', 90, 60, 0.12, 0.35 * g); },
    special: (ac, g) => { tone(ac, 'sawtooth', 55, 30, 0.9, 0.5 * g); burst(ac, 0.05, 0.6 * g, 3000, 2); },
    whoosh: (ac, g) => { burst(ac, 0.22, 0.35 * g, 1800, 0.5); },
    bar: (ac, g) => { tone(ac, 'triangle', 1200, 900, 0.05, 0.15 * g); },
    banner: (ac, g) => {
      const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = 110;
      const o2 = ac.createOscillator(); o2.type = 'triangle'; o2.frequency.value = 165;
      const delay = ac.createDelay(1); delay.delayTime.value = 0.18;
      const fb = ac.createGain(); fb.gain.value = 0.45;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
      const g1 = env(ac, o, 0.7 * g, 0.01, 1.6); env(ac, o2, 0.3 * g, 0.01, 1.2);
      g1.connect(delay); delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(master!);
      o.start(); o2.start(); o.stop(ac.currentTime + 2); o2.stop(ac.currentTime + 2);
      setTimeout(() => { lp.disconnect(); fb.disconnect(); delay.disconnect(); }, 2500);
    },
    type: (ac, g) => { tone(ac, 'square', 2200, 2000, 0.015, 0.05 * g); },
    win: (ac, g) => {
      [0, 0.15, 0.3].forEach((dt, i) => {
        const o = ac.createOscillator(); o.type = 'triangle';
        o.frequency.value = [523, 659, 784][i]!;
        const gn = ac.createGain(); gn.gain.value = 0;
        gn.gain.setValueAtTime(0, ac.currentTime + dt);
        gn.gain.linearRampToValueAtTime(0.4 * g, ac.currentTime + dt + 0.02);
        gn.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dt + 0.6);
        o.connect(gn); gn.connect(master!); o.start(ac.currentTime + dt); o.stop(ac.currentTime + dt + 0.7);
      });
    },
    lose: (ac, g) => { tone(ac, 'sawtooth', 220, 60, 1.2, 0.4 * g); },
  };

  function playSfx(name: SoundName, gain: number) {
    const ac = ensure(); if (!ac || !master || ac.state !== 'running') return;
    try { sfx[name](ac, gain); } catch (e) { console.warn('sfx failed', name, e); }
  }

  function playBuffer(buf: AudioBuffer, gainValue: number): { src: AudioBufferSourceNode; gain: GainNode } | null {
    const ac = ensure(); if (!ac || !master) return null;
    const src = ac.createBufferSource(); src.buffer = buf;
    const gain = ac.createGain(); gain.gain.value = gainValue;
    src.connect(gain); gain.connect(master); src.start();
    return { src, gain };
  }

  return {
    get muted() { return muted; },
    setMuted(m) {
      muted = m; safeWrite(m ? '1' : '0');
      if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.02);
    },
    unlock() { ensure(); },
    play(name, gain = 1) { playSfx(name, gain); },
    typeTick() {
      const now = performance.now();
      if (now - lastType < 35) return;
      lastType = now; playSfx('type', 1);
    },
    playVoice(id) {
      const buf = assets.getAudioBuffer(id);
      if (buf) playBuffer(buf, 0.9);
    },
    playMusic(id) {
      if (music?.id === id) return;
      const buf = assets.getAudioBuffer(id);
      if (!buf) return;
      const ac = ensure(); if (!ac) return;
      const old = music; music = null;
      if (old) { old.gain.gain.setTargetAtTime(0, ac.currentTime, 0.4); old.src.stop(ac.currentTime + 1.2); }
      const started = playBuffer(buf, 0); if (!started) return;
      started.src.loop = true;
      started.gain.gain.setTargetAtTime(0.5, ac.currentTime, 0.4);
      music = { ...started, id };
    },
    stopMusic() {
      const ac = ctx; const old = music; music = null;
      if (old && ac) { old.gain.gain.setTargetAtTime(0, ac.currentTime, 0.4); old.src.stop(ac.currentTime + 1.2); }
    },
  };
}
