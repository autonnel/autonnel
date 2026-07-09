
import { DB_TO_FUNNEL_PAGE_TYPE } from '@/components/funnel/types';

export interface FunnelStepJson {
  stepSlug?: string;
  pageId?: string;
}

// A page's stored DB type decides its funnel role; CUSTOM acts as a LANDING step. Returns null
// for unknown/missing types so callers can choose their own fallback.
export function funnelRoleOf(dbType: string | null | undefined): string | null {
  if (!dbType) return null;
  return DB_TO_FUNNEL_PAGE_TYPE[dbType.toUpperCase()] ?? null;
}

// A step's funnel role comes from the referenced page's stored type, never its position.
// Auto-seeded thankyou/error steps are prepended at funnel creation, so positional inference
// would mislabel them (e.g. step 0 = thankyou) and pick the wrong entry URL. Callers that have
// resolved real page types pass `roleByPageId`; missing/unknown pages default to LANDING to
// mirror DB_TO_FUNNEL_PAGE_TYPE (CUSTOM pages act as LANDING steps).
export function stepsToPages(
  steps: FunnelStepJson[],
  roleByPageId?: Map<string, string>,
): Array<{ pageType: string; order: number; subOrder: number; stepSlug: string | null; pageId: string }> {
  return steps.map((s, i) => ({
    pageType: roleByPageId?.get(s.pageId ?? '') ?? 'LANDING',
    order: i,
    subOrder: 0,
    stepSlug: s.stepSlug ?? null,
    pageId: s.pageId ?? '',
  }));
}

export interface FunnelListRow {
  id: string;
  name: string;
  pageCount: number;
  hasErrorPage: boolean;
  visits24h: number;
  orders24h: number;
  conv: string;
  convPct: number;
  trend: number[];
  status: 'ok' | 'warn' | 'bad';
  publicUrl?: string | null;
}

export interface FunnelListAggregateInput {
  funnels: Array<{
    id: string;
    name: string;
    pages: Array<{ pageType: string }>;
  }>;
  visits24h: Array<{ funnelId: string | null; createdAt: Date | string; eventType: string }>;
  orders24h: Array<{ funnelId: string | null; createdAt: Date | string }>;
  visits7d: Array<{ funnelId: string | null; createdAt: Date | string }>;
  needsRetry?: Set<string>;
  now?: Date;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export function aggregateFunnelList(input: FunnelListAggregateInput): FunnelListRow[] {
  const now = input.now ?? new Date();
  const visitsByFunnel = new Map<string, number>();
  const checkoutByFunnel = new Map<string, number>();
  for (const v of input.visits24h) {
    if (!v.funnelId) continue;
    visitsByFunnel.set(v.funnelId, (visitsByFunnel.get(v.funnelId) || 0) + 1);
    if (v.eventType === 'PAGE_VIEW_CHECKOUT') {
      checkoutByFunnel.set(v.funnelId, (checkoutByFunnel.get(v.funnelId) || 0) + 1);
    }
  }
  const ordersByFunnel = new Map<string, number>();
  for (const o of input.orders24h) {
    if (!o.funnelId) continue;
    ordersByFunnel.set(o.funnelId, (ordersByFunnel.get(o.funnelId) || 0) + 1);
  }

  const trendByFunnel = new Map<string, number[]>();
  for (const f of input.funnels) trendByFunnel.set(f.id, new Array(7).fill(0));
  for (const v of input.visits7d) {
    if (!v.funnelId) continue;
    const ts = typeof v.createdAt === 'string' ? new Date(v.createdAt).getTime() : v.createdAt.getTime();
    const offset = now.getTime() - ts;
    if (offset < 0 || offset > 7 * DAY_MS) continue;
    const bucket = Math.min(6, Math.floor(offset / DAY_MS));
    const arr = trendByFunnel.get(v.funnelId);
    if (arr) arr[6 - bucket] += 1;
  }

  const retry = input.needsRetry ?? new Set<string>();

  return input.funnels.map((f) => {
    const visits = visitsByFunnel.get(f.id) || 0;
    const orders = ordersByFunnel.get(f.id) || 0;
    const checkouts = checkoutByFunnel.get(f.id) || 0;
    const denom = checkouts > 0 ? checkouts : visits;
    const convPct = denom === 0 ? 0 : (orders / denom) * 100;
    const pageCount = f.pages.length;
    const hasErrorPage = f.pages.some((p) => p.pageType === 'ERROR');
    return {
      id: f.id,
      name: f.name,
      pageCount,
      hasErrorPage,
      visits24h: visits,
      orders24h: orders,
      convPct,
      conv: `${convPct.toFixed(2)}%`,
      trend: trendByFunnel.get(f.id) || new Array(7).fill(0),
      status: retry.has(f.id) ? 'warn' : 'ok',
    };
  });
}

export type FunnelListSortKey = 'name' | 'pageCount' | 'visits' | 'orders' | 'conv';
export type FunnelListSortOrder = 'asc' | 'desc';

export function sortFunnelList(
  rows: FunnelListRow[],
  key: FunnelListSortKey,
  order: FunnelListSortOrder,
): FunnelListRow[] {
  const dir = order === 'asc' ? 1 : -1;
  const out = [...rows];
  out.sort((a, b) => {
    switch (key) {
      case 'name': return a.name.localeCompare(b.name) * dir;
      case 'pageCount': return (a.pageCount - b.pageCount) * dir;
      case 'visits': return (a.visits24h - b.visits24h) * dir;
      case 'orders': return (a.orders24h - b.orders24h) * dir;
      case 'conv': return (a.convPct - b.convPct) * dir;
      default: return 0;
    }
  });
  return out;
}

export function paginate<T>(rows: T[], page: number, perPage: number): { items: T[]; page: number; totalPages: number; total: number } {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * perPage;
  return { items: rows.slice(start, start + perPage), page: safePage, totalPages, total };
}

export function pageNumbers(current: number, total: number): Array<number | '...'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: Array<number | '...'> = [1];
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);
  if (left > 2) out.push('...');
  for (let i = left; i <= right; i++) out.push(i);
  if (right < total - 1) out.push('...');
  out.push(total);
  return out;
}

// LANDING preferred; CHECKOUT fallback. Returns null when neither has a usable URL.
export function buildFunnelViewUrl(input: {
  funnelId: string;
  primaryHost: string | null;
  pages: Array<{
    pageType: string;
    order: number;
    subOrder: number;
    stepSlug: string | null;
    pageSlug: string | null;
  }>;
}): string | null {
  const sorted = [...input.pages].sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.subOrder - b.subOrder;
  });

  // Prefer the page's own public URL — the entry point. `/n/<funnelId>/<stepSlug>` is a
  // step-advance redirect (it sends the visitor to the next step), not an entry URL, so it is
  // only a fallback when the page slug cannot be resolved.
  const pickUrl = (p: typeof sorted[number]): string | null => {
    if (p.pageSlug) {
      const slug = p.pageSlug.startsWith('/') ? p.pageSlug : `/${p.pageSlug}`;
      if (input.primaryHost) {
        const protocol = input.primaryHost.includes('localhost') ? 'http' : 'https';
        return `${protocol}://${input.primaryHost}${slug}`;
      }
      return `/storefront${slug}`;
    }
    if (p.stepSlug) return `/n/${input.funnelId}/${p.stepSlug}`;
    return null;
  };

  const landings = sorted.filter((p) => p.pageType === 'LANDING');
  if (landings.length > 0) {
    const url = pickUrl(landings[0]);
    if (url) return url;
  }
  const checkout = sorted.find((p) => p.pageType === 'CHECKOUT');
  if (checkout) {
    const url = pickUrl(checkout);
    if (url) return url;
  }
  return null;
}

export function toPublicFunnelUrl(viewUrl: string | null, primaryHost: string | null): string | null {
  if (!viewUrl) return null;
  if (!viewUrl.startsWith('/')) return viewUrl;
  if (!primaryHost) return viewUrl;
  const protocol = primaryHost.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${primaryHost}${viewUrl}`;
}

export interface FunnelStep {
  pageType: string;
  label: string;
  count: number;
}

export interface FunnelStepDiagram {
  steps: Array<FunnelStep & { dropFromPrev: number; dropPctFromPrev: string; barWidthPct: number }>;
  totalEnter: number;
  totalConvert: number;
  overallConvPct: number;
}

const STEP_LABEL: Record<string, string> = {
  LANDING: 'Landing',
  CHECKOUT: 'Checkout',
  UPSELL: 'Upsell',
  THANKYOU: 'Thank you',
  ERROR: 'Error',
};

const STEP_EVENT_TYPES: Record<string, string[]> = {
  LANDING: ['PAGE_VIEW_LP', 'PAGE_VIEW_LP1', 'PAGE_VIEW_LP2', 'PAGE_VIEW_LP3'],
  CHECKOUT: ['PAGE_VIEW_CHECKOUT'],
  UPSELL: ['PAGE_VIEW_UPSELL', 'PAGE_VIEW_UPSELL1', 'PAGE_VIEW_UPSELL2', 'PAGE_VIEW_UPSELL3'],
  THANKYOU: ['PAGE_VIEW_THANKYOU'],
  ERROR: ['PAGE_VIEW_ERROR'],
};

export function eventTypesForPageType(pageType: string): string[] {
  return STEP_EVENT_TYPES[pageType] || [];
}

const STEP_ORDER: Record<string, number> = {
  LANDING: 1,
  CHECKOUT: 2,
  UPSELL: 3,
  THANKYOU: 4,
  ERROR: 5,
};

export interface ComputeStepDiagramInput {
  pageTypes: string[];
  visits: Array<{ eventType: string }>;
}

// Distinct funnel-role steps in workflow order, ERROR excluded.
function orderedRoles(pageTypes: string[]): string[] {
  const uniqueTypes = Array.from(new Set(pageTypes.filter((t) => t !== 'ERROR')));
  uniqueTypes.sort((a, b) => (STEP_ORDER[a] || 99) - (STEP_ORDER[b] || 99));
  return uniqueTypes;
}

function assembleDiagram(rawSteps: FunnelStep[]): FunnelStepDiagram {
  const maxCount = Math.max(1, ...rawSteps.map((s) => s.count));
  const steps = rawSteps.map((s, idx) => {
    const prev = idx === 0 ? s.count : rawSteps[idx - 1].count;
    const drop = idx === 0 ? 0 : Math.max(0, prev - s.count);
    const dropPct = idx === 0 || prev === 0 ? 0 : (drop / prev) * 100;
    const barWidthPct = (s.count / maxCount) * 100;
    return {
      ...s,
      dropFromPrev: drop,
      dropPctFromPrev: `${dropPct.toFixed(1)}%`,
      barWidthPct: Number(barWidthPct.toFixed(2)),
    };
  });

  const totalEnter = rawSteps[0]?.count ?? 0;
  const totalConvert = rawSteps[rawSteps.length - 1]?.count ?? 0;
  const overallConvPct = totalEnter === 0 ? 0 : (totalConvert / totalEnter) * 100;

  return { steps, totalEnter, totalConvert, overallConvPct };
}

export function computeStepDiagram(input: ComputeStepDiagramInput): FunnelStepDiagram {
  const counts = new Map<string, number>();
  for (const v of input.visits) {
    for (const [pt, evts] of Object.entries(STEP_EVENT_TYPES)) {
      if (evts.includes(v.eventType)) {
        counts.set(pt, (counts.get(pt) || 0) + 1);
      }
    }
  }
  const rawSteps: FunnelStep[] = orderedRoles(input.pageTypes).map((t) => ({
    pageType: t,
    label: STEP_LABEL[t] || t,
    count: counts.get(t) || 0,
  }));
  return assembleDiagram(rawSteps);
}

// Counts-based diagram for the funnel overview: counts already aggregated per funnel role
// (distinct visitors), no per-event eventType bucketing.
export function buildStepDiagramFromCounts(
  pageRoles: string[],
  countsByRole: Record<string, number>,
): FunnelStepDiagram {
  const rawSteps: FunnelStep[] = orderedRoles(pageRoles).map((t) => ({
    pageType: t,
    label: STEP_LABEL[t] || t,
    count: countsByRole[t] || 0,
  }));
  return assembleDiagram(rawSteps);
}

export interface RawActivityRow {
  kind: string;
  stepId: string | null;
  pageId: string | null;
  pageSlug?: string | null;
  url: string | null;
  metadata: unknown;
  occurredAt: Date;
}

export interface ActivityLine {
  ts: Date;
  text: string;
  tone: 'ok' | 'bad' | 'muted' | 'highlight';
  payload: string;
}

const ACTIVITY_LABELS: Record<string, { text: string; tone: ActivityLine['tone'] }> = {
  page_view: { text: 'Page view', tone: 'muted' },
  checkout_view: { text: 'Checkout viewed', tone: 'highlight' },
  add_to_cart: { text: 'Added to cart', tone: 'muted' },
  remove_from_cart: { text: 'Removed from cart', tone: 'muted' },
  coupon_applied: { text: 'Coupon applied', tone: 'muted' },
  coupon_removed: { text: 'Coupon removed', tone: 'muted' },
  shipping_submitted: { text: 'Shipping submitted', tone: 'highlight' },
  payment_method_selected: { text: 'Payment method selected', tone: 'muted' },
  payment_button_click: { text: 'Payment button click', tone: 'muted' },
  payment_submit: { text: 'Payment submitted', tone: 'highlight' },
  payment_success: { text: 'Payment success', tone: 'ok' },
  payment_error: { text: 'Payment error', tone: 'bad' },
  upsell_view: { text: 'Upsell viewed', tone: 'muted' },
  upsell_accept: { text: 'Upsell accepted', tone: 'ok' },
  upsell_decline: { text: 'Upsell declined', tone: 'muted' },
  page_leave: { text: 'Page leave', tone: 'muted' },
  js_error: { text: 'JS error', tone: 'bad' },
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function activityPayload(row: RawActivityRow): string {
  const meta = asRecord(row.metadata);
  const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
  switch (row.kind) {
    case 'payment_success':
      return [str(meta?.provider), str(meta?.orderId)].filter(Boolean).join(' · ') || 'success';
    case 'payment_button_click':
    case 'payment_submit':
      return str(meta?.provider);
    case 'payment_error':
    case 'js_error':
      return str(meta?.message).slice(0, 80);
    case 'coupon_applied':
    case 'coupon_removed':
      return str(meta?.code);
    case 'add_to_cart': {
      const items = meta?.items;
      const n = Array.isArray(items) ? items.length : 0;
      return n ? `${n} item${n === 1 ? '' : 's'}` : '';
    }
    default:
      return row.pageSlug || (row.stepId ? row.stepId.toLowerCase() : '');
  }
}

export function formatActivityEntry(row: RawActivityRow): ActivityLine {
  const label = ACTIVITY_LABELS[row.kind] ?? { text: row.kind.replace(/_/g, ' '), tone: 'muted' as const };
  return { ts: row.occurredAt, text: label.text, tone: label.tone, payload: activityPayload(row) };
}
