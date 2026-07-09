import { defineRoute } from '@/lib/api/define-route';
import { getRecallStats, type RecallStatsRange } from '@/lib/services/recall-stats.service';
import type { RecallStatsWire } from '@/contracts/settings';

const VALID_RANGES: readonly RecallStatsRange[] = ['7d', '30d', '90d', 'all'] as const;

function parseRange(raw: string | null): RecallStatsRange {
  if (raw && (VALID_RANGES as readonly string[]).includes(raw)) return raw as RecallStatsRange;
  return '30d';
}

export const GET = defineRoute('GET /api/settings/recall/stats', { feature: 'SETTINGS_RECALL' }, async ({ query }): Promise<RecallStatsWire> => {
  const range = parseRange(query.get('range'));
  return getRecallStats(range);
});
