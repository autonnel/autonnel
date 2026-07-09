import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pollJob } from '@/lib/llm/poll';
import { PollTimeoutError } from '@/lib/llm/errors';
import type { VideoJob, VideoProvider } from '@/lib/llm/types';
import type { LlmModel } from '@/lib/config/llm-models-types';

const MODEL: LlmModel = {
  type: 'video',
  provider: 'test',
  name: 'r',
  modelId: 'r',
  baseUrl: 'https://x.example',
  apiKey: 'sk',
};

function makeProvider(jobs: VideoJob[]): VideoProvider {
  const getJob = vi.fn().mockImplementation(async () => {
    const next = jobs.shift();
    if (!next) throw new Error('out of fixtures');
    return next;
  });
  return {
    id: 'test-video',
    createJob: vi.fn(),
    getJob,
  };
}

describe('pollJob', () => {
  beforeEach(() => vi.useRealTimers());

  it('returns immediately when first poll is succeeded', async () => {
    const provider = makeProvider([
      { id: 'j1', status: 'succeeded', outputUrl: 'https://cdn/v.mp4' },
    ]);
    const out = await pollJob(provider, 'j1', MODEL, { intervalMs: 5, timeoutMs: 500 });
    expect(out.status).toBe('succeeded');
    expect(out.outputUrl).toBe('https://cdn/v.mp4');
    expect(provider.getJob).toHaveBeenCalledTimes(1);
  });

  it('returns when status transitions to failed', async () => {
    const provider = makeProvider([
      { id: 'j1', status: 'queued' },
      { id: 'j1', status: 'processing', progress: 0.5 },
      { id: 'j1', status: 'failed', error: 'gpu oom' },
    ]);
    const out = await pollJob(provider, 'j1', MODEL, { intervalMs: 5, timeoutMs: 500 });
    expect(out.status).toBe('failed');
    expect(out.error).toBe('gpu oom');
    expect(provider.getJob).toHaveBeenCalledTimes(3);
  });

  it('returns when status transitions to cancelled', async () => {
    const provider = makeProvider([
      { id: 'j1', status: 'processing' },
      { id: 'j1', status: 'cancelled' },
    ]);
    const out = await pollJob(provider, 'j1', MODEL, { intervalMs: 5, timeoutMs: 500 });
    expect(out.status).toBe('cancelled');
  });

  it('throws PollTimeoutError when status never becomes terminal', async () => {
    const provider = makeProvider(
      Array.from({ length: 50 }, (_, i) => ({ id: 'j1', status: 'processing' as const, progress: i / 50 })),
    );
    await expect(
      pollJob(provider, 'j1', MODEL, { intervalMs: 5, timeoutMs: 30 }),
    ).rejects.toBeInstanceOf(PollTimeoutError);
  });

  it('cascades external abortSignal', async () => {
    const controller = new AbortController();
    const provider = makeProvider(
      Array.from({ length: 50 }, () => ({ id: 'j1', status: 'processing' as const })),
    );
    setTimeout(() => controller.abort(), 20);
    await expect(
      pollJob(provider, 'j1', MODEL, { intervalMs: 5, timeoutMs: 5000, abortSignal: controller.signal }),
    ).rejects.toBeInstanceOf(DOMException);
  });

  it('invokes onProgress for non-terminal polls', async () => {
    const provider = makeProvider([
      { id: 'j1', status: 'queued' },
      { id: 'j1', status: 'processing', progress: 0.3 },
      { id: 'j1', status: 'succeeded', outputUrl: 'x' },
    ]);
    const onProgress = vi.fn();
    await pollJob(provider, 'j1', MODEL, { intervalMs: 5, timeoutMs: 500, onProgress });
    expect(onProgress).toHaveBeenCalledTimes(3);
    expect(onProgress.mock.calls[1][0].progress).toBe(0.3);
  });
});
