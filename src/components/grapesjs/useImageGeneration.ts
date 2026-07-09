import { useCallback, useRef } from 'react';

export type MediaKind = 'image' | 'video';

export interface GenerateOptions {
  prompt: string;
  type?: MediaKind;
  aspectRatio?: string;
  inputImage?: string;
  modelName?: string;
  duration?: number;
  signal?: AbortSignal;
  onStatus?: (status: 'enqueued' | 'polling' | 'completed' | 'error') => void;
}

const POLL_INTERVAL_MS = 3000;
const IMAGE_MAX_POLL_MS = 10 * 60_000;
const VIDEO_MAX_POLL_MS = 20 * 60_000;

async function postGenerate(opts: GenerateOptions): Promise<string> {
  const res = await fetch('/api/media/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: opts.type ?? 'image',
      prompt: opts.prompt,
      aspectRatio: opts.aspectRatio || '1:1',
      inputImage: opts.inputImage,
      modelName: opts.modelName,
      duration: opts.duration,
    }),
    signal: opts.signal,
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const data = (await res.json()) as { id: string };
  return data.id;
}

async function pollResult(id: string, opts: GenerateOptions): Promise<string> {
  const startedAt = Date.now();
  const limit = opts.type === 'video' ? VIDEO_MAX_POLL_MS : IMAGE_MAX_POLL_MS;
  while (true) {
    if (Date.now() - startedAt > limit) {
      throw new Error(`${opts.type === 'video' ? 'Video' : 'Image'} generation timed out`);
    }
    if (opts.signal?.aborted) {
      throw new Error('Generation aborted');
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const res = await fetch(`/api/media/generate?id=${id}`, { signal: opts.signal });
    if (!res.ok) continue;
    const data = (await res.json()) as { status: string; url?: string; error?: string };
    if (data.status === 'COMPLETED' && data.url) return data.url;
    if (data.status === 'ERROR') throw new Error(data.error || 'Generation failed');
  }
}

export function useImageGeneration() {
  const inflightRef = useRef<Map<string, AbortController>>(new Map());

  const generate = useCallback(async (key: string, opts: GenerateOptions): Promise<string> => {
    const existing = inflightRef.current.get(key);
    if (existing) existing.abort();
    const controller = new AbortController();
    inflightRef.current.set(key, controller);
    try {
      opts.onStatus?.('enqueued');
      const id = await postGenerate({ ...opts, signal: controller.signal });
      opts.onStatus?.('polling');
      const url = await pollResult(id, { ...opts, signal: controller.signal });
      opts.onStatus?.('completed');
      return url;
    } catch (err) {
      opts.onStatus?.('error');
      throw err;
    } finally {
      if (inflightRef.current.get(key) === controller) {
        inflightRef.current.delete(key);
      }
    }
  }, []);

  const cancel = useCallback((key: string) => {
    inflightRef.current.get(key)?.abort();
    inflightRef.current.delete(key);
  }, []);

  return { generate, cancel };
}
