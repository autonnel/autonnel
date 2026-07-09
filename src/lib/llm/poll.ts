import { PollTimeoutError } from './errors';
import type { LlmModel } from '@/lib/config/llm-models-types';
import type { VideoJob, VideoProvider } from './types';

export interface PollOptions {
  intervalMs?: number;
  timeoutMs?: number;
  abortSignal?: AbortSignal;
  onProgress?: (job: VideoJob) => void;
}

const TERMINAL = new Set<VideoJob['status']>(['succeeded', 'failed', 'cancelled']);

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    if (signal) {
      const onAbort = () => {
        clearTimeout(t);
        reject(signal.reason ?? new DOMException('aborted', 'AbortError'));
      };
      if (signal.aborted) onAbort();
      else signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

export async function pollJob(
  provider: VideoProvider,
  jobId: string,
  model: LlmModel,
  options: PollOptions = {},
): Promise<VideoJob> {
  const intervalMs = options.intervalMs ?? 3000;
  const timeoutMs = options.timeoutMs ?? 600_000;
  const deadline = Date.now() + timeoutMs;

  while (true) {
    if (options.abortSignal?.aborted) {
      throw options.abortSignal.reason ?? new DOMException('aborted', 'AbortError');
    }
    const job = await provider.getJob(jobId, model);
    options.onProgress?.(job);
    if (TERMINAL.has(job.status)) return job;
    if (Date.now() >= deadline) throw new PollTimeoutError(timeoutMs);
    await sleep(intervalMs, options.abortSignal);
  }
}
