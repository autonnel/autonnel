import { describe, it, expect, vi } from 'vitest';
import { runDeferredHandoffSweep } from '../handoff-deferred-cron';

describe('runDeferredHandoffSweep', () => {
  it('enqueues ONE merged handoff per abandoned order and clears its flag', async () => {
    const intentRepo = {
      findHandoffDeferredOlderThan: vi.fn(async () => [
        { saleRef: { value: 's1' } },
        { saleRef: { value: 's2' } },
      ]),
    } as never;
    const enqueueHandoff = vi.fn(async (_saleRef?: string) => {});
    const clearFlag = vi.fn(async (_saleRef?: string) => {});

    const out = await runDeferredHandoffSweep({ intentRepo, enqueueHandoff, clearFlag, cutoff: new Date(), limit: 50 });

    expect(out).toEqual({ pushed: 2, failed: 0, scanned: 2 });
    expect(enqueueHandoff).toHaveBeenCalledTimes(2);
    expect(enqueueHandoff.mock.calls[0][0]).toBe('s1');
    expect(clearFlag).toHaveBeenCalledTimes(2);
  });

  it('does not clear the flag when the enqueue fails (cron retries next tick)', async () => {
    const intentRepo = { findHandoffDeferredOlderThan: vi.fn(async () => [{ saleRef: { value: 's1' } }]) } as never;
    const enqueueHandoff = vi.fn(async () => { throw new Error('queue down'); });
    const clearFlag = vi.fn(async () => {});

    const out = await runDeferredHandoffSweep({ intentRepo, enqueueHandoff, clearFlag, cutoff: new Date(), limit: 50 });

    expect(out).toEqual({ pushed: 0, failed: 1, scanned: 1 });
    expect(clearFlag).not.toHaveBeenCalled();
  });
});
