
export type OrderStatusKey =
  | 'PENDING'
  | 'PAID'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED';

export type EmailStatusKey =
  | 'PENDING'
  | 'SENDING'
  | 'SENT'
  | 'FAILED'
  | 'RETRYING';

export type Tone = 'ok' | 'warn' | 'bad' | 'muted' | 'default';

export interface OrderKpi {
  total24h: number;
  totalPrev24h: number;
  paid24h: number;
  paidPrev24h: number;
  pending24h: number;
  pendingPrev24h: number;
  refunded24h: number;
  refundedPrev24h: number;
}

export interface EmailKpi {
  pending24h: number;
  pendingPrev24h: number;
  sent24h: number;
  sentPrev24h: number;
  failed24h: number;
  failedPrev24h: number;
  avgAttempts: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function statusTone(status: string | null | undefined): Tone {
  switch (status) {
    case 'PAID':
    case 'DELIVERED':
    case 'SENT':
      return 'ok';
    case 'PENDING':
    case 'SENDING':
    case 'RETRYING':
    case 'SHIPPED':
      return 'warn';
    case 'FAILED':
    case 'CANCELLED':
      return 'bad';
    case 'REFUNDED':
    case 'PARTIALLY_REFUNDED':
      return 'muted';
    default:
      return 'default';
  }
}

export function statusBadgeClasses(status: string | null | undefined): string {
  const tone = statusTone(status);
  switch (tone) {
    case 'ok':   return 'bg-ds-okBg border-ds-okBorder text-ds-okText';
    case 'warn': return 'bg-ds-warnBg border-ds-warnBorder text-ds-warnText';
    case 'bad':  return 'bg-ds-badBg border-ds-badBorder text-ds-badText';
    case 'muted':
    case 'default':
    default:     return 'bg-ds-surface2 border-ds-line text-ds-slate';
  }
}

export interface AggregateOrdersInput {
  orders: Array<{ status: string; createdAt: Date | string }>;
  now?: Date;
}

export function aggregateOrderKpi(input: AggregateOrdersInput): OrderKpi {
  const now = input.now ?? new Date();
  const start24 = now.getTime() - DAY_MS;
  const start48 = now.getTime() - 2 * DAY_MS;

  let total24 = 0, totalPrev = 0;
  let paid24 = 0, paidPrev = 0;
  let pending24 = 0, pendingPrev = 0;
  let refunded24 = 0, refundedPrev = 0;

  for (const o of input.orders) {
    const ts = typeof o.createdAt === 'string' ? new Date(o.createdAt).getTime() : o.createdAt.getTime();
    if (ts >= start24 && ts <= now.getTime()) {
      total24++;
      if (o.status === 'PAID') paid24++;
      else if (o.status === 'PENDING') pending24++;
      else if (o.status === 'REFUNDED' || o.status === 'PARTIALLY_REFUNDED') refunded24++;
    } else if (ts >= start48 && ts < start24) {
      totalPrev++;
      if (o.status === 'PAID') paidPrev++;
      else if (o.status === 'PENDING') pendingPrev++;
      else if (o.status === 'REFUNDED' || o.status === 'PARTIALLY_REFUNDED') refundedPrev++;
    }
  }

  return {
    total24h: total24,
    totalPrev24h: totalPrev,
    paid24h: paid24,
    paidPrev24h: paidPrev,
    pending24h: pending24,
    pendingPrev24h: pendingPrev,
    refunded24h: refunded24,
    refundedPrev24h: refundedPrev,
  };
}

export interface AggregateEmailsInput {
  emails: Array<{ status: string; attempts: number; createdAt: Date | string }>;
  now?: Date;
}

export function aggregateEmailKpi(input: AggregateEmailsInput): EmailKpi {
  const now = input.now ?? new Date();
  const start24 = now.getTime() - DAY_MS;
  const start48 = now.getTime() - 2 * DAY_MS;

  let pending24 = 0, pendingPrev = 0;
  let sent24 = 0, sentPrev = 0;
  let failed24 = 0, failedPrev = 0;
  let attemptsBeforeSuccessSum = 0;
  let attemptsBeforeSuccessN = 0;

  for (const e of input.emails) {
    const ts = typeof e.createdAt === 'string' ? new Date(e.createdAt).getTime() : e.createdAt.getTime();
    const inWin = ts >= start24 && ts <= now.getTime();
    const inPrev = ts >= start48 && ts < start24;

    if (inWin) {
      if (e.status === 'SENT') {
        sent24++;
        if (e.attempts > 1) {
          attemptsBeforeSuccessSum += e.attempts - 1;
          attemptsBeforeSuccessN++;
        } else if (e.attempts === 1) {
          attemptsBeforeSuccessN++;
        }
      } else if (e.status === 'FAILED') {
        failed24++;
      } else {
        pending24++;
      }
    } else if (inPrev) {
      if (e.status === 'SENT') sentPrev++;
      else if (e.status === 'FAILED') failedPrev++;
      else pendingPrev++;
    }
  }

  const avgAttempts = attemptsBeforeSuccessN === 0
    ? 0
    : attemptsBeforeSuccessSum / attemptsBeforeSuccessN;

  return {
    pending24h: pending24,
    pendingPrev24h: pendingPrev,
    sent24h: sent24,
    sentPrev24h: sentPrev,
    failed24h: failed24,
    failedPrev24h: failedPrev,
    avgAttempts,
  };
}

export interface OrderRowFilter {
  status?: string[];
  dateFrom?: Date | null;
  dateTo?: Date | null;
  search?: string | null;
}

export function filterOrderRows<
  T extends {
    status: string;
    createdAt: Date | string;
    orderNumber: string;
    customerEmail?: string | null;
  },
>(rows: T[], filter: OrderRowFilter): T[] {
  const search = (filter.search || '').trim().toLowerCase();
  const statusSet = filter.status && filter.status.length > 0 ? new Set(filter.status) : null;
  const fromTs = filter.dateFrom ? filter.dateFrom.getTime() : null;
  const toTs = filter.dateTo ? filter.dateTo.getTime() : null;

  return rows.filter((r) => {
    if (statusSet && !statusSet.has(r.status)) return false;
    const ts = typeof r.createdAt === 'string' ? new Date(r.createdAt).getTime() : r.createdAt.getTime();
    if (fromTs !== null && ts < fromTs) return false;
    if (toTs !== null && ts > toTs) return false;
    if (search) {
      const num = r.orderNumber.toLowerCase();
      const email = (r.customerEmail || '').toLowerCase();
      if (!num.includes(search) && !email.includes(search)) return false;
    }
    return true;
  });
}

export function paginate<T>(
  rows: T[],
  page: number,
  perPage: number,
): { items: T[]; page: number; totalPages: number; total: number } {
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

export function prettyTemplateType(type: string | null | undefined): string {
  if (!type) return '—';
  const map: Record<string, string> = {
    'order.receipt': 'Order Receipt',
    'order.shipped': 'Order Shipped',
    'order.delivered': 'Order Delivered',
    'order.refunded': 'Order Refunded',
  };
  return map[type] || type;
}

export function prettyPaymentMethod(method: string | null | undefined): string {
  if (!method) return '—';
  const m = method.toLowerCase();
  if (m === 'paypal') return 'PayPal';
  if (m === 'stripe' || m === 'card') return 'Card';
  return method;
}

export function formatMoney(amount: number | string | null | undefined, currency = 'USD'): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0);
  if (!isFinite(n)) return '0.00';
  const fixed = n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (currency === 'USD') return `$${fixed}`;
  return `${fixed} ${currency}`;
}

export function formatMoneyMinor(amountMinor: number | null | undefined, currency = 'USD'): string {
  return formatMoney((amountMinor ?? 0) / 100, currency);
}

export function summarizeMetadata(metadata: unknown): string {
  if (metadata == null) return '';
  const json = typeof metadata === 'string' ? metadata : JSON.stringify(metadata);
  if (!json || json === '{}' || json === 'null') return '';
  return json.length > 120 ? `${json.slice(0, 120)}…` : json;
}
