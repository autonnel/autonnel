import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { CRON_JOBS } from './catalog';

// Registering a job in CRON_JOBS adds its expression to the wrangler triggers but does NOT make the
// scheduled handler run it — `runScheduled` has to call runSweep(name) explicitly. `ads.postback`
// was registered for months while only the HTTP endpoint drove it, so on Cloudflare no conversion
// postback was ever retried. This test fails if that drift comes back.
const WORKER = readFileSync('src/cf-worker.ts', 'utf8');

function invokedSweepNames(): Set<string> {
  return new Set([...WORKER.matchAll(/runSweep\("([^"]+)"/g)].map((m) => m[1]));
}

// Work performed under a different sweep name. Keep this list tiny and justified.
const COVERED_ELSEWHERE: Record<string, string> = {
  // runMaintenanceSweeps() does the jobs cleanup AND the notification-logs cleanup in one pass.
  'maintenance.notification-logs': 'maintenance.jobs',
};

describe('cron registry vs scheduled handler', () => {
  it('every registered job is invoked by the scheduled handler (or explicitly covered elsewhere)', () => {
    const invoked = invokedSweepNames();
    const orphans = CRON_JOBS.map((j) => j.name)
      .filter((name) => !invoked.has(name))
      .filter((name) => !(name in COVERED_ELSEWHERE));
    expect(orphans).toEqual([]);
  });

  it('the covering sweep for each exception is itself invoked', () => {
    const invoked = invokedSweepNames();
    for (const [orphan, cover] of Object.entries(COVERED_ELSEWHERE)) {
      expect(invoked.has(cover), `${orphan} claims coverage by ${cover}, which is not invoked`).toBe(true);
    }
  });

  it('ads.postback runs before jobs.poll so retries dispatch in the same tick', () => {
    const retryAt = WORKER.indexOf('runSweep("ads.postback"');
    const pollAt = WORKER.indexOf('runSweep("jobs.poll"');
    expect(retryAt).toBeGreaterThan(-1);
    expect(pollAt).toBeGreaterThan(-1);
    expect(retryAt).toBeLessThan(pollAt);
  });

  it('every registered job has a positive interval and lock TTL', () => {
    for (const j of CRON_JOBS) {
      expect(j.intervalMs, j.name).toBeGreaterThan(0);
      expect(j.lockTtlSeconds, j.name).toBeGreaterThan(0);
    }
  });
});
