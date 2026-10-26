import { isMaskedCrossOriginError } from './masked-error';
import { createAttentionTracker, TICK_MS, type AttentionTracker } from './attention';
import { toCustomKind } from '@/lib/analytics/custom-event-name';
import { createCustomEventTracker, findCustomEventName } from './custom-events';
import { startLinkParamPropagation } from './link-propagation';

declare global {
  interface Window {
    __AUTONNEL_TENANT_ID__?: string;
    __AUTONNEL_API_BASE__?: string;
    __AUTONNEL_PAGE_ID__?: string;
    __AUTONNEL_FUNNEL_ID__?: string | null;
    __AUTONNEL_FUNNEL_PAGE_TYPE__?: string | null;
    __AUTONNEL_STEP_INDEX__?: number;
    __AUTONNEL_SERVER_ANID__?: string;
    __AUTONNEL_NO_TRACK__?: boolean;
    autonnel?: { track(name: unknown, metadata?: unknown): void };
  }
}

const ANID_COOKIE = 'anid';
const SESSION_KEY = 'autonnel:sid';
const QUEUE_CAP = 50;
const FLUSH_DELAY_MS = 2000;
const STACK_MAX = 1000;
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const CLICK_ID_KEYS = ['fbclid', 'gclid', 'gbraid', 'wbraid', 'ttclid', 'msclkid'];

// Set by the admin draft preview route and by the ?_ad= depth deep link. Both
// are an operator looking at their own page, and counting that as a visit
// pollutes exactly the panels they opened the page to check. Read before any
// identity resolution so no-track pages never mint or persist an anid cookie.
const noTrack = window.__AUTONNEL_NO_TRACK__ === true;

function readCookie(name: string): string {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : '';
}

function writeCookie(name: string, value: string): void {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
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
    if (!noTrack) sessionStorage.setItem(SESSION_KEY, generated);
    return generated;
  } catch {
    return randomId();
  }
}

const visitorId = resolveVisitorId();
if (!noTrack) writeCookie(ANID_COOKIE, visitorId);
const sessionId = resolveSessionId();
const funnelId = window.__AUTONNEL_FUNNEL_ID__ || null;
const pageId = window.__AUTONNEL_PAGE_ID__ || null;
const stepId = window.__AUTONNEL_FUNNEL_PAGE_TYPE__ || null;
const loadedAt = Date.now();
let attention: AttentionTracker | null = null;

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
  const metadata: Record<string, unknown> = { timeOnPageMs: Date.now() - loadedAt };
  // Omitted rather than sent empty on failure, so the server can tell "nothing
  // measured" from "measured, saw nothing".
  try {
    if (attention) metadata.engagement = attention.snapshot();
  } catch {
    // tracking must never throw into the page
  }
  enqueue('page_leave', metadata);
  flush();
}

// page_leave is once per page load, but the queue has to drain on every exit: a visitor who
// backgrounded the tab once already burned fireLeave's guard, so a later CTA click would sit in
// the queue until the flush delay the navigation never waits for. flush() is a no-op when empty.
function drainOnExit(): void {
  fireLeave();
  flush();
}

function setupLeaveCapture(): void {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') drainOnExit();
  });
  window.addEventListener('pagehide', drainOnExit);
}

function setupAttentionCapture(): void {
  const tracker = createAttentionTracker();
  attention = tracker;
  tracker.sampleScroll(); // baseline: a page shorter than the viewport is fully seen

  let rafPending = false;
  window.addEventListener('scroll', () => {
    if (rafPending) return;
    rafPending = true;
    const raf = window.requestAnimationFrame || ((cb: FrameRequestCallback) => window.setTimeout(cb, 16));
    raf(() => {
      rafPending = false;
      tracker.sampleScroll();
    });
  }, { passive: true });

  // A ticker rather than a scroll listener: a visitor who stops to read is not
  // scrolling, and that is precisely the attention being measured.
  setInterval(() => tracker.tick(), TICK_MS);
  document.addEventListener('visibilitychange', () => tracker.tick());

  // Capture phase, so a handler that stops propagation cannot hide the click.
  // The most heavily wired elements on a landing page are exactly the CTAs
  // this is here to count.
  document.addEventListener('click', (ev) => {
    let el = ev.target as HTMLElement | null;
    for (let d = 0; d < 6 && el && el.tagName; d += 1) {
      const tag = el.tagName.toLowerCase();
      if (tag === 'a' || tag === 'button' || el.getAttribute?.('role') === 'button') {
        tracker.note('cta');
        return;
      }
      if (tag === 'summary') {
        tracker.note('expand');
        return;
      }
      el = el.parentElement;
    }
  }, true);

  // play does not bubble, so capture is the only way to see it without
  // attaching to every video on the page.
  document.addEventListener('play', () => tracker.note('video'), true);
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
      message: detail?.reason ?? detail?.message ?? null,
      provider: detail?.provider ?? null,
      code: detail?.code ?? null,
    });
  });
}

function setupAuthorDefinedEvents(): void {
  const tracker = createCustomEventTracker({
    emit: (name, metadata) => enqueue(toCustomKind(name), metadata),
    warn: (message) => console.warn(message),
  });

  window.autonnel = { track: tracker.track };

  document.addEventListener('click', (ev) => {
    const name = findCustomEventName(ev.target);
    if (name) tracker.track(name);
  }, true);
}

// Runs even under noTrack: keeping ad params on outgoing links is navigation
// correctness, not analytics, and a preview must not hand out stripped links.
try {
  startLinkParamPropagation();
} catch {
  // tracking must never throw into the page
}

try {
  if (!noTrack) setupErrorCapture();
} catch {
  // tracking must never throw into the page
}

function start(): void {
  setupCustomEvents();
  setupAuthorDefinedEvents();
  setupAttentionCapture();
  setupLeaveCapture();

  enqueue('page_view', { title: document.title, clickIds: collectClickIds() });
  const stepType = stepId?.toLowerCase();
  if (stepType === 'checkout') enqueue('checkout_view');
  if (stepType === 'upsell') enqueue('upsell_view');
}

// Preview and depth-deep-link loads never start the tracker, but page code that calls
// window.autonnel.track() must not throw there.
if (noTrack) window.autonnel = { track: () => {} };

try {
  if (!noTrack) start();
} catch {
  // tracking must never throw into the page
}

export {};
