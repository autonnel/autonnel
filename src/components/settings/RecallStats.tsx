import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../primitives';
import Stat from '../primitives/ds/Stat';
import { apiCall } from '@/lib/api/client';

export type RecallStatsRange = '7d' | '30d' | '90d' | 'all';

export interface RecallStatsData {
  range: RecallStatsRange;
  emailsSent: number;
  ordersRecovered: number;
  recoveryRate: number | null;
}

interface Props {
  initialStats: RecallStatsData;
}

const RANGES: { value: RecallStatsRange; label: string }[] = [
  { value: '7d',  label: '7d'  },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: 'all', label: 'All' },
];

const numberFmt = new Intl.NumberFormat('en-US');

function formatRate(rate: number | null): string {
  if (rate === null) return '—';
  return `${(rate * 100).toFixed(2)}%`;
}

export default function RecallStats({ initialStats }: Props) {
  const [stats, setStats] = useState<RecallStatsData>(initialStats);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onRangeChange = async (next: RecallStatsRange) => {
    if (next === stats.range || loading) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiCall('GET /api/settings/recall/stats', null, { query: { range: next } });
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Recall Performance</CardTitle>
        <div role="group" aria-label="Time range" className="inline-flex bg-ds-surface2 border border-ds-line rounded-[8px] p-0.5">
          {RANGES.map((opt) => {
            const active = opt.value === stats.range;
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={active}
                disabled={loading}
                onClick={() => onRangeChange(opt.value)}
                className={`px-3 h-7 text-[12.5px] rounded-[6px] transition-colors ${
                  active
                    ? 'bg-ds-card text-ds-ink shadow-[0_1px_2px_rgba(17,24,39,0.06)]'
                    : 'text-ds-muted hover:text-ds-ink'
                } disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </CardHeader>
      <CardContent>
        {error && <div className="text-sm text-destructive mb-3">{error}</div>}
        <div className={`grid grid-cols-3 gap-6 ${loading ? 'opacity-60' : ''}`}>
          <Stat label="Emails Sent" value={numberFmt.format(stats.emailsSent)} />
          <Stat label="Orders Recovered" value={numberFmt.format(stats.ordersRecovered)} />
          <Stat label="Recovery Rate" value={formatRate(stats.recoveryRate)} />
        </div>
      </CardContent>
    </Card>
  );
}
