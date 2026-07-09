export interface PendingMediaItem {
  key: string;
  componentId: string | null;
  componentIndex: number;
  componentType: string;
  fieldPath: Array<string | number>;
  label: string;
  prompt: string;
  mediaType: 'image' | 'video';
  referenceImageUrl?: string;
  aspectRatio: string;
}

export interface GeneratePendingMediaOptions {
  planId: string;
  concurrency?: number;
  apply: (item: PendingMediaItem, url: string) => void;
  onStart?: (item: PendingMediaItem) => void;
  onDone?: (item: PendingMediaItem, url: string) => void;
  onError?: (item: PendingMediaItem, message: string) => void;
}

export interface GeneratePendingMediaResult {
  succeeded: number;
  failed: number;
}

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_MS: Record<'image' | 'video', number> = {
  image: 10 * 60_000,
  video: 20 * 60_000,
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function generateOne(item: PendingMediaItem, planId: string): Promise<string> {
  const res = await fetch('/api/media/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      planId,
      type: item.mediaType,
      prompt: item.prompt,
      purpose: 'component_media',
      aspectRatio: item.aspectRatio,
      ...(item.referenceImageUrl ? { inputImage: item.referenceImageUrl } : {}),
    }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const { id } = (await res.json()) as { id: string };

  const startedAt = Date.now();
  const limit = MAX_POLL_MS[item.mediaType];
  while (true) {
    if (Date.now() - startedAt > limit) {
      throw new Error(`${item.mediaType === 'video' ? 'Video' : 'Image'} generation timed out`);
    }
    await sleep(POLL_INTERVAL_MS);
    const poll = await fetch(`/api/media/generate?id=${id}`);
    if (!poll.ok) continue;
    const data = (await poll.json()) as { status: string; url?: string; error?: string };
    if (data.status === 'COMPLETED' && data.url) return data.url;
    if (data.status === 'ERROR') throw new Error(data.error || 'Generation failed');
  }
}

export async function generatePendingMedia(
  items: PendingMediaItem[],
  opts: GeneratePendingMediaOptions,
): Promise<GeneratePendingMediaResult> {
  const queue = [...items];
  let succeeded = 0;
  let failed = 0;

  const workers = Array.from(
    { length: Math.max(1, Math.min(opts.concurrency ?? 3, queue.length)) },
    async () => {
      while (queue.length > 0) {
        const item = queue.shift()!;
        opts.onStart?.(item);
        try {
          const url = await generateOne(item, opts.planId);
          opts.apply(item, url);
          succeeded += 1;
          opts.onDone?.(item, url);
        } catch (e) {
          failed += 1;
          opts.onError?.(item, e instanceof Error ? e.message : 'Generation failed');
        }
      }
    },
  );

  await Promise.all(workers);
  return { succeeded, failed };
}
