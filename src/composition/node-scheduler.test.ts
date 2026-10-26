import { describe, it, expect, vi } from 'vitest';
import { NODE_TICK_MS, createNodeScheduler, isNodeSchedulerEnabled, msUntilNextTick } from './node-scheduler';

const BOUNDARY = Date.UTC(2026, 8, 29, 3, 25, 0);

function harness(start: number, runTick = vi.fn(async () => {})) {
  let now = start;
  const timers: Array<{ fn: () => void; ms: number }> = [];
  const scheduler = createNodeScheduler({
    runTick,
    now: () => now,
    setTimer: (fn, ms) => {
      timers.push({ fn, ms });
      return { unref: () => {} };
    },
  });
  return {
    scheduler,
    runTick,
    timers,
    fireAt(time: number) {
      now = time;
      timers[timers.length - 1].fn();
    },
  };
}

describe('isNodeSchedulerEnabled', () => {
  it.each([
    [{ NODE_ENV: 'production' }, true],
    [{ NODE_ENV: 'development' }, false],
    [{ NODE_ENV: 'test' }, false],
    [{}, true],
    [{ NODE_ENV: 'staging' }, true],
    [{ NODE_ENV: 'production', AUTONNEL_SCHEDULER: 'off' }, false],
    [{ NODE_ENV: 'production', AUTONNEL_SCHEDULER: 'false' }, false],
    [{ NODE_ENV: 'development', AUTONNEL_SCHEDULER: 'on' }, true],
    [{ NODE_ENV: 'development', AUTONNEL_SCHEDULER: ' ON ' }, true],
  ])('%j -> %s', (env, expected) => {
    expect(isNodeSchedulerEnabled(env)).toBe(expected);
  });
});

describe('msUntilNextTick', () => {
  it('waits for the next wall-clock 5-minute boundary', () => {
    expect(msUntilNextTick(BOUNDARY - 1_000)).toBe(1_000);
    expect(msUntilNextTick(BOUNDARY)).toBe(NODE_TICK_MS);
    expect(msUntilNextTick(BOUNDARY + 1)).toBe(NODE_TICK_MS - 1);
  });
});

describe('createNodeScheduler', () => {
  it('first fires at the next boundary', () => {
    const h = harness(BOUNDARY - 90_000);
    h.scheduler.start();
    expect(h.timers[0].ms).toBe(90_000);
  });

  it('fires each boundary exactly once even when the timer fires a few ms early', async () => {
    const h = harness(BOUNDARY - 60_000);
    h.scheduler.start();
    h.fireAt(BOUNDARY - 3);
    await Promise.resolve();

    expect(h.runTick).toHaveBeenCalledTimes(1);
    // The next timer targets the following boundary, not the 3 ms left until this one.
    expect(h.timers[1].ms).toBe(NODE_TICK_MS + 3);
  });

  it('skips boundaries the process slept through instead of firing a backlog', () => {
    const h = harness(BOUNDARY - 60_000);
    h.scheduler.start();
    h.fireAt(BOUNDARY + 3 * NODE_TICK_MS + 1_000);
    expect(h.timers[1].ms).toBe(NODE_TICK_MS - 1_000);
  });

  it('skips a tick while the previous one is still running, and runs again after it ends', async () => {
    let release!: () => void;
    const runTick = vi.fn(() => new Promise<void>((r) => (release = r)));
    const h = harness(BOUNDARY, runTick);

    const first = h.scheduler.tick();
    expect(await h.scheduler.tick()).toBe('skipped');
    release();
    expect(await first).toBe('ran');
    const third = h.scheduler.tick();
    release();
    expect(await third).toBe('ran');
    expect(runTick).toHaveBeenCalledTimes(2);
  });

  it('keeps scheduling after a tick throws', async () => {
    const h = harness(BOUNDARY - 1_000, vi.fn(async () => {
      throw new Error('db down');
    }));
    h.scheduler.start();
    h.fireAt(BOUNDARY);
    expect(h.timers).toHaveLength(2);
    await new Promise((r) => setTimeout(r, 0));
    expect(await h.scheduler.tick()).toBe('ran');
    expect(h.runTick).toHaveBeenCalledTimes(2);
  });
});
