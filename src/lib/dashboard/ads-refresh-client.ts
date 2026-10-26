// Client-side logic for the "Refresh now" button on /analytics/ads. Pure/testable functions plus a
// tiny poller, separated from the React component so the polling contract (and its non-negotiable
// "no ticking countdown" rule -- see task-9b-report.md's UI contract correction) can be unit-tested
// without rendering anything.

export interface SyncRunView {
  connectionId: string;
  platform: string;
  status: 'RUNNING' | 'OK' | 'FAILED';
  startedAt: string;
  finishedAt: string | null;
  adsFetched: number;
  daysUpserted: number;
  truncated: boolean;
  error: string | null;
}

export interface SyncStatusResponse {
  running: boolean;
  lastRunAt: string | null;
  runs: SyncRunView[];
}

export type SyncRateLimitReason = 'cooldown' | 'busy';

export interface SyncRateLimitError {
  retryAfterSeconds: number;
  reason: SyncRateLimitReason;
}

// True when ANY surfaced run was only partially fetched -- that account's spend is incomplete, so
// this must never be swallowed into a plain "done" state.
export function anyTruncated(runs: SyncRunView[]): boolean {
  return runs.some((r) => r.truncated);
}

export function isSettled(status: SyncStatusResponse): boolean {
  return !status.running;
}

// Neither reason's retryAfterSeconds is a reliable countdown (see task-9b-report.md: on a
// Redis-backed deployment the cooldown number is the flat configured window, not true remaining
// time). Copy must say "rate limited" / "already running", never render the number as a ticking
// clock.
export function rateLimitMessage(err: SyncRateLimitError): string {
  return err.reason === 'cooldown'
    ? 'Refresh is rate limited right now. Try again in a bit.'
    : 'A sync is already running. It will finish shortly.';
}

export interface PollOptions {
  fetchStatus: () => Promise<SyncStatusResponse>;
  intervalMs?: number;
  // The background sync is fire-and-forget: on the very first poll its RUNNING rows may not exist
  // yet, so polling immediately risks reading last run's stale `running: false` and reporting
  // success before anything started. A short initial delay avoids that race.
  initialDelayMs?: number;
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
  // Injectable clock so a timeout-exit path is deterministically testable without a fake sleep
  // that has to also fast-forward wall time.
  now?: () => number;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export async function pollSyncStatus(opts: PollOptions): Promise<SyncStatusResponse> {
  const interval = opts.intervalMs ?? 2500;
  const initialDelay = opts.initialDelayMs ?? 1500;
  const timeout = opts.timeoutMs ?? 120_000;
  const sleep = opts.sleep ?? defaultSleep;
  const now = opts.now ?? Date.now;

  await sleep(initialDelay);
  const start = now();
  let status = await opts.fetchStatus();
  while (status.running && now() - start < timeout) {
    await sleep(interval);
    status = await opts.fetchStatus();
  }
  return status;
}
