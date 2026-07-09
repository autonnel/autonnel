import { useEffect, useRef, useState } from 'react';
import { apiCall, ApiCallError } from '@/lib/api/client';
import type { ApiKey, ApiOutput } from '@/contracts';

export interface DiagnosticsFilters {
  funnelId: string;
  startDate: string;
  endDate: string;
  timezone: string;
  /** Incremented on Refresh / committed filter change to trigger a re-fetch. */
  revision: number;
}

interface QueryState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

// Each panel calls this with its own endpoint key; fetches run independently and in parallel because
// every panel mounts its own hook instance. The serialized `key` (filters + revision + extra params)
// guards against duplicate fires and lets a stale in-flight response be discarded.
export function useDiagnosticsQuery<K extends ApiKey>(
  endpoint: K,
  filters: DiagnosticsFilters,
  extraQuery?: Record<string, string | number | undefined>,
): QueryState<ApiOutput<K>> {
  const [state, setState] = useState<QueryState<ApiOutput<K>>>({
    data: null,
    loading: true,
    error: null,
  });

  const extraKey = extraQuery ? JSON.stringify(extraQuery) : '';
  const requestKey = `${endpoint}|${filters.funnelId}|${filters.startDate}|${filters.endDate}|${filters.timezone}|${filters.revision}|${extraKey}`;
  const lastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (lastKeyRef.current === requestKey) return;
    lastKeyRef.current = requestKey;

    let active = true;
    setState({ data: null, loading: true, error: null });

    apiCall(endpoint, null as never, {
      query: {
        funnelId: filters.funnelId,
        startDate: filters.startDate,
        endDate: filters.endDate,
        timezone: filters.timezone,
        ...extraQuery,
      },
    })
      .then((data) => {
        if (active) setState({ data, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!active) return;
        const message =
          err instanceof ApiCallError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Request failed';
        setState({ data: null, loading: false, error: message });
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  return state;
}
