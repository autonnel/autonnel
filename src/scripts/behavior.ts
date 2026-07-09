import { isMaskedCrossOriginError } from './masked-error';

declare global {
  interface Window {
    __AUTONNEL_TENANT_ID__?: string;
    __AUTONNEL_API_BASE__?: string;
    __AUTONNEL_PAGE_ID__?: string;
    __AUTONNEL_FUNNEL_ID__?: string | null;
    __AUTONNEL_FUNNEL_PAGE_TYPE__?: string | null;
    __AUTONNEL_STEP_INDEX__?: number;
    __AUTONNEL_SERVER_ANID__?: string;
  }
}

const ANID_COOKIE = 'anid';
const SESSION_KEY = 'autonnel:sid';
const QUEUE_CAP = 50;
const FLUSH_DELAY_MS = 2000;
const STACK_MAX = 1000;
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const CLICK_ID_KEYS = ['fbclid', 'gclid', 'gbraid', 'wbraid', 'ttclid', 'msclkid'];
const SKIP_LINK_PREFIXES = ['#', 'mailto:', 'tel:', 'javascript:'];

function readCookie(name: string): string {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : '';
}

function writeCookie(name: string, value: string): void {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

// Forward marketing/click params to same-origin links so attribution survives funnel navigation;
// identity itself travels via the anid cookie.
function propagateTracking(): void {
  const params = new URL(window.location.href).searchParams;
  document.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((link) => {
    const href = link.getAttribute('href') || '';
    if (!href || SKIP_LINK_PREFIXES.some((p) => href.startsWith(p))) return;
    let target: URL;
    try {
      target = new URL(link.href, window.location.href);
    } catch {
      return;
    }
    if (target.origin !== window.location.origin) return;
    params.forEach((value, key) => {
      if (key === 'anid' || key === 'goid') return;
      if (!target.searchParams.has(key)) target.searchParams.set(key, value);
    });
    link.setAttribute('href', target.toString());
  });
}

function randomId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 15);
  return `${ts}${rand}`;
}

function resolveVisitorId(): string {
  const params = new URL(window.location.href).searchParams;
  const fromUrl = params.get('anid') || params.get('goid') || '';
  const fromServer = window.__AUTONNEL_SERVER_ANID__ || '';
  const fromCookie = readCookie(ANID_COOKIE);
  return fromUrl || fromServer || fromCookie || randomId();
}

function resolveSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const generated = randomId();
    sessionStorage.setItem(SESSION_KEY, generated);
    return generated;
  } catch {
    return randomId();
  }
}

const visitorId = resolveVisitorId();
writeCookie(ANID_COOKIE, visitorId);
const sessionId = resolveSessionId();
const funnelId = window.__AUTONNEL_FUNNEL_ID__ || null;
const pageId = window.__AUTONNEL_PAGE_ID__ || null;
const stepId = window.__AUTONNEL_FUNNEL_PAGE_TYPE__ || null;
const loadedAt = Date.now();

interface QueuedEvent {
  kind: string;
  visitorId: string;
  sessionId: string;
  funnelId: string | null;
  pageId: string | null;
  stepId: string | null;
  url: string;
  referrer: string;
  metadata: Record<string, unknown> | null;
  occurredAt: string;
}

const queue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let inTracker = false;

function enqueue(kind: string, metadata?: Record<string, unknown> | null): void {
  if (inTracker) return;
  inTracker = true;
  try {
    queue.push({
      kind,
      visitorId,
      sessionId,
      funnelId,
      pageId,
      stepId,
      url: location.href,
      referrer: document.referrer,
      metadata: metadata ?? null,
      occurredAt: new Date().toISOString(),
    });
    while (queue.length > QUEUE_CAP) queue.shift();
    scheduleFlush();
  } catch {
    // tracking must never throw into the page
  } finally {
    inTracker = false;
  }
}

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, FLUSH_DELAY_MS);
}

function flush(): void {
  if (!queue.length) return;
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  const events = queue.splice(0, queue.length);
  const base = window.__AUTONNEL_API_BASE__ || '';
  const url = `${base}/api/shop/activity`;
  const payload = JSON.stringify({ events });
  try {
    if (navigator.sendBeacon && navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }))) {
      return;
    }
  } catch {
    // fall through to fetch
  }
  void fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: payload,
    keepalive: true,
  }).catch(() => {});
}

function collectClickIds(): Record<string, string> {
  const params = new URL(location.href).searchParams;
  const ids: Record<string, string> = {};
  for (const key of CLICK_ID_KEYS) {
    const value = params.get(key);
    if (value) ids[key] = value;
  }
  return ids;
}

function setupErrorCapture(): void {
  window.addEventListener('error', (event) => {
    if (isMaskedCrossOriginError(event)) return;
    enqueue('js_error', {
      message: event.message ?? null,
      source: event.filename ?? null,
      line: event.lineno ?? null,
      col: event.colno ?? null,
      stack: event.error?.stack ? String(event.error.stack).slice(0, STACK_MAX) : null,
    });
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const stack =
      reason && typeof reason === 'object' && 'stack' in reason ? String((reason as { stack: unknown }).stack) : null;
    enqueue('js_error', {
      message: reason instanceof Error ? reason.message : String(reason ?? 'unhandledrejection'),
      source: null,
      line: null,
      col: null,
      stack: stack ? stack.slice(0, STACK_MAX) : null,
    });
  });
}

let leaveFired = false;

function fireLeave(): void {
  if (leaveFired) return;
  leaveFired = true;
  enqueue('page_leave', { timeOnPageMs: Date.now() - loadedAt });
  flush();
}

function setupLeaveCapture(): void {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') fireLeave();
  });
  window.addEventListener('pagehide', fireLeave);
}

type DetailEvent = Event & { detail?: unknown };

function detailOf(event: Event): Record<string, unknown> | null {
  const detail = (event as DetailEvent).detail;
  return detail && typeof detail === 'object' && !Array.isArray(detail) ? (detail as Record<string, unknown>) : null;
}

function setupCustomEvents(): void {
  window.addEventListener('autonnel:productsSelected', (event) => {
    const detail = (event as DetailEvent).detail;
    const items =
      detail && typeof detail === 'object' && 'items' in detail
        ? (detail as { items: unknown }).items
        : detail ?? null;
    enqueue('add_to_cart', { items });
  });
  window.addEventListener('autonnel:couponApplied', (event) => enqueue('coupon_applied', detailOf(event) ?? {}));
  window.addEventListener('autonnel:couponRemoved', (event) => enqueue('coupon_removed', detailOf(event) ?? {}));
  window.addEventListener('autonnel:upsellAccepted', () => enqueue('upsell_accept'));
  window.addEventListener('autonnel:upsellDeclined', () => enqueue('upsell_decline'));
  window.addEventListener('autonnel:paymentMethodSelected', (event) =>
    enqueue('payment_method_selected', { method: detailOf(event)?.method ?? null }),
  );
  window.addEventListener('autonnel:checkoutSubmit', (event) => {
    const detail = detailOf(event);
    enqueue('payment_submit', { hasBuyer: !!detail });
    if (detail?.address1 && detail?.city && detail?.postalCode) enqueue('shipping_submitted');
  });
  window.addEventListener('autonnel:paypalCreateOrder', () =>
    enqueue('payment_button_click', { provider: 'paypal' }),
  );
  window.addEventListener('autonnel:paymentButtonClick', (event) =>
    enqueue('payment_button_click', { provider: detailOf(event)?.provider ?? null }),
  );
  window.addEventListener('autonnel:paymentComplete', (event) => {
    const detail = detailOf(event);
    enqueue('payment_success', {
      orderId: detail?.orderId ?? null,
      provider: detail?.provider ?? null,
    });
  });
  window.addEventListener('autonnel:showPaymentError', (event) => {
    const detail = detailOf(event);
    enqueue('payment_error', {
      message: detail?.message ?? null,
      provider: detail?.provider ?? null,
      code: detail?.code ?? null,
    });
  });
}

try {
  setupErrorCapture();
} catch {
  // tracking must never throw into the page
}

function start(): void {
  setupCustomEvents();
  setupLeaveCapture();
  propagateTracking();

  enqueue('page_view', { title: document.title, clickIds: collectClickIds() });
  const stepType = stepId?.toLowerCase();
  if (stepType === 'checkout') enqueue('checkout_view');
  if (stepType === 'upsell') enqueue('upsell_view');
}

try {
  start();
} catch {
  // tracking must never throw into the page
}

export {};
