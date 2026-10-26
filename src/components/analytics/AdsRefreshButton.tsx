import * as React from 'react';
import { Button } from '../primitives/ds';
import {
  pollSyncStatus,
  anyTruncated,
  rateLimitMessage,
  type SyncStatusResponse,
  type SyncRateLimitError,
} from '@/lib/dashboard/ads-refresh-client';

type Phase = 'idle' | 'starting' | 'polling' | 'rate-limited';

async function fetchStatus(): Promise<SyncStatusResponse> {
  const res = await fetch('/api/ads/sync/status');
  if (!res.ok) throw new Error(`status check failed (${res.status})`);
  return (await res.json()) as SyncStatusResponse;
}

// Triggers POST /api/ads/sync and polls GET /api/ads/sync/status per the contract in
// task-9b-report.md. Deliberately shows no ticking countdown for either 429 reason -- see
// rateLimitMessage's comment: retryAfterSeconds is not a reliable remaining-time value on every
// cache backend, so a precise countdown would promise something the backend cannot guarantee.
export default function AdsRefreshButton() {
  const [phase, setPhase] = React.useState<Phase>('idle');
  const [message, setMessage] = React.useState<string | null>(null);
  const [truncated, setTruncated] = React.useState(false);
  // number, not NodeJS.Timeout -- @types/node's global setTimeout override otherwise wins here.
  const timerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    fetchStatus()
      .then((status) => setTruncated(anyTruncated(status.runs)))
      .catch(() => {
        // Best-effort background check on mount; a failure here must not block the button.
      });
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const settleAfterSync = async () => {
    const status = await pollSyncStatus({ fetchStatus });
    setTruncated(anyTruncated(status.runs));
    // The page's numbers come from SSR-loaded data; a full reload is the only way this island can
    // make the rest of the page reflect the sync it just triggered.
    window.location.reload();
  };

  const handleRateLimit = (err: SyncRateLimitError) => {
    setPhase('rate-limited');
    setMessage(rateLimitMessage(err));
    if (err.reason === 'busy') {
      // A sync IS running somewhere (most likely the hourly cron sweep); it will settle on its
      // own, so wait for it rather than just sitting disabled.
      settleAfterSync()
        .catch(() => undefined)
        .finally(() => {
          setPhase('idle');
          setMessage(null);
        });
      return;
    }
    const waitMs = Math.max(1, err.retryAfterSeconds) * 1000;
    timerRef.current = window.setTimeout(() => {
      setPhase('idle');
      setMessage(null);
    }, waitMs) as unknown as number;
  };

  const handleClick = async () => {
    setPhase('starting');
    setMessage(null);
    try {
      const res = await fetch('/api/ads/sync', { method: 'POST' });
      if (res.status === 429) {
        const err = (await res.json()) as SyncRateLimitError;
        handleRateLimit(err);
        return;
      }
      if (!res.ok) {
        setPhase('idle');
        setMessage('Could not start a refresh. Try again.');
        return;
      }
      setPhase('polling');
      await settleAfterSync();
    } catch {
      setPhase('idle');
      setMessage('Could not start a refresh. Try again.');
    }
  };

  const disabled = phase === 'starting' || phase === 'polling' || phase === 'rate-limited';
  const label = phase === 'polling' ? 'Refreshing' : phase === 'starting' ? 'Starting' : 'Refresh now';

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="default" size="md" onClick={handleClick} disabled={disabled}>
        {label}
      </Button>
      {message && <div className="text-[11.5px] text-ds-muted max-w-[220px] text-right">{message}</div>}
      {truncated && (
        <div className="text-[11.5px] text-ds-warn max-w-[240px] text-right">
          Last refresh only partially fetched this account's spend.
        </div>
      )}
    </div>
  );
}
