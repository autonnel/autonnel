import { PLUGIN_CRON_TRIGGER } from '../lib/cron/catalog';
import { disposeRequestDb, runWithRequestDb } from '../lib/db';
import { createLogger } from '../lib/logger';
import { isCloudflareRuntime } from '../lib/runtime/env';

const log = createLogger('NodeScheduler');

export const NODE_TICK_MS = 5 * 60_000;

type Env = Record<string, string | undefined>;

// Same production rule as the session secret: anything but development/test, including unset
// (a plain `node dist/server/entry.mjs`). Off in dev and tests: a local .env often points at a
// real database, and a dev server running recall / postback sweeps against it would act on live orders.
export function isNodeSchedulerEnabled(env: Env): boolean {
  const flag = env.AUTONNEL_SCHEDULER?.trim().toLowerCase();
  if (flag === 'off' || flag === 'false' || flag === '0') return false;
  if (flag === 'on' || flag === 'true' || flag === '1') return true;
  return env.NODE_ENV !== 'development' && env.NODE_ENV !== 'test';
}

// Aligned to wall-clock 5-minute boundaries, like the Workers `*/5` trigger.
export function msUntilNextTick(now: number): number {
  return NODE_TICK_MS - (now % NODE_TICK_MS);
}

export interface NodeSchedulerDeps {
  runTick: () => Promise<void>;
  now: () => number;
  setTimer: (fn: () => void, ms: number) => { unref?: () => void };
}

// One process fires one tick per boundary, so unlike Workers there is never a concurrent second
// invocation. Multiple replicas each tick; their sweeps share locks and interval markers only
// through a shared cache (REDIS_URL), otherwise run the scheduler on one replica.
export function createNodeScheduler(deps: NodeSchedulerDeps) {
  let running = false;

  async function tick(): Promise<'ran' | 'skipped'> {
    if (running) {
      log.warn('scheduled tick skipped: previous tick still running');
      return 'skipped';
    }
    running = true;
    try {
      await deps.runTick();
      return 'ran';
    } catch (error) {
      log.error('scheduled tick failed', { error });
      return 'ran';
    } finally {
      running = false;
    }
  }

  // Timers fire a few ms early; deriving the next delay from `now` at that point would yield ~0 and
  // fire the same boundary twice. Advance from the boundary instead, and skip boundaries the
  // process slept through.
  function schedule(target: number): void {
    const timer = deps.setTimer(() => {
      const now = deps.now();
      schedule(target + NODE_TICK_MS > now ? target + NODE_TICK_MS : now + msUntilNextTick(now));
      void tick();
    }, Math.max(0, target - deps.now()));
    timer.unref?.();
  }

  return {
    start: () => {
      const now = deps.now();
      schedule(now + msUntilNextTick(now));
    },
    tick,
  };
}

async function runTickInProcess(): Promise<void> {
  const { runScheduled } = await import('./scheduled-tick');
  await runWithRequestDb(async () => {
    try {
      await runScheduled(process.env as Record<string, unknown>, PLUGIN_CRON_TRIGGER);
    } finally {
      await disposeRequestDb();
    }
  });
}

const STARTED = Symbol.for('autonnel.node.scheduler.started');

// Called from the middleware on every request; starts the scheduler once per process. Starting on
// the first request (not at import) keeps it out of `astro build` and of anything that merely
// imports the middleware.
export function ensureNodeScheduler(): void {
  const g = globalThis as { [STARTED]?: boolean };
  if (g[STARTED]) return;
  g[STARTED] = true;
  if (isCloudflareRuntime() || typeof process === 'undefined' || !isNodeSchedulerEnabled(process.env)) return;
  createNodeScheduler({ runTick: runTickInProcess, now: Date.now, setTimer: (fn, ms) => setTimeout(fn, ms) }).start();
  log.info('in-process scheduler started', { tickMs: NODE_TICK_MS });
}
