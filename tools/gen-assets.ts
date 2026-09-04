import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import type { AssetEntry, Manifest } from '../src/types';
import { requireKey } from './env';
import { PUBLIC_ASSETS, RAW_DIR, publicPath, rawPath, readManifest, topoSort, writeManifest } from './manifest';
import { generateAudio, generateImage, toDataUrl, withRetry } from './openrouter';

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(n);
const opt = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const only = opt('--only')?.split(',').map(s => s.trim()).filter(Boolean);
const group = opt('--group');
const force = flag('--force');
const dryRun = flag('--dry-run');

const PRICE = { img1k: 0.045, img2k: 0.09, ref: 0.003, music: 0.04, voice: 0.02 };
// Выставлено по результату smoke-теста Task 3: Lyria принимает поле `audio`
const MUSIC_AUDIO_PARAMS = true;

function aspectOf(size: [number, number] | undefined): string {
  if (!size) return '1:1';
  const [w, h] = size;
  const r = w / h;
  if (Math.abs(r - 16 / 9) < 0.05) return '16:9';
  if (Math.abs(r - 7 / 9) < 0.05) return '3:4';
  if (Math.abs(r - 1) < 0.05) return '1:1';
  return r > 1 ? '3:2' : '2:3';
}

function resolutionOf(e: AssetEntry): '1K' | '2K' {
  return e.resolution ?? (e.kind === 'background' || e.kind === 'illustration' ? '2K' : '1K');
}

function estimate(e: AssetEntry): number {
  if (e.kind === 'music') return PRICE.music;
  if (e.kind === 'voice') return PRICE.voice;
  return (resolutionOf(e) === '2K' ? PRICE.img2k : PRICE.img1k) + (e.references?.length ?? 0) * PRICE.ref;
}

function refToDataUrl(ref: string, byId: Map<string, AssetEntry>): string {
  if (ref.includes('/')) return toDataUrl(resolve(process.cwd(), ref));
  const e = byId.get(ref);
  if (!e) throw new Error(`reference "${ref}" not in manifest`);
  const raw = rawPath(e);
  if (!existsSync(raw)) throw new Error(`reference "${ref}" has no raw file at ${raw}; generate it first`);
  return toDataUrl(raw);
}

function postprocessPlain(e: AssetEntry): void {
  const out = publicPath(e);
  mkdirSync(dirname(out), { recursive: true });
  const size = e.size ?? [1600, 900];
  const q = e.kind === 'portrait' ? 80 : 72;
  execFileSync('python3', ['tools/postprocess.py', 'plain', '--out', out, '--size', `${size[0]}x${size[1]}`, '--quality', String(q), rawPath(e)], { stdio: ['ignore', 'pipe', 'inherit'] });
}

function postprocessCharacter(character: string, manifest: Manifest): void {
  const poses = manifest.entries.filter(x => x.kind === 'sprite' && x.character === character);
  if (!poses.every(x => existsSync(rawPath(x)))) { console.log(`  [${character}] not all poses generated yet, skipping crop`); return; }
  const outDir = dirname(publicPath(poses[0]!));
  mkdirSync(outDir, { recursive: true });
  const items = poses.map(x => `${x.id}=${rawPath(x)}`);
  const flip = poses.some(x => x.flip) ? '1' : '0';
  const res = execFileSync('python3', ['tools/postprocess.py', 'character', '--out-dir', outDir, '--size', '700x900', '--chroma', (poses[0]!.chroma ?? '#FF00FF').replace('#', ''), '--flip', flip, '--quality', '80', ...items], { encoding: 'utf8' });
  const meta = JSON.parse(res) as { anchor: [number, number]; files: Record<string, string> };
  for (const x of poses) {
    x.anchor = meta.anchor;
    x.generated = true;
    // файл должен совпадать с manifest.file
    const want = publicPath(x);
    const got = meta.files[x.id]!;
    if (resolve(got) !== want) renameSync(got, want);
  }
}

function toMp3(buf: Buffer, format: string, target: string, kind: 'music' | 'voice'): void {
  // всегда через ffmpeg: нормализуем битрейт под бюджет (музыка 96k стерео, голос 64k моно)
  mkdirSync(dirname(target), { recursive: true });
  const tmp = resolve(RAW_DIR, `${basename(target)}.${format}.tmp`);
  writeFileSync(tmp, buf);
  try {
    const extra = kind === 'voice' ? ['-ac', '1', '-b:a', '64k'] : ['-b:a', '96k'];
    const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', tmp, '-codec:a', 'libmp3lame', ...extra, target]);
    if (r.status !== 0) throw new Error(`ffmpeg failed: ${r.stderr?.toString()}`);
  } finally { rmSync(tmp, { force: true }); }
}

async function main() {
  const manifest = readManifest();
  const byId = new Map(manifest.entries.map(e => [e.id, e]));
  let todo = topoSort(manifest.entries).filter(e => (force || !e.generated));
  if (only) todo = todo.filter(e => only.includes(e.id));
  if (group) todo = todo.filter(e => e.group === group);
  const noPrompt = todo.filter(e => !e.prompt.trim());
  todo = todo.filter(e => e.prompt.trim().length > 0);
  if (noPrompt.length) console.log(`skipped ${noPrompt.length} entries without prompt: ${noPrompt.map(e => e.id).join(', ')}`);
  if (!todo.length) { console.log('nothing to generate'); return; }

  const est = todo.reduce((s, e) => s + estimate(e), 0);
  console.log(`${todo.length} assets to generate, estimated cost ≈ $${est.toFixed(2)}`);
  for (const e of todo) console.log(`  ${e.kind.padEnd(12)} ${e.id.padEnd(28)} ${e.model}  ~$${estimate(e).toFixed(3)}`);
  if (dryRun) return;

  const key = requireKey();
  mkdirSync(RAW_DIR, { recursive: true });
  let spent = 0;
  const touchedCharacters = new Set<string>();

  for (const e of todo) {
    // утверждённый raw не пересъёмываем без --force: иначе --group core снимет idle заново,
    // и остальные позы получат другой референс, чем тот, что смотрели глазами
    if (!force && existsSync(rawPath(e))) {
      console.log(`  ${e.id}: raw exists, skip generation (use --force to redo)`);
      if (e.kind === 'sprite' && e.character) touchedCharacters.add(e.character);
      else if (e.kind !== 'music' && e.kind !== 'voice' && !e.generated) { postprocessPlain(e); e.generated = true; }
      continue;
    }
    console.log(`→ ${e.id}`);
    try {
      if (e.kind === 'music' || e.kind === 'voice') {
        const r = await withRetry(() => generateAudio({ model: e.model, prompt: e.prompt, voice: e.voice, format: 'mp3', audioParams: e.kind === 'music' ? MUSIC_AUDIO_PARAMS : true }, key));
        toMp3(r.audio, r.format, publicPath(e), e.kind);
        spent += r.cost ?? estimate(e);
        e.generated = true;
      } else {
        const refs = (e.references ?? []).map(ref => refToDataUrl(ref, byId));
        const prompt = `${manifest.stylePrefix}\n\n${e.prompt}`;
        const r = await withRetry(() => generateImage({ model: e.model, prompt, aspectRatio: aspectOf(e.size), resolution: resolutionOf(e), references: refs, seed: e.seed }, key));
        writeFileSync(rawPath(e), r.png);
        spent += r.cost ?? estimate(e);
        if (e.kind === 'sprite' && e.character) touchedCharacters.add(e.character);
        else { postprocessPlain(e); e.generated = true; }
      }
      writeManifest(manifest); // сохраняем прогресс после каждого ассета
    } catch (err) {
      console.error(`  ✗ ${e.id}: ${String(err).slice(0, 400)}`);
    }
  }
  for (const c of touchedCharacters) {
    try { postprocessCharacter(c, manifest); } catch (err) { console.error(`  ✗ crop ${c}: ${String(err).slice(0, 400)}`); }
  }
  writeManifest(manifest);
  console.log(`done, spent ≈ $${spent.toFixed(2)}. Public dir: ${PUBLIC_ASSETS}`);
}

main().catch(e => { console.error(e); process.exit(1); });
