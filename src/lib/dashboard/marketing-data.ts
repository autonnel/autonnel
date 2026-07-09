import { makeAcquisitionAds } from '@/composition/make-acquisition-ads';
import { createAdsDepsForRequest } from '@/composition/make-ads-deps';
import { getTenantPrisma } from '@/modules/platform/infra/prisma-tenant-extension';
import {
  aggregateMarketingKpi,
  type MarketingKpi,
  type BindingFunnelGroup,
} from './marketing-helpers';

async function listConnections() {
  try {
    const deps = await createAdsDepsForRequest();
    const ads = await makeAcquisitionAds(deps);
    return await ads.connectionRepo.list();
  } catch {
    return [];
  }
}

export interface AdPlatformCard {
  id: string;
  name: string;
  platform: string;
  isActive: boolean;
  credentials: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  bindingCount: number;
  postbackCount: number;
  lastPostbackStatus: string | null;
  lastPostbackAt: Date | null;
}

export async function loadMarketingKpi(now: Date = new Date()): Promise<MarketingKpi> {
  const connections = await listConnections();
  const platforms = connections.map((c) => ({ id: c.id, isActive: c.status === 'ACTIVE' }));
  const kpi = aggregateMarketingKpi({ platforms, postbacks: [], now });
  return { ...kpi, pendingPostbacks: 0 };
}

export async function loadAdPlatformCards(): Promise<AdPlatformCard[]> {
  const connections = await listConnections();
  return connections.map((c) => ({
    id: c.id,
    name: c.externalAccountId,
    platform: c.platform,
    isActive: c.status === 'ACTIVE',
    credentials: {},
    createdAt: new Date(0),
    updatedAt: new Date(0),
    bindingCount: 0,
    postbackCount: 0,
    lastPostbackStatus: null,
    lastPostbackAt: null,
  }));
}

export interface PostbackRow {
  id: string;
  status: string;
  platformId: string;
  platformName: string;
  platformType: string;
  orderId: string | null;
  orderNumber: string | null;
  eventName: string;
  internalEvent: string | null;
  attempts: number;
  errorMessage: string | null;
  createdAt: Date;
}

export interface PostbackListResult {
  rows: PostbackRow[];
  total: number;
}

interface PostbackEventSnapshot {
  eventName?: string;
  eventId?: string;
  orderId?: string;
  orderNumber?: string;
  internalEvent?: string;
}

interface PostbackAttempt {
  attempt?: number;
  at?: number;
  error?: string;
  retryable?: boolean;
}

// eventId encodes `${trigger}:${sessionId}:${saleId}`; fall back to it when the
// snapshot lacks explicit order/internal-event fields.
function parseEventId(eventId: string | undefined): { trigger: string | null; saleId: string | null } {
  if (!eventId) return { trigger: null, saleId: null };
  const parts = eventId.split(':');
  if (parts.length < 3) return { trigger: parts[0] ?? null, saleId: null };
  const saleId = parts[parts.length - 1];
  return { trigger: parts[0] || null, saleId: saleId && saleId !== '0' ? saleId : null };
}

function lastAttemptError(attempts: unknown): string | null {
  if (!Array.isArray(attempts)) return null;
  for (let i = attempts.length - 1; i >= 0; i--) {
    const a = attempts[i] as PostbackAttempt;
    if (a && typeof a.error === 'string' && a.error) return a.error;
  }
  return null;
}

export async function loadPostbacks(opts: {
  page?: number;
  perPage?: number;
  status?: string;
}): Promise<PostbackListResult> {
  try {
    const db = getTenantPrisma();
    const page = Math.max(1, opts.page ?? 1);
    const perPage = Math.max(1, opts.perPage ?? 50);
    const where = opts.status ? { status: opts.status } : {};

    const [records, total] = await Promise.all([
      db.postback.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      db.postback.count({ where }),
    ]);

    const destinationIds = Array.from(new Set(records.map((r) => r.destinationId)));
    const destinations = destinationIds.length
      ? await db.adConversionDestination.findMany({ where: { id: { in: destinationIds } } })
      : [];
    const destToConnId = new Map<string, string>(
      destinations.map((d) => [d.id as string, d.connectionId as string]),
    );

    const connectionIds = Array.from(new Set(destinations.map((d) => d.connectionId as string)));
    const connections = connectionIds.length
      ? await db.adAccountConnection.findMany({ where: { id: { in: connectionIds } } })
      : [];
    const connById = new Map<string, { id: string; externalAccountId: string; platform: string }>(
      connections.map((c) => [
        c.id as string,
        { id: c.id as string, externalAccountId: c.externalAccountId as string, platform: c.platform as string },
      ]),
    );

    const rows: PostbackRow[] = records.map((r) => {
      const connId = destToConnId.get(r.destinationId);
      const conn = connId ? connById.get(connId) : undefined;
      const snapshot = (r.eventSnapshot ?? {}) as PostbackEventSnapshot;
      const parsed = parseEventId(snapshot.eventId ?? r.eventId);
      return {
        id: r.id,
        status: r.status,
        platformId: conn?.id ?? '',
        platformName: conn?.externalAccountId ?? '—',
        platformType: conn?.platform ?? '',
        orderId: snapshot.orderId ?? parsed.saleId,
        orderNumber: snapshot.orderNumber ?? null,
        eventName: snapshot.eventName ?? '',
        internalEvent: snapshot.internalEvent ?? parsed.trigger,
        attempts: r.attemptCount,
        errorMessage: lastAttemptError(r.attempts),
        createdAt: new Date(r.createdAt),
      };
    });

    return { rows, total };
  } catch {
    return { rows: [], total: 0 };
  }
}

export async function loadBindingGroups(): Promise<BindingFunnelGroup[]> {
  return [];
}

export interface AdPlatformDetailData {
  id: string;
  name: string;
  platform: string;
  isActive: boolean;
  credentials: Record<string, unknown>;
  eventMappings: unknown;
  createdAt: Date;
  updatedAt: Date;
  bindings: Array<{ id: string; funnelId: string; funnelName: string }>;
  recentPostbacks: PostbackRow[];
  postbackTotal: number;
}

export async function loadAdPlatformDetail(id: string): Promise<AdPlatformDetailData | null> {
  const connections = await listConnections();
  const conn = connections.find((c) => c.id === id);
  if (!conn) return null;
  return {
    id: conn.id,
    name: conn.externalAccountId,
    platform: conn.platform,
    isActive: conn.status === 'ACTIVE',
    credentials: {},
    eventMappings: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    bindings: [],
    recentPostbacks: [],
    postbackTotal: 0,
  };
}
