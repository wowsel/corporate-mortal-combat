import { writeFileSync } from 'node:fs';
import { requireKey } from './env';
import { generateAudio, generateImage } from './openrouter';

const key = requireKey();
const what = process.argv[2] ?? 'image';
if (what === 'image') {
  const r = await generateImage({ model: 'bytedance-seed/seedream-5-0-pro', prompt: 'a red office stapler on a wooden desk, photorealistic, soft window light', aspectRatio: '1:1', resolution: '1K', references: [] }, key);
  writeFileSync('assets/raw/_smoke.png', r.png); console.log('image ok', r.png.length, 'bytes, cost', r.cost);
} else if (what === 'voice') {
  const r = await generateAudio({ model: 'openai/gpt-audio-mini', prompt: 'Say exactly, in a deep dramatic fighting-game announcer voice, nothing else: "FIGHT!"', voice: 'ash', format: 'mp3' }, key);
  writeFileSync(`assets/raw/_smoke_voice.${r.format}`, r.audio); console.log('voice ok', r.audio.length, r.format, 'cost', r.cost);
} else {
  const withAudio = process.argv[3] !== 'noaudio';
  const r = await generateAudio({ model: 'google/lyria-3-clip-preview', prompt: 'Instrumental. Dark orchestral fighting-game theme with taiko drums and a ringing office telephone in the rhythm, 30 seconds, loopable.', format: 'mp3', audioParams: withAudio }, key);
  writeFileSync(`assets/raw/_smoke_music.${r.format}`, r.audio); console.log('music ok', r.audio.length, r.format, 'cost', r.cost);
}
