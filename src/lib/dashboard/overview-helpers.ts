


export interface DeltaResult {
  value: string;
  direction: 'up' | 'down';
  tone: 'ok' | 'bad' | 'muted';
}

export function computeDelta(
  current: number,
  previous: number,
  opts: { invertTone?: boolean } = {},
): DeltaResult {
  const invertTone = !!opts.invertTone;
  if (previous === 0 && current === 0) {
    return { value: '0.0%', direction: 'up', tone: 'muted' };
  }
  if (previous === 0) {
    return { value: '+100%', direction: 'up', tone: invertTone ? 'bad' : 'ok' };
  }
  const ratio = ((current - previous) / Math.abs(previous)) * 100;
  const direction: 'up' | 'down' = ratio >= 0 ? 'up' : 'down';
  const sign = ratio >= 0 ? '+' : '';
  const value = `${sign}${ratio.toFixed(1)}%`;
  const tone: 'ok' | 'bad' | 'muted' =
    ratio === 0 ? 'muted' : (ratio > 0 ? (invertTone ? 'bad' : 'ok') : (invertTone ? 'ok' : 'bad'));
  return { value, direction, tone };
}

export function bucketByHour(
  events: Array<{ createdAt: Date | string }>,
  now: Date = new Date(),
  hours = 24,
): number[] {
  const buckets = new Array<number>(hours).fill(0);
  const nowMs = now.getTime();
  const windowMs = hours * 60 * 60 * 1000;
  const startMs = nowMs - windowMs;
  for (const e of events) {
    const ts = typeof e.createdAt === 'string' ? new Date(e.createdAt).getTime() : e.createdAt.getTime();
    if (ts < startMs || ts > nowMs) continue;
    const offsetMs = ts - startMs;
    const idx = Math.min(hours - 1, Math.floor(offsetMs / (60 * 60 * 1000)));
    buckets[idx]++;
  }
  return buckets;
}

export function normalizeSparkline(points: number[], minSamples = 6): number[] {
  if (points.length === 0) return new Array(minSamples).fill(0);
  if (points.length >= minSamples) return points;
  return [...new Array(minSamples - points.length).fill(0), ...points];
}

export function formatCurrency(n: number, currency = 'USD'): string {
  if (!isFinite(n)) return '$0.00';
  const abs = Math.abs(n);
  const fixed = abs >= 1000 ? abs.toFixed(0) : abs.toFixed(2);
  const withCommas = fixed.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const symbol = currency === 'USD' ? '$' : '';
  return n < 0 ? `-${symbol}${withCommas}` : `${symbol}${withCommas}`;
}

export function formatNumber(n: number): string {
  if (!isFinite(n)) return '0';
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatPercent(num: number, denom: number, fractionDigits = 2): string {
  if (denom === 0) return '0.00%';
  return `${((num / denom) * 100).toFixed(fractionDigits)}%`;
}

export function relativeTime(from: Date | string | null | undefined, to: Date = new Date()): string {
  if (!from) return 'never';
  const ts = typeof from === 'string' ? new Date(from).getTime() : from.getTime();
  const diffSec = Math.max(0, Math.floor((to.getTime() - ts) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}

export function formatHms(d: Date): string {
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export interface IntegrationItem {
  key: string;
  kind: 'ad' | 'payment' | 'email' | 'ecommerce';
  name: string;
  detail: string;
  status: 'ok' | 'warn' | 'bad' | 'muted';
  statusLabel: string;
}

export interface AggregateInput {
  adPlatforms: Array<{
    id: string;
    name: string;
    platform: string;
    isActive?: boolean | null;
    credentials?: { expiresAt?: string | number | Date | null } | null;
  }>;
  paymentConfigs: Array<{
    id: string;
    name: string;
    provider: string;
    isActive?: boolean | null;
    credentials?: { publishableKey?: string | null; expiresAt?: string | number | Date | null } | null;
  }>;
  emailConfigs: Array<{
    id: string;
    name: string;
    provider: string;
    fromEmail?: string | null;
    isActive?: boolean | null;
    credentials?: { host?: string | null } | null;
  }>;
  sites: Array<{
    id: string;
    name: string;
    settings?: { ecommerce?: { type?: string; shopDomain?: string; siteUrl?: string } | null } | null;
  }>;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function expiresWithin(value: unknown, ms: number, now: Date): boolean {
  if (value == null) return false;
  const t = value instanceof Date ? value.getTime() : new Date(String(value)).getTime();
  if (!isFinite(t)) return false;
  return t - now.getTime() < ms;
}

export function aggregateIntegrations(input: AggregateInput, now: Date = new Date()): IntegrationItem[] {
  const items: IntegrationItem[] = [];

  for (const ap of input.adPlatforms) {
    const expiring = expiresWithin(ap.credentials?.expiresAt ?? null, SEVEN_DAYS_MS, now);
    const status: IntegrationItem['status'] = expiring ? 'warn' : (ap.isActive === false ? 'muted' : 'ok');
    const statusLabel = expiring ? 'Renew' : (ap.isActive === false ? 'Disabled' : 'Connected');
    items.push({
      key: `ad:${ap.id}`,
      kind: 'ad',
      name: `${prettyAdPlatform(ap.platform)} · ${ap.name}`,
      detail: prettyAdPlatform(ap.platform),
      status,
      statusLabel,
    });
  }

  for (const pc of input.paymentConfigs) {
    const expiring = expiresWithin(pc.credentials?.expiresAt ?? null, SEVEN_DAYS_MS, now);
    const masked = pc.credentials?.publishableKey
      ? `${String(pc.credentials.publishableKey).slice(0, 8)}…`
      : '';
    const status: IntegrationItem['status'] = expiring ? 'warn' : (pc.isActive === false ? 'muted' : 'ok');
    const statusLabel = expiring ? 'Renew' : (pc.isActive === false ? 'Disabled' : 'Connected');
    items.push({
      key: `pay:${pc.id}`,
      kind: 'payment',
      name: `${prettyProvider(pc.provider)} ${pc.name}`,
      detail: masked || prettyProvider(pc.provider),
      status,
      statusLabel,
    });
  }

  for (const ec of input.emailConfigs) {
    const status: IntegrationItem['status'] = ec.isActive === false ? 'muted' : 'ok';
    const statusLabel = ec.isActive === false ? 'Disabled' : 'Connected';
    const sub = ec.provider === 'SMTP' ? (ec.credentials?.host || 'SMTP') : (ec.fromEmail || ec.provider);
    items.push({
      key: `email:${ec.id}`,
      kind: 'email',
      name: `${ec.provider} · ${ec.name}`,
      detail: sub,
      status,
      statusLabel,
    });
  }

  for (const site of input.sites) {
    const ec = site.settings?.ecommerce;
    if (!ec || !ec.type) continue;
    const detail = ec.shopDomain || ec.siteUrl || '';
    if (!detail) continue;
    items.push({
      key: `ecom:${site.id}`,
      kind: 'ecommerce',
      name: `${prettyEcommerce(ec.type)} · ${site.name}`,
      detail,
      status: 'ok',
      statusLabel: 'Connected',
    });
  }

  return items;
}

function prettyAdPlatform(p: string): string {
  switch (p) {
    case 'FACEBOOK': return 'Facebook Ads';
    case 'TIKTOK': return 'TikTok Ads';
    case 'GOOGLE_ADS': return 'Google Ads';
    case 'BING_ADS': return 'Bing Ads';
    default: return p;
  }
}

function prettyProvider(p: string): string {
  if (p === 'PAYPAL') return 'PayPal';
  if (p === 'STRIPE') return 'Stripe';
  return p;
}

function prettyEcommerce(t: string): string {
  const v = t.toLowerCase();
  if (v === 'shopify') return 'Shopify';
  if (v === 'woocommerce') return 'WooCommerce';
  if (v === 'picocart') return 'Picocart';
  return t;
}

export function countAttention(items: IntegrationItem[]): number {
  return items.filter((i) => i.status === 'warn' || i.status === 'bad').length;
}

export function csvEscape(value: unknown): string {
  if (value == null) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(rows: Array<Record<string, unknown>>, columns: string[]): string {
  const head = columns.map(csvEscape).join(',');
  const body = rows.map((r) => columns.map((c) => csvEscape(r[c])).join(',')).join('\n');
  return `${head}\n${body}\n`;
}
