import { makeOrderDashboardQuery, makeOrderEmailMonitor } from '@/composition/order-fulfillment-deps';
import { getBasePrisma } from '@/lib/db';
import { getCurrentTenantId } from '@/lib/tenant/context';
import {
  aggregateOrderKpi,
  aggregateEmailKpi,
  type OrderKpi,
  type EmailKpi,
} from './orders-helpers';

function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  return p.catch(() => fallback);
}

export interface OrdersListRow {
  id: string;
  orderNumber: string;
  status: string;
  total: string;
  currency: string;
  customerEmail: string;
  customerName: string | null;
  createdAt: Date;
}

export interface OrdersListData {
  rows: OrdersListRow[];
  kpi: OrderKpi;
}

const EMPTY_ORDER_KPI: OrderKpi = {
  total24h: 0,
  totalPrev24h: 0,
  paid24h: 0,
  paidPrev24h: 0,
  pending24h: 0,
  pendingPrev24h: 0,
  refunded24h: 0,
  refundedPrev24h: 0,
};

export async function loadOrdersListData(now: Date = new Date()): Promise<OrdersListData> {
  const query = makeOrderDashboardQuery();
  const page = await safe(query.list({}, 1, 500), {
    items: [],
    total: 0,
    page: 1,
    limit: 500,
    totalPages: 1,
  });

  const rows: OrdersListRow[] = page.items.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    total: (o.capturedTotalMinor / 100).toFixed(2),
    currency: o.currencyCode,
    customerEmail: o.customerEmail,
    customerName: o.customerName,
    createdAt: new Date(o.createdAt),
  }));

  const kpi = aggregateOrderKpi({
    orders: rows.map((r) => ({ status: r.status, createdAt: r.createdAt })),
    now,
  });
  return { rows, kpi };
}

export interface EmailsListRow {
  id: string;
  templateKey: string;
  recipient: string;
  subject: string | null;
  status: string;
  attemptCount: number;
  lastError: string | null;
  createdAt: Date;
}

export interface EmailsMonitorData {
  rows: EmailsListRow[];
  kpi: EmailKpi;
  templateTypes: string[];
}

const EMPTY_EMAIL_KPI: EmailKpi = {
  pending24h: 0,
  pendingPrev24h: 0,
  sent24h: 0,
  sentPrev24h: 0,
  failed24h: 0,
  failedPrev24h: 0,
  avgAttempts: 0,
};

export async function loadEmailsMonitorData(now: Date = new Date()): Promise<EmailsMonitorData> {
  const monitor = makeOrderEmailMonitor();
  const page = await safe(monitor.list({ page: 1, limit: 500 }), {
    emails: [],
    total: 0,
    page: 1,
    limit: 500,
    totalPages: 1,
  });

  const rows: EmailsListRow[] = page.emails.map((e) => ({
    id: e.id,
    templateKey: e.templateKey,
    recipient: e.recipient,
    subject: e.subject,
    status: e.status,
    attemptCount: e.attemptCount,
    lastError: e.lastError,
    createdAt: new Date(e.createdAt),
  }));

  const kpi = aggregateEmailKpi({
    emails: rows.map((r) => ({ status: r.status, attempts: r.attemptCount, createdAt: r.createdAt })),
    now,
  });
  const templateTypes = Array.from(new Set(rows.map((r) => r.templateKey))).sort();
  return { rows, kpi, templateTypes };
}

export interface OrderDetailLine {
  title: string;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
}

export interface UtmParam {
  key: string;
  value: string;
}

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

function parseUtmParams(url: string | null): UtmParam[] {
  if (!url) return [];
  try {
    const params = new URL(url).searchParams;
    const found = new Map<string, string>();
    for (const [k, v] of params) {
      if (k.toLowerCase().startsWith('utm_') && v) found.set(k.toLowerCase(), v);
    }
    const ordered: UtmParam[] = [];
    for (const key of UTM_KEYS) {
      const value = found.get(key);
      if (value) {
        ordered.push({ key, value });
        found.delete(key);
      }
    }
    for (const [key, value] of found) ordered.push({ key, value });
    return ordered;
  } catch {
    return [];
  }
}

export interface OrderDetailData {
  id: string;
  orderNumber: string;
  status: string;
  saleRef: string;
  capturedTotalMinor: number;
  currency: string;
  customerEmail: string;
  customerName: string | null;
  customerPhone: string | null;
  lines: OrderDetailLine[];
  trackingCarrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  backendOrderRef: string | null;
  note: string | null;
  refundedMinor: number;
  attributionSessionId: string | null;
  attributionVisitorId: string | null;
  attributionFirstSeenUrl: string | null;
  attributionUtm: UtmParam[];
  createdAt: Date;
  updatedAt: Date;
  refunds: Array<{
    transactionId: string;
    amountMinor: number;
    currency: string;
    status: string;
    reason: string | null;
    createdAt: Date;
  }>;
  emails: Array<{
    id: string;
    templateKey: string;
    recipient: string;
    subject: string | null;
    status: string;
    attemptCount: number;
    lastError: string | null;
    createdAt: Date;
  }>;
  visits: Array<{ url: string; kind: string; occurredAt: Date }>;
  visitsTotal: number;
}

export async function loadOrderDetail(orderId: string): Promise<OrderDetailData | null> {
  const bundle = await safe(makeOrderDashboardQuery().detail(orderId), null);
  if (!bundle) return null;
  const { order } = bundle;

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    saleRef: order.saleRef,
    capturedTotalMinor: order.capturedTotalMinor,
    currency: order.currencyCode,
    customerEmail: order.customerEmail,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    lines: order.lines.map((l) => ({
      title: l.title,
      quantity: l.quantity,
      unitPriceMinor: l.unitPriceMinor,
      lineTotalMinor: l.lineTotalMinor,
    })),
    trackingCarrier: order.trackingCarrier,
    trackingNumber: order.trackingNumber,
    trackingUrl: order.trackingUrl,
    backendOrderRef: order.backendOrderRef,
    note: order.note,
    refundedMinor: order.refundedMinor,
    attributionSessionId: order.attribution?.sessionId ?? null,
    attributionVisitorId: order.attribution?.visitorId ?? null,
    attributionFirstSeenUrl: order.attribution?.firstSeenUrl ?? null,
    attributionUtm: parseUtmParams(order.attribution?.firstSeenUrl ?? null),
    createdAt: new Date(order.createdAt),
    updatedAt: new Date(order.updatedAt),
    refunds: order.refunds.map((r) => ({
      transactionId: r.transactionId,
      amountMinor: r.amountMinor,
      currency: r.currencyCode,
      status: r.status,
      reason: r.reason,
      createdAt: new Date(r.createdAt),
    })),
    emails: bundle.emails.map((e) => ({
      id: e.id,
      templateKey: e.templateKey,
      recipient: e.recipient,
      subject: e.subject,
      status: e.status,
      attemptCount: e.attemptCount,
      lastError: e.lastError,
      createdAt: new Date(e.createdAt),
    })),
    visits: bundle.visits.map((v) => ({ url: v.url, kind: v.kind, occurredAt: new Date(v.occurredAt) })),
    visitsTotal: bundle.visitsTotal,
  };
}

export interface OrderPaymentData {
  intentId: string;
  provider: string;
  cardBrand: string | null;
  last4: string | null;
  providerIntentId: string | null;
  providerChargeId: string | null;
  status: string;
  capturedMinor: number | null;
  refunds: Array<{
    providerRefundRef: string | null;
    amountMinor: number;
    status: string;
    refundKind: string | null;
    createdAt: Date;
  }>;
}

export async function loadOrderPayment(saleRef: string): Promise<OrderPaymentData | null> {
  try {
    const intent = await getBasePrisma().paymentIntent.findUnique({
      where: { tenantId_saleRef: { tenantId: getCurrentTenantId(), saleRef } },
      include: { refunds: true },
    });
    if (!intent) return null;
    return {
      intentId: intent.id,
      provider: intent.provider,
      cardBrand: intent.cardBrand,
      last4: intent.last4,
      providerIntentId: intent.providerIntentId,
      providerChargeId: intent.providerChargeId,
      status: intent.status,
      capturedMinor: intent.capturedMinor,
      refunds: intent.refunds
        .filter((t) => t.type === 'REFUND')
        .map((t) => ({
          providerRefundRef: t.providerRefundRef,
          amountMinor: t.amountMinor,
          status: t.status,
          refundKind: t.refundKind,
          createdAt: new Date(t.createdAt),
        })),
    };
  } catch {
    return null;
  }
}

export interface OrderChargeLedgerRow {
  transactionId: string;
  chargeRef: string | null;
  amountMinor: number;
  refundedMinor: number;
  refundableMinor: number;
  status: string;
  provider: string;
  createdAt: Date;
}

export interface OrderRefundLedgerRow {
  transactionId: string;
  chargeRef: string | null;
  providerRefundRef: string | null;
  amountMinor: number;
  status: string;
  refundKind: string | null;
  reason: string | null;
  createdAt: Date;
}

export interface OrderTransactionsData {
  intentId: string;
  currency: string;
  charges: OrderChargeLedgerRow[];
  refunds: OrderRefundLedgerRow[];
}

// Full per-charge ledger for an order's PaymentIntent: a merged-upsell intent has one CHARGE row per
// charge (base + each upsell), each refundable independently. Refundable balance is per charge
// (non-FAILED refunds whose chargeRef matches), since the PSP refunds per charge.
export async function loadOrderTransactions(saleRef: string): Promise<OrderTransactionsData | null> {
  try {
    const intent = await getBasePrisma().paymentIntent.findUnique({
      where: { tenantId_saleRef: { tenantId: getCurrentTenantId(), saleRef } },
      include: { refunds: true }, // relation spans every Transaction parented to this intent
    });
    if (!intent) return null;
    const txns = intent.refunds as Array<{
      id: string; type: string; status: string; amountMinor: number; currencyCode: string;
      provider: string; providerRefundRef: string | null; chargeRef: string | null;
      refundKind: string | null; reason: string | null; createdAt: Date;
    }>;
    const byTime = (a: { createdAt: Date }, b: { createdAt: Date }) => +new Date(a.createdAt) - +new Date(b.createdAt);

    const refundRows = txns.filter((t) => t.type === 'REFUND').sort(byTime);
    const refundedByCharge = new Map<string, number>();
    for (const r of refundRows) {
      if (r.status === 'FAILED') continue;
      const key = r.chargeRef ?? '';
      refundedByCharge.set(key, (refundedByCharge.get(key) ?? 0) + r.amountMinor);
    }

    const charges: OrderChargeLedgerRow[] = txns
      .filter((t) => t.type === 'CHARGE')
      .sort(byTime)
      .map((t) => {
        const ref = t.chargeRef ?? t.providerRefundRef;
        const refundedMinor = refundedByCharge.get(ref ?? '') ?? 0;
        return {
          transactionId: t.id,
          chargeRef: ref,
          amountMinor: t.amountMinor,
          refundedMinor,
          refundableMinor: Math.max(0, t.amountMinor - refundedMinor),
          status: t.status,
          provider: t.provider,
          createdAt: new Date(t.createdAt),
        };
      });

    // Legacy intents captured before charges were recorded as Transaction rows: synthesize one charge
    // from the intent so the order still shows a refundable charge.
    if (charges.length === 0 && intent.status === 'CAPTURED' && intent.providerChargeId) {
      const refundedMinor = refundRows.filter((r) => r.status !== 'FAILED').reduce((a, r) => a + r.amountMinor, 0);
      const amountMinor = intent.capturedMinor ?? 0;
      charges.push({
        transactionId: `intent:${intent.id}`,
        chargeRef: intent.providerChargeId,
        amountMinor,
        refundedMinor,
        refundableMinor: Math.max(0, amountMinor - refundedMinor),
        status: 'SUCCEEDED',
        provider: intent.provider,
        createdAt: new Date(intent.createdAt),
      });
    }

    const refunds: OrderRefundLedgerRow[] = refundRows.map((t) => ({
      transactionId: t.id,
      chargeRef: t.chargeRef,
      providerRefundRef: t.providerRefundRef,
      amountMinor: t.amountMinor,
      status: t.status,
      refundKind: t.refundKind,
      reason: t.reason,
      createdAt: new Date(t.createdAt),
    }));

    return { intentId: intent.id, currency: intent.currencyCode, charges, refunds };
  } catch {
    return null;
  }
}

export interface OrderPostbackRow {
  destinationId: string;
  status: string;
  attemptCount: number;
  providerRef: string | null;
  eventName: string;
  createdAt: Date;
}

export async function loadOrderPostbacks(
  saleRef: string,
  sessionId: string | null,
): Promise<OrderPostbackRow[]> {
  if (!sessionId) return [];
  try {
    const eventId = `Purchase:${sessionId}:${saleRef}`;
    const rows = await getBasePrisma().postback.findMany({
      where: { tenantId: getCurrentTenantId(), eventId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => ({
      destinationId: row.destinationId,
      status: row.status,
      attemptCount: row.attemptCount,
      providerRef: row.providerRef,
      eventName: (row.eventSnapshot as { eventName?: string } | null)?.eventName ?? '',
      createdAt: new Date(row.createdAt),
    }));
  } catch {
    return [];
  }
}

export interface OrderActivityRow {
  kind: string;
  url: string | null;
  stepId: string | null;
  metadata: any;
  occurredAt: Date;
}

export async function loadOrderActivity(
  visitorId: string | null,
  sessionId: string | null,
): Promise<OrderActivityRow[]> {
  if (!visitorId && !sessionId) return [];
  try {
    const tenantId = getCurrentTenantId();
    const or = [
      visitorId ? { visitorId } : undefined,
      sessionId ? { sessionId } : undefined,
    ].filter(Boolean) as Array<{ visitorId?: string; sessionId?: string }>;
    const where = or.length === 1 ? { tenantId, ...or[0] } : { tenantId, OR: or };
    const rows = await getBasePrisma().userActivityEvent.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
      take: 100,
    });
    return rows.map((row) => ({
      kind: row.kind,
      url: row.url,
      stepId: row.stepId,
      metadata: row.metadata,
      occurredAt: new Date(row.occurredAt),
    }));
  } catch {
    return [];
  }
}

export { EMPTY_ORDER_KPI, EMPTY_EMAIL_KPI };
