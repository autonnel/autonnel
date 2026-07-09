import { defineRoute, ApiError } from '@/lib/api/define-route';
import { getBasePrisma } from '@/lib/db';
import { withTenantWhere } from '@/lib/repositories/tenant-helpers';
import { createLogger } from '@/lib/logger';
import {
  getRecallKvConfig,
  upsertRecallKvConfig,
  DEFAULT_RECALL_INTERVALS,
} from '@/lib/config/recall';
import type { RecallConfigWire, RecallInterval, RecallPutResult } from '@/contracts/settings';

const logger = createLogger('RecallSettingsAPI');

function validateIntervals(intervals: unknown): intervals is RecallInterval[] {
  if (!Array.isArray(intervals)) return false;
  return intervals.every(
    (i) =>
      typeof i === 'object' &&
      i !== null &&
      typeof i.hours === 'number' &&
      Number.isInteger(i.hours) &&
      i.hours >= 1 &&
      i.hours <= 8760 &&
      typeof i.emailTemplateType === 'string' &&
      i.emailTemplateType.length > 0 &&
      (i.couponId === undefined || i.couponId === null || typeof i.couponId === 'string'),
  );
}

export const GET = defineRoute('GET /api/settings/recall', { feature: 'SETTINGS_RECALL' }, async (): Promise<RecallConfigWire> => {
  const config = await getRecallKvConfig();
  if (!config) {
    return { id: null, isEnabled: false, intervals: DEFAULT_RECALL_INTERVALS, isGlobalDefault: true };
  }
  return { id: config.id, isEnabled: config.isEnabled, intervals: config.intervals, isGlobalDefault: false };
});

export const PUT = defineRoute('PUT /api/settings/recall', { feature: 'SETTINGS_RECALL' }, async ({ input }): Promise<RecallPutResult> => {
  const prisma = getBasePrisma();
  if (!input) throw new ApiError(400, 'Invalid request body');
  const { isEnabled, intervals } = input;
  if (typeof isEnabled !== 'boolean') throw new ApiError(400, 'isEnabled must be a boolean');
  if (!validateIntervals(intervals)) {
    throw new ApiError(400, 'intervals must be an array of { hours, emailTemplateType, couponId? }');
  }

  const couponIds = intervals
    .map((i) => i.couponId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
  if (couponIds.length > 0) {
    const uniqueIds = [...new Set(couponIds)];
    const found = await prisma.coupon.findMany({
      where: withTenantWhere({ id: { in: uniqueIds } }),
      select: { id: true },
    });
    const foundIds = new Set(found.map((c) => c.id));
    const missing = uniqueIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) throw new ApiError(400, `Coupon(s) not found: ${missing.join(', ')}`);
  }

  const config = await upsertRecallKvConfig({ isEnabled, intervals });
  logger.info('Updated recall config', { id: config.id });
  return { id: config.id, isEnabled: config.isEnabled, intervals: config.intervals };
});
