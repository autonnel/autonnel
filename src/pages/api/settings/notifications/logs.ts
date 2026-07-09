// Returns an empty page to preserve the wire contract the panel consumes; deliveries are
// traced through the structured logger only.
import { defineRoute } from '@/lib/api/define-route';
import type { NotificationLogsWire } from '@/contracts/settings';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export const GET = defineRoute('GET /api/settings/notifications/logs', { feature: 'SETTINGS_NOTIFICATIONS' }, async ({ query }): Promise<NotificationLogsWire> => {
  const page = Math.max(1, parseInt(query.get('page') || '1', 10) || 1);
  const rawSize = parseInt(query.get('pageSize') || String(DEFAULT_PAGE_SIZE), 10);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number.isFinite(rawSize) ? rawSize : DEFAULT_PAGE_SIZE));

  return { items: [], total: 0, page, pageSize };
});
