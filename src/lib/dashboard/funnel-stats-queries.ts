import { getBasePrisma } from '@/lib/db';
import { getCurrentTenantId } from '@/lib/tenant/context';
import { CUSTOM_KIND_PREFIX } from '@/lib/analytics/custom-event-name';

// Statuses that count as a captured/paid order for revenue and conversion.
export const PAID_ORDER_STATUSES = ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'SHIPPED', 'DELIVERED'];

const HOUR_MS = 60 * 60 * 1000;

function toNum(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') return Number(value) || 0;
  return 0;
}

// funnelId set -> single funnel; null -> every funnel-attributed row (excludes null funnelId noise).
function funnelClause(funnelId: string | null, params: unknown[], column: string): string {
  if (funnelId) {
    params.push(funnelId);
    return ` AND ${column} = $${params.length}`;
  }
  return ` AND ${column} IS NOT NULL`;
}

// Restricts a query to an explicit visitor set (used by the traffic-source filter, which resolves
// matching visitors in JS from their entry URL). Empty array intentionally matches nothing.
function visitorIdClause(visitorIds: string[] | null | undefined, params: unknown[], column: string): string {
  if (!visitorIds) return '';
  params.push(visitorIds);
  return ` AND ${column} = ANY($${params.length})`;
}

export interface StepVisitorRow {
  stepId: string | null;
  visitors: number;
}

// Distinct page_view visitors grouped by stepId (= raw Page.type), within [since, until).
export async function queryStepVisitorCounts(
  funnelId: string | null,
  since: Date,
  until: Date,
  visitorIds: string[] | null = null,
): Promise<StepVisitorRow[]> {
  const params: unknown[] = [getCurrentTenantId(), since, until];
  const f = funnelClause(funnelId, params, '"funnelId"') + visitorIdClause(visitorIds, params, '"visitorId"');
  const sql = `
    SELECT "stepId" AS "stepId", COUNT(DISTINCT "visitorId")::int AS "visitors"
    FROM "user_activity_events"
    WHERE "tenantId" = $1 AND "kind" = 'page_view' AND "occurredAt" >= $2 AND "occurredAt" < $3${f}
    GROUP BY "stepId"`;
  const rows = await getBasePrisma().$queryRawUnsafe<Array<Record<string, unknown>>>(sql, ...params);
  return rows.map((r) => ({ stepId: r.stepId == null ? null : String(r.stepId), visitors: toNum(r.visitors) }));
}

export interface StepCustomEventRow {
  stepId: string | null;
  kind: string;
  visitors: number;
}

// Distinct visitors per (stepId, custom kind) within [since, until). Postgres computes the full
// GROUP BY before LIMIT is applied, so this bounds only the rows returned to the caller (and thus
// what the dashboard has to render) - it is not a ceiling on aggregation cost or kind cardinality.
export const CUSTOM_EVENT_ROW_LIMIT = 200;

// renderableStepIds restricts to stepId values loadFunnelSteps can actually render (see
// RENDERABLE_STEP_DB_TYPES in analytics-helpers.ts), so a page under an ERROR step or an
// unmapped stepId cannot crowd real events out of the LIMIT budget above. Matched
// case-insensitively since stepId is caller-supplied and its casing is not normalized at ingest.
export async function queryCustomEventCountsByStep(
  funnelId: string | null,
  since: Date,
  until: Date,
  visitorIds: string[] | null = null,
  renderableStepIds: string[] = [],
): Promise<StepCustomEventRow[]> {
  const params: unknown[] = [
    getCurrentTenantId(),
    since,
    until,
    `${CUSTOM_KIND_PREFIX}%`,
    renderableStepIds.map((id) => id.toUpperCase()),
  ];
  const f = funnelClause(funnelId, params, '"funnelId"') + visitorIdClause(visitorIds, params, '"visitorId"');
  const sql = `
    SELECT "stepId" AS "stepId", "kind" AS "kind", COUNT(DISTINCT "visitorId")::int AS "visitors"
    FROM "user_activity_events"
    WHERE "tenantId" = $1 AND "occurredAt" >= $2 AND "occurredAt" < $3 AND "kind" LIKE $4
      AND UPPER("stepId") = ANY($5)${f}
    GROUP BY "stepId", "kind"
    ORDER BY "visitors" DESC
    LIMIT ${CUSTOM_EVENT_ROW_LIMIT}`;
  const rows = await getBasePrisma().$queryRawUnsafe<Array<Record<string, unknown>>>(sql, ...params);
  return rows.map((r) => ({
    stepId: r.stepId == null ? null : String(r.stepId),
    kind: String(r.kind),
    visitors: toNum(r.visitors),
  }));
}

// allTraffic counts every page_view visitor (site-wide); otherwise scoped by funnelClause.
function visitorClause(funnelId: string | null, allTraffic: boolean, params: unknown[]): string {
  return allTraffic && !funnelId ? '' : funnelClause(funnelId, params, '"funnelId"');
}

// Distinct page_view visitors within [since, until).
export async function queryVisitorCount(
  funnelId: string | null,
  since: Date,
  until: Date,
  allTraffic = false,
  visitorIds: string[] | null = null,
): Promise<number> {
  const params: unknown[] = [getCurrentTenantId(), since, until];
  const f = visitorClause(funnelId, allTraffic, params) + visitorIdClause(visitorIds, params, '"visitorId"');
  const sql = `
    SELECT COUNT(DISTINCT "visitorId")::int AS "visitors"
    FROM "user_activity_events"
    WHERE "tenantId" = $1 AND "kind" = 'page_view' AND "occurredAt" >= $2 AND "occurredAt" < $3${f}`;
  const rows = await getBasePrisma().$queryRawUnsafe<Array<Record<string, unknown>>>(sql, ...params);
  return rows.length ? toNum(rows[0].visitors) : 0;
}

// Hourly distinct page_view visitors for the trailing `hours` window ending at `now`.
export async function queryVisitorSparkline(
  funnelId: string | null,
  now: Date,
  hours = 24,
  allTraffic = false,
): Promise<number[]> {
  const since = new Date(now.getTime() - hours * HOUR_MS);
  const params: unknown[] = [getCurrentTenantId(), since, now];
  const f = visitorClause(funnelId, allTraffic, params);
  const sql = `
    SELECT floor(extract(epoch FROM ("occurredAt" - $2)) / 3600)::int AS "bucket",
           COUNT(DISTINCT "visitorId")::int AS "visitors"
    FROM "user_activity_events"
    WHERE "tenantId" = $1 AND "kind" = 'page_view' AND "occurredAt" >= $2 AND "occurredAt" < $3${f}
    GROUP BY "bucket"`;
  const rows = await getBasePrisma().$queryRawUnsafe<Array<Record<string, unknown>>>(sql, ...params);
  const buckets = new Array<number>(hours).fill(0);
  for (const r of rows) {
    const b = toNum(r.bucket);
    if (b >= 0 && b < hours) buckets[b] = toNum(r.visitors);
  }
  return buckets;
}

// Distinct page_view visitors split into `bucketCount` fixed-width buckets of `bucketSeconds` each,
// starting at `start`. Generalizes queryVisitorSparkline to arbitrary (hour/day) bucket sizes.
export async function queryVisitorBuckets(
  funnelId: string | null,
  start: Date,
  bucketCount: number,
  bucketSeconds: number,
  allTraffic = false,
  visitorIds: string[] | null = null,
): Promise<number[]> {
  const end = new Date(start.getTime() + bucketCount * bucketSeconds * 1000);
  const params: unknown[] = [getCurrentTenantId(), start, end, bucketSeconds];
  const f = visitorClause(funnelId, allTraffic, params) + visitorIdClause(visitorIds, params, '"visitorId"');
  const sql = `
    SELECT floor(extract(epoch FROM ("occurredAt" - $2)) / $4)::int AS "bucket",
           COUNT(DISTINCT "visitorId")::int AS "visitors"
    FROM "user_activity_events"
    WHERE "tenantId" = $1 AND "kind" = 'page_view' AND "occurredAt" >= $2 AND "occurredAt" < $3${f}
    GROUP BY "bucket"`;
  const rows = await getBasePrisma().$queryRawUnsafe<Array<Record<string, unknown>>>(sql, ...params);
  const buckets = new Array<number>(bucketCount).fill(0);
  for (const r of rows) {
    const b = toNum(r.bucket);
    if (b >= 0 && b < bucketCount) buckets[b] = toNum(r.visitors);
  }
  return buckets;
}

// Most recent page_view occurredAt across all funnels, used as the dashboard "last activity" signal.
export async function queryLatestTrafficAt(): Promise<Date | null> {
  const sql = `
    SELECT max("occurredAt") AS "latest"
    FROM "user_activity_events"
    WHERE "tenantId" = $1 AND "kind" = 'page_view'`;
  const rows = await getBasePrisma().$queryRawUnsafe<Array<{ latest: Date | null }>>(sql, getCurrentTenantId());
  const latest = rows.length ? rows[0].latest : null;
  return latest ? new Date(latest as unknown as string) : null;
}

export interface FunnelVisitorRow {
  funnelId: string;
  visitors: number;
}

// Distinct page_view visitors grouped per funnel, within [since, until).
export async function queryVisitorCountsByFunnel(since: Date, until: Date): Promise<FunnelVisitorRow[]> {
  const params: unknown[] = [getCurrentTenantId(), since, until];
  const sql = `
    SELECT "funnelId" AS "funnelId", COUNT(DISTINCT "visitorId")::int AS "visitors"
    FROM "user_activity_events"
    WHERE "tenantId" = $1 AND "kind" = 'page_view' AND "occurredAt" >= $2 AND "occurredAt" < $3
      AND "funnelId" IS NOT NULL
    GROUP BY "funnelId"`;
  const rows = await getBasePrisma().$queryRawUnsafe<Array<Record<string, unknown>>>(sql, ...params);
  return rows.map((r) => ({ funnelId: String(r.funnelId), visitors: toNum(r.visitors) }));
}

export interface AttributedOrderRow {
  orderId: string;
  funnelId: string | null;
  visitorId: string | null;
  capturedTotal: number;
  status: string;
  createdAt: Date;
}

// Paid orders attributed to a funnel directly via o."attribution"->>'funnelId', with the
// attribution visitorId carried through. No session join.
export async function queryAttributedOrders(
  funnelId: string | null,
  since: Date,
  until?: Date,
  opts: { visitorIds?: string[] | null; allTraffic?: boolean } = {},
): Promise<AttributedOrderRow[]> {
  const params: unknown[] = [getCurrentTenantId(), PAID_ORDER_STATUSES, since];
  let untilClause = '';
  if (until) {
    params.push(until);
    untilClause = ` AND o."createdAt" < $${params.length}`;
  }
  const scoped = opts.allTraffic && !funnelId ? '' : funnelClause(funnelId, params, `o."attribution"->>'funnelId'`);
  const f = scoped + visitorIdClause(opts.visitorIds, params, `o."attribution"->>'visitorId'`);
  const sql = `
    SELECT o."id" AS "orderId", o."attribution"->>'funnelId' AS "funnelId", o."attribution"->>'visitorId' AS "visitorId",
           o."capturedTotal" AS "capturedTotal", o."status"::text AS "status", o."createdAt" AS "createdAt"
    FROM "orders" o
    WHERE o."tenantId" = $1 AND o."status"::text = ANY($2) AND o."createdAt" >= $3${untilClause}${f}`;
  const rows = await getBasePrisma().$queryRawUnsafe<Array<Record<string, unknown>>>(sql, ...params);
  return rows.map((r) => ({
    orderId: String(r.orderId),
    funnelId: r.funnelId == null ? null : String(r.funnelId),
    visitorId: r.visitorId == null ? null : String(r.visitorId),
    capturedTotal: toNum(r.capturedTotal),
    status: String(r.status),
    createdAt: new Date(r.createdAt as string),
  }));
}

export interface VisitorSourceRow {
  visitorId: string;
  url: string | null;
  metadata: unknown;
  occurredAt: Date;
}

// Entry page_view per visitor, carrying the URL (utm_*) and click-id metadata used to derive traffic
// source. DISTINCT ON keeps the earliest row per visitor so callers get one row each, not the full log.
export async function queryVisitorSourceRows(
  funnelId: string | null,
  since: Date,
  until: Date,
  allTraffic = false,
): Promise<VisitorSourceRow[]> {
  const params: unknown[] = [getCurrentTenantId(), since, until];
  const f = visitorClause(funnelId, allTraffic, params);
  const sql = `
    SELECT DISTINCT ON ("visitorId") "visitorId", "url", "metadata", "occurredAt"
    FROM "user_activity_events"
    WHERE "tenantId" = $1 AND "kind" = 'page_view' AND "occurredAt" >= $2 AND "occurredAt" < $3${f}
    ORDER BY "visitorId", "occurredAt" ASC`;
  const rows = await getBasePrisma().$queryRawUnsafe<Array<Record<string, unknown>>>(sql, ...params);
  return rows.map((r) => ({
    visitorId: String(r.visitorId),
    url: r.url == null ? null : String(r.url),
    metadata: r.metadata ?? null,
    occurredAt: new Date(r.occurredAt as string),
  }));
}

export interface MethodChargeRow {
  provider: string;
  status: string;
  amountMinor: number;
}

// CHARGE transactions joined back to the order that owns them (transactions -> payment_intents ->
// orders via saleRef) so payment stats can be scoped to an attributed visitor set. Charges without a
// resulting order (declines before order creation) are unattributable and drop out under this filter.
export async function queryMethodChargesByVisitor(
  since: Date,
  until: Date,
  visitorIds: string[],
): Promise<MethodChargeRow[]> {
  const params: unknown[] = [getCurrentTenantId(), since, until, visitorIds];
  const sql = `
    SELECT t."provider" AS "provider", t."status" AS "status", t."amountMinor" AS "amountMinor"
    FROM "transactions" t
    JOIN "payment_intents" pi ON pi."id" = t."parentTransactionId" AND pi."tenantId" = t."tenantId"
    JOIN "orders" o ON o."saleRef" = pi."saleRef" AND o."tenantId" = t."tenantId"
    WHERE t."tenantId" = $1 AND t."type" = 'CHARGE' AND t."createdAt" >= $2 AND t."createdAt" < $3
      AND o."attribution"->>'visitorId' = ANY($4)`;
  const rows = await getBasePrisma().$queryRawUnsafe<Array<Record<string, unknown>>>(sql, ...params);
  return rows.map((r) => ({
    provider: String(r.provider),
    status: String(r.status),
    amountMinor: toNum(r.amountMinor),
  }));
}
