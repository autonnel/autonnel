import type { PrismaClient } from '@prisma/client';
import { getTenantPrisma } from '@/modules/platform/infra/prisma-tenant-extension';
import { getCurrentTenantId } from '@/lib/tenant/context';
import { createLogger } from '@/lib/logger';

const DAY_MS = 24 * 60 * 60 * 1000;

// Minimal client shape so a standalone (non-tenant-extended) client can be injected by the SSE stream.
type ActivityDb = Pick<PrismaClient, 'order' | 'transaction'>;

const logger = createLogger('SystemActivity');

function safe<T>(source: string, p: Promise<T>, fallback: T): Promise<T> {
  return p.catch((error) => {
    logger.error('Activity source query failed', { source, error });
    return fallback;
  });
}

export function truncate(value: string | null | undefined, max = 40): string {
  const s = (value ?? '').toString();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export interface ActivityEntry {
  ts: Date;
  kind: 'order' | 'recall' | 'refund' | 'email' | 'fulfillment' | 'notification';
  text: string;
  tone: 'ok' | 'bad' | 'muted' | 'highlight';
  payload: string;
}

export interface LoadSystemActivityOptions {
  windowMs?: number;
}

export async function loadSystemActivity(
  now: Date,
  limit = 50,
  options: LoadSystemActivityOptions = {},
): Promise<ActivityEntry[]> {
  return querySystemActivity(
    getTenantPrisma() as unknown as ActivityDb,
    getCurrentTenantId(),
    now,
    limit,
    options.windowMs ?? DAY_MS,
  );
}

// Tenant id is passed explicitly (not read from ALS) so the SSE stream can call this from outside the
// request scope with a standalone client; every query is filtered by tenantId to keep tenants isolated.
export async function querySystemActivity(
  db: ActivityDb,
  tenantId: string,
  now: Date,
  limit: number,
  windowMs: number,
): Promise<ActivityEntry[]> {
  const windowStart = new Date(now.getTime() - windowMs);
  const take = Math.max(limit, 8);

  const [recentOrdersCreated, recentRefunds, recentFailedCharges, recentFulfillments] = await Promise.all([
    safe(
      'orders_created',
      db.order.findMany({
        where: { tenantId, createdAt: { gte: windowStart } },
        orderBy: { createdAt: 'desc' },
        take,
        select: { createdAt: true, orderNumber: true, status: true, capturedTotal: true, currencyCode: true },
      }) as Promise<Array<{ createdAt: Date; orderNumber: string; status: string; capturedTotal: number; currencyCode: string }>>,
      [],
    ),
    safe(
      'refunds',
      db.transaction.findMany({
        where: { tenantId, type: 'REFUND', status: 'COMPLETED', createdAt: { gte: windowStart } },
        orderBy: { createdAt: 'desc' },
        take,
        select: { createdAt: true, amountMinor: true, currencyCode: true, provider: true },
      }) as Promise<Array<{ createdAt: Date; amountMinor: number; currencyCode: string; provider: string }>>,
      [],
    ),
    safe(
      'charges_failed',
      db.transaction.findMany({
        where: { tenantId, type: 'CHARGE', status: 'FAILED', createdAt: { gte: windowStart } },
        orderBy: { createdAt: 'desc' },
        take,
        select: { createdAt: true, provider: true, amountMinor: true, currencyCode: true },
      }) as Promise<Array<{ createdAt: Date; provider: string; amountMinor: number; currencyCode: string }>>,
      [],
    ),
    safe(
      'fulfillments',
      db.order.findMany({
        where: { tenantId, trackingNumber: { not: null }, updatedAt: { gte: windowStart } },
        orderBy: { updatedAt: 'desc' },
        take,
        select: { updatedAt: true, orderNumber: true, trackingCarrier: true },
      }) as Promise<Array<{ updatedAt: Date; orderNumber: string; trackingCarrier: string | null }>>,
      [],
    ),
  ]);

  const activity: ActivityEntry[] = [];
  const money = (minor: number, currency: string) => `${currency} ${(minor / 100).toFixed(2)}`;

  for (const o of recentOrdersCreated) {
    const paid = o.status === 'PAID';
    activity.push({
      ts: o.createdAt,
      kind: 'order',
      text: `order ${paid ? 'paid' : 'created'} ${o.orderNumber}`,
      tone: paid ? 'highlight' : 'muted',
      payload: paid ? money(o.capturedTotal, o.currencyCode) : 'pending',
    });
  }

  for (const r of recentRefunds) {
    activity.push({
      ts: r.createdAt,
      kind: 'refund',
      text: `refund ${r.provider}`,
      tone: 'highlight',
      payload: money(r.amountMinor, r.currencyCode),
    });
  }

  for (const c of recentFailedCharges) {
    activity.push({
      ts: c.createdAt,
      kind: 'order',
      text: `payment declined ${c.provider}`,
      tone: 'bad',
      payload: money(c.amountMinor, c.currencyCode),
    });
  }

  for (const f of recentFulfillments) {
    activity.push({
      ts: f.updatedAt,
      kind: 'fulfillment',
      text: `shipped ${f.orderNumber} ${f.trackingCarrier ?? ''}`.trimEnd(),
      tone: 'ok',
      payload: f.trackingCarrier ?? 'in_transit',
    });
  }

  activity.sort((a, b) => b.ts.getTime() - a.ts.getTime());
  return activity.slice(0, limit);
}
