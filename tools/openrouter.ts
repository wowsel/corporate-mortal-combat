import { readFileSync } from 'node:fs';

const BASE = 'https://openrouter.ai/api/v1';
const HEADERS = (key: string) => ({
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
  'HTTP-Referer': 'https://github.com/wowsel/corporate-mortal-combat',
  'X-Title': 'Corporate Mortal Kombat asset pipeline',
});

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}

export async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) {
      last = e;
      // 400/401/402/403 — неверный запрос, ключ или нет средств: повтор бессмыслен
      if (e instanceof ApiError && e.status >= 400 && e.status < 404) break;
      await new Promise(r => setTimeout(r, 2000 * (i + 1)));
    }
  }
  throw last;
}

export function toDataUrl(path: string): string {
  const buf = readFileSync(path);
  const mime = path.endsWith('.png') ? 'image/png' : path.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
  return `data:${mime};base64,${buf.toString('base64')}`;
}

export interface ImageRequest {
  model: string; prompt: string; aspectRatio: string; resolution: '1K' | '2K'; references: string[]; seed?: number;
}

/**
 * Внимание: поле `png` названо так по контракту из брифа, но байты в нём —
 * то, что реально вернул провайдер. Seedream 5.0 Pro отдаёт **JPEG**
 * (проверено smoke-тестом), а не PNG. Постобработке (Task 5) формат нужно
 * определять по содержимому файла, а не по имени поля или расширению;
 * sharp и Pillow это делают сами.
 */
export async function generateImage(req: ImageRequest, key: string): Promise<{ png: Buffer; cost: number | null }> {
  const body: Record<string, unknown> = {
    model: req.model, prompt: req.prompt, aspect_ratio: req.aspectRatio, resolution: req.resolution, n: 1,
  };
  if (req.seed !== undefined) body['seed'] = req.seed;
  if (req.references.length) body['input_references'] = req.references.map(url => ({ type: 'image_url', image_url: { url } }));
  const res = await fetch(`${BASE}/images`, { method: 'POST', headers: HEADERS(key), body: JSON.stringify(body) });
  if (!res.ok) throw new ApiError(`images ${res.status}: ${(await res.text()).slice(0, 500)}`, res.status);
  const json = await res.json() as { data?: { b64_json?: string; media_type?: string }[]; usage?: { cost?: number } };
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error(`images: no b64_json in response: ${JSON.stringify(json).slice(0, 300)}`);
  return { png: Buffer.from(b64, 'base64'), cost: json.usage?.cost ?? null };
}

export interface AudioRequest {
  model: string; prompt: string;
  voice?: string;            // голоса chat-completions-аудио OpenAI: alloy, ash, ballad, coral, echo, sage, shimmer, verse
  format: 'mp3' | 'wav';
  audioParams?: boolean;     // false — не посылать поле `audio` вовсе (для моделей, которые его отвергают)
}

// PCM16 от chat-completions-аудио OpenAI: 24 кГц, моно, 16 бит little-endian.
const PCM_SAMPLE_RATE = 24000;
const PCM_CHANNELS = 1;

function pcm16ToWav(pcm: Buffer, sampleRate = PCM_SAMPLE_RATE, channels = PCM_CHANNELS): Buffer {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);                        // размер fmt-чанка
  h.writeUInt16LE(1, 20);                         // PCM без сжатия
  h.writeUInt16LE(channels, 22);
  h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE(sampleRate * channels * 2, 28); // байт в секунду
  h.writeUInt16LE(channels * 2, 32);              // выравнивание блока
  h.writeUInt16LE(16, 34);                        // бит на сэмпл
  h.write('data', 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

/**
 * Отклонения от брифа (оба вынуждены реальным API, оба проверены smoke-тестом):
 *
 * 1. Стриминг обязателен. Не-стриминговый запрос OpenRouter отвергает с 400:
 *    "Audio output requires stream: true". Поэтому `stream: true` остаётся.
 *
 * 2. Формат при стриминге у OpenAI только pcm16. Запрос mp3 даёт 400:
 *    "Unsupported value: 'audio.format' does not support 'mp3' when stream=true.
 *     Supported values are: 'pcm16'."
 *    Поэтому при таком отказе (он бесплатен — генерации не было) запрос
 *    автоматически повторяется с `format: 'pcm16'`, а сырой PCM на выходе
 *    заворачивается в WAV-контейнер. Наружу тогда отдаётся `format: 'wav'`;
 *    перегон в mp3 — задача постобработки (Task 5).
 *    Модели, которые отдают готовый mp3/wav сами (Lyria), идут первым путём
 *    без всякого повтора.
 */
export async function generateAudio(req: AudioRequest, key: string): Promise<{ audio: Buffer; format: string; cost: number | null }> {
  const post = (fmt: string) => {
    const body: Record<string, unknown> = {
      model: req.model, stream: true, modalities: ['text', 'audio'],
      messages: [{ role: 'user', content: req.prompt }],
      stream_options: { include_usage: true }, // без этого usage.cost в стриме не приходит
    };
    if (req.audioParams !== false) body['audio'] = req.voice ? { voice: req.voice, format: fmt } : { format: fmt };
    return fetch(`${BASE}/chat/completions`, { method: 'POST', headers: HEADERS(key), body: JSON.stringify(body) });
  };

  let requested = req.format as string;
  let res = await post(requested);
  if (!res.ok) {
    const text = (await res.text()).slice(0, 500);
    // Отказ до генерации денег не стоит, поэтому повтор безопасен.
    if (res.status === 400 && text.includes('pcm16') && req.audioParams !== false) {
      requested = 'pcm16';
      res = await post(requested);
      if (!res.ok) throw new ApiError(`audio ${res.status}: ${(await res.text()).slice(0, 500)}`, res.status);
    } else {
      throw new ApiError(`audio ${res.status}: ${text}`, res.status);
    }
  }
  if (!res.body) throw new ApiError('audio: empty response body', res.status);

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  const chunks: string[] = [];
  let cost: number | null = null;
  let reported: string | null = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') continue;
      try {
        const j = JSON.parse(payload) as { choices?: { delta?: { audio?: { data?: string; format?: string } } }[]; usage?: { cost?: number } };
        const a = j.choices?.[0]?.delta?.audio;
        if (a?.data) chunks.push(a.data);
        if (a?.format) reported = a.format;
        if (j.usage?.cost !== undefined) cost = j.usage.cost;
      } catch { /* keep-alive или мусор */ }
    }
  }
  if (!chunks.length) throw new Error('audio: stream contained no audio chunks');

  const raw = Buffer.from(chunks.join(''), 'base64');
  const format = reported ?? requested;
  if (format === 'pcm16') return { audio: pcm16ToWav(raw), format: 'wav', cost };
  return { audio: raw, format, cost };
}
