import { describe, it, expect, vi } from 'vitest';
import { runDeferredCaptureSweep } from '../capture-deferred-cron';

describe('runDeferredCaptureSweep', () => {
  it('captures every abandoned deferred order and counts results', async () => {
    const intentRepo = {
      findDeferredOlderThan: vi.fn(async () => [
        { id: 'i1', saleRef: { value: 's1' } },
        { id: 'i2', saleRef: { value: 's2' } },
      ]),
    } as never;
    const confirm = {
      captureNow: vi.fn()
        .mockResolvedValueOnce({ status: 'succeeded' })
        .mockResolvedValueOnce({ status: 'failed' }),
    } as never;

    const out = await runDeferredCaptureSweep({ intentRepo, confirm, cutoff: new Date(), limit: 50 });

    expect(out).toEqual({ captured: 1, failed: 1, scanned: 2 });
    expect((confirm as { captureNow: ReturnType<typeof vi.fn> }).captureNow).toHaveBeenCalledTimes(2);
    const firstCall = (confirm as { captureNow: ReturnType<typeof vi.fn> }).captureNow.mock.calls[0][0];
    expect(firstCall.saleRef).toBe('s1');
    expect(firstCall.idempotencyKey).toBe('safetynet:i1');
  });

  it('no-ops cleanly when nothing is abandoned', async () => {
    const intentRepo = { findDeferredOlderThan: vi.fn(async () => []) } as never;
    const confirm = { captureNow: vi.fn() } as never;
    const out = await runDeferredCaptureSweep({ intentRepo, confirm, cutoff: new Date(), limit: 50 });
    expect(out).toEqual({ captured: 0, failed: 0, scanned: 0 });
    expect((confirm as { captureNow: ReturnType<typeof vi.fn> }).captureNow).not.toHaveBeenCalled();
  });
});
