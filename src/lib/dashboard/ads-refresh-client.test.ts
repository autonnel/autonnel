import { describe, it, expect, vi } from 'vitest';
import { anyTruncated, isSettled, rateLimitMessage, pollSyncStatus, type SyncRunView, type SyncStatusResponse } from './ads-refresh-client';

function run(overrides: Partial<SyncRunView> = {}): SyncRunView {
  return {
    connectionId: 'conn-1',
    platform: 'META',
    status: 'OK',
    startedAt: '2026-01-01T00:00:00.000Z',
    finishedAt: '2026-01-01T00:01:00.000Z',
    adsFetched: 10,
    daysUpserted: 7,
    truncated: false,
    error: null,
    ...overrides,
  };
}

describe('anyTruncated', () => {
  it('is false when no run was truncated', () => {
    expect(anyTruncated([run(), run()])).toBe(false);
  });

  it('is true when at least one run was truncated, even if others were not', () => {
    expect(anyTruncated([run(), run({ truncated: true })])).toBe(true);
  });

  it('is false for an empty run list', () => {
    expect(anyTruncated([])).toBe(false);
  });
});

describe('isSettled', () => {
  it('is settled when running is false', () => {
    expect(isSettled({ running: false, lastRunAt: null, runs: [] })).toBe(true);
  });

  it('is not settled while running is true', () => {
    expect(isSettled({ running: true, lastRunAt: null, runs: [] })).toBe(false);
  });
});

describe('rateLimitMessage', () => {
  // Non-negotiable per task-9b-report.md's UI contract correction: retryAfterSeconds is not a
  // reliable countdown on every cache backend, so the copy must never quote it as one.
  it('never includes a number for either reason', () => {
    const cooldown = rateLimitMessage({ retryAfterSeconds: 42, reason: 'cooldown' });
    const busy = rateLimitMessage({ retryAfterSeconds: 30, reason: 'busy' });
    expect(cooldown).not.toMatch(/\d/);
    expect(busy).not.toMatch(/\d/);
  });

  it('distinguishes cooldown from busy in the message text', () => {
    const cooldown = rateLimitMessage({ retryAfterSeconds: 42, reason: 'cooldown' });
    const busy = rateLimitMessage({ retryAfterSeconds: 30, reason: 'busy' });
    expect(cooldown).not.toBe(busy);
    expect(cooldown.toLowerCase()).toContain('rate limited');
    expect(busy.toLowerCase()).toContain('already running');
  });
});

describe('pollSyncStatus', () => {
  it('waits the initial delay before the first status check', async () => {
    const sleepCalls: number[] = [];
    const sleep = async (ms: number) => {
      sleepCalls.push(ms);
    };
    const fetchStatus = vi.fn(async (): Promise<SyncStatusResponse> => ({ running: false, lastRunAt: null, runs: [] }));

    await pollSyncStatus({ fetchStatus, sleep, initialDelayMs: 1500 });

    expect(sleepCalls[0]).toBe(1500);
    expect(fetchStatus).toHaveBeenCalledTimes(1);
  });

  it('keeps polling at the configured interval until running becomes false', async () => {
    const sleepCalls: number[] = [];
    const sleep = async (ms: number) => {
      sleepCalls.push(ms);
    };
    let call = 0;
    const fetchStatus = vi.fn(async (): Promise<SyncStatusResponse> => {
      call += 1;
      return { running: call < 3, lastRunAt: null, runs: [] };
    });

    const result = await pollSyncStatus({ fetchStatus, sleep, initialDelayMs: 100, intervalMs: 2000 });

    expect(result.running).toBe(false);
    expect(fetchStatus).toHaveBeenCalledTimes(3);
    // One initial delay, then one interval sleep per re-poll (2 re-polls after the first check).
    expect(sleepCalls).toEqual([100, 2000, 2000]);
  });

  it('gives up after the timeout and returns the last status even if still running', async () => {
    const sleep = async () => {};
    let clock = 0;
    const now = () => clock;
    const fetchStatus = vi.fn(async (): Promise<SyncStatusResponse> => {
      clock += 60_000;
      return { running: true, lastRunAt: null, runs: [] };
    });

    const result = await pollSyncStatus({ fetchStatus, sleep, now, timeoutMs: 150_000, initialDelayMs: 0 });

    expect(result.running).toBe(true);
    // First fetch always happens; the loop then re-checks the clock and stops once elapsed >= timeout.
    expect(fetchStatus).toHaveBeenCalledTimes(3);
  });

  it('surfaces truncated runs in the settled result so the caller can flag partial data', async () => {
    const sleep = async () => {};
    const fetchStatus = vi.fn(
      async (): Promise<SyncStatusResponse> => ({
        running: false,
        lastRunAt: '2026-01-01T00:00:00.000Z',
        runs: [run({ truncated: true })],
      }),
    );

    const result = await pollSyncStatus({ fetchStatus, sleep, initialDelayMs: 0 });
    expect(anyTruncated(result.runs)).toBe(true);
  });
});
