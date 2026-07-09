import { PollTimeoutError } from './errors';

export interface PollPredictionOptions {
  intervalMs?: number;
  timeoutMs?: number;
  abortSignal?: AbortSignal;
}

export type PredictionStatus = 'pending' | 'done' | 'failed';

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

export async function pollPrediction<T>(
  fetchOnce: () => Promise<T>,
  classify: (raw: T) => PredictionStatus,
  options: PollPredictionOptions = {},
): Promise<T> {
  const intervalMs = options.intervalMs ?? 2000;
  const timeoutMs = options.timeoutMs ?? 300_000;
  const deadline = Date.now() + timeoutMs;

  while (true) {
    if (options.abortSignal?.aborted) {
      throw options.abortSignal.reason ?? new DOMException('aborted', 'AbortError');
    }
    const raw = await fetchOnce();
    const status = classify(raw);
    if (status === 'done') return raw;
    if (status === 'failed') {
      throw new Error(`Prediction failed: ${JSON.stringify(raw)}`);
    }
    if (Date.now() >= deadline) throw new PollTimeoutError(timeoutMs);
    await sleep(intervalMs, options.abortSignal);
  }
}
