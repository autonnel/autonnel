import { describe, it, expect, vi } from 'vitest';
import { pollPrediction, type PredictionStatus } from '@/lib/llm/poll-prediction';
import { PollTimeoutError } from '@/lib/llm/errors';

describe('pollPrediction', () => {
  it('returns immediately when classifier sees "done"', async () => {
    const fetchOnce = vi.fn().mockResolvedValueOnce({ status: 'Ready', payload: 42 });
    const classify = vi.fn().mockReturnValueOnce('done' as PredictionStatus);
    const out = await pollPrediction(fetchOnce, classify, { intervalMs: 5, timeoutMs: 500 });
    expect(out).toEqual({ status: 'Ready', payload: 42 });
    expect(fetchOnce).toHaveBeenCalledTimes(1);
  });

  it('loops while classifier returns "pending"', async () => {
    const fetchOnce = vi.fn()
      .mockResolvedValueOnce({ status: 'Pending' })
      .mockResolvedValueOnce({ status: 'Pending' })
      .mockResolvedValueOnce({ status: 'Ready' });
    const classify = vi.fn().mockImplementation((raw: { status: string }) =>
      raw.status === 'Ready' ? 'done' : 'pending');
    const out = await pollPrediction(fetchOnce, classify, { intervalMs: 5, timeoutMs: 500 });
    expect(out).toEqual({ status: 'Ready' });
    expect(fetchOnce).toHaveBeenCalledTimes(3);
  });

  it('throws an Error containing the failed raw when classifier returns "failed"', async () => {
    const fetchOnce = vi.fn().mockResolvedValueOnce({ status: 'Error', message: 'gpu oom' });
    const classify = vi.fn().mockReturnValueOnce('failed' as PredictionStatus);
    await expect(
      pollPrediction(fetchOnce, classify, { intervalMs: 5, timeoutMs: 500 }),
    ).rejects.toThrow(/gpu oom|Error|prediction failed/);
  });

  it('throws PollTimeoutError if deadline exceeded', async () => {
    const fetchOnce = vi.fn().mockResolvedValue({ status: 'Pending' });
    const classify = vi.fn().mockReturnValue('pending' as PredictionStatus);
    await expect(
      pollPrediction(fetchOnce, classify, { intervalMs: 5, timeoutMs: 25 }),
    ).rejects.toBeInstanceOf(PollTimeoutError);
  });

  it('cascades external abortSignal', async () => {
    const ctrl = new AbortController();
    const fetchOnce = vi.fn().mockResolvedValue({ status: 'Pending' });
    const classify = vi.fn().mockReturnValue('pending' as PredictionStatus);
    setTimeout(() => ctrl.abort(), 15);
    await expect(
      pollPrediction(fetchOnce, classify, { intervalMs: 5, timeoutMs: 5000, abortSignal: ctrl.signal }),
    ).rejects.toBeInstanceOf(DOMException);
  });
});
