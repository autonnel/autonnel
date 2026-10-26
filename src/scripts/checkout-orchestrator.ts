import { withPropagatedParams } from '@/lib/analytics/link-params';
import { translateCheckoutMessage } from '@/components/builder/checkout-messages';
import { t } from '@/components/builder/translations';
import { bindPreselection } from './checkout-preselection';
import {
  buyerFromState,
  readAddressFromForm,
  readCustomerFromForm,
  type BuyerBody,
  type CheckoutState,
} from './checkout-buyer';

interface CartLine {
  productId: string;
  variantExternalId: string;
  quantity: number;
  priceMinor: number;
  currency: string;
  title: string;
}

interface EnsuredOrder {
  orderId: string;
  clientHandle: string;
}

interface SelectedProductDetail {
  id: string;
  productId: string;
  productName?: string;
  variantName?: string;
  price: number;
  quantity?: number;
  currency?: string;
}

declare global {
  interface Window {
    __AUTONNEL_PAGE_TYPE__?: string;
    __AUTONNEL_PAGE_SLUG__?: string;
    __AUTONNEL_PAGE_ID__?: string;
    __AUTONNEL_FUNNEL_ID__?: string | null;
    __AUTONNEL_PRODUCTS__?: CartLine[];
    __FUNNEL_NEXT_STEP_URL__?: string | null;
    __CHECKOUT_STATE__?: CheckoutState;
    Autonnel?: {
      checkout?: CheckoutApi;
      trackingId?: string;
      [key: string]: unknown;
    };
  }
}

interface CheckoutApi {
  ensureOrder(buyer?: BuyerBody, provider?: string): Promise<EnsuredOrder | null>;
  getState(): CheckoutState;
}

const ORCHESTRATED_TYPES = new Set(['CHECKOUT', 'UPSELL']);

function pageLanguage(): string {
  return document.querySelector('.landing-page')?.getAttribute('data-language') || 'en';
}

function log(message: string, detail?: unknown): void {
  if (detail === undefined) console.log(`[CheckoutOrchestrator] ${message}`);
  else console.log(`[CheckoutOrchestrator] ${message}`, detail);
}

function warn(message: string, detail?: unknown): void {
  if (detail === undefined) console.warn(`[CheckoutOrchestrator] ${message}`);
  else console.warn(`[CheckoutOrchestrator] ${message}`, detail);
}

async function postJson<T>(path: string, body: unknown): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, data };
}

function toCartLine(item: SelectedProductDetail, currency: string): CartLine {
  return {
    productId: item.productId,
    variantExternalId: item.id,
    quantity: item.quantity && item.quantity > 0 ? item.quantity : 1,
    priceMinor: Math.round((item.price || 0) * 100),
    currency: item.currency || currency,
    title: [item.productName, item.variantName].filter(Boolean).join(' - ') || item.productName || '',
  };
}


class CheckoutOrchestrator {
  private readonly stepSlug: string;
  private readonly pageType: string;
  private state: CheckoutState;
  private cart: CartLine[] = [];
  private syncedSignature = '';
  private syncChain: Promise<void> = Promise.resolve();
  private sessionReady = false;
  // Stripe and PayPal each need their own intent/handle on the same Sale, so cache per provider:
  // Stripe -> client_secret, PayPal -> PayPal order id (returned as clientHandle).
  private orderPromiseByProvider: Record<string, Promise<EnsuredOrder | null> | undefined> = {};
  private ensuredByProvider: Record<string, EnsuredOrder> = {};
  private cartError: string | null = null;
  private cartErrorReason: string | null = null;
  private processingOverlay: HTMLElement | null = null;

  constructor(stepSlug: string, pageType: string) {
    this.stepSlug = stepSlug;
    this.pageType = pageType;
    this.state = window.__CHECKOUT_STATE__ ?? { customerInfo: null, shippingAddress: null, currentOrderId: null };
    window.__CHECKOUT_STATE__ = this.state;
  }

  start(): void {
    window.Autonnel = window.Autonnel || {};
    window.Autonnel.checkout = {
      ensureOrder: (buyer, provider) => this.ensureOrder(buyer, provider),
      getState: () => this.state,
    };

    window.addEventListener('autonnel:productsSelected', this.onProductsSelected as EventListener);
    window.addEventListener('autonnel:checkoutSubmit', this.onCheckoutSubmit as EventListener);
    window.addEventListener('autonnel:addressChange', this.onAddressChange as EventListener);
    window.addEventListener('autonnel:paypalCreateOrder', this.onPaypalCreateOrder as EventListener);
    window.addEventListener('autonnel:paypalApproved', this.onPaypalApproved as EventListener);
    window.addEventListener('autonnel:paymentComplete', this.onPaymentComplete as EventListener);
    window.addEventListener('autonnel:paymentProcessing', this.onPaymentProcessing as EventListener);
    window.addEventListener('autonnel:showPaymentError', this.onShowPaymentError as EventListener);
    window.addEventListener('autonnel:couponApplied', this.onCouponApplied as EventListener);
    window.addEventListener('autonnel:couponRemoved', this.onCouponRemoved as EventListener);

    // Server-resolved ?variant= rows seed the cart first; a selector that mounted before us
    // re-broadcasts on the request below and takes over.
    bindPreselection(window);
    window.dispatchEvent(new CustomEvent('autonnel:requestProductSelection'));
    log('Started', { stepSlug: this.stepSlug });
  }

  private onProductsSelected = (event: CustomEvent): void => {
    const detail = event.detail || {};
    const products = (detail.products || []) as SelectedProductDetail[];
    const currency = detail.currency || 'USD';
    this.cart = products.filter((p) => p && p.id && p.price > 0).map((p) => toCartLine(p, currency));
    window.__AUTONNEL_PRODUCTS__ = this.cart;
    void this.syncSession();
  };

  private onCheckoutSubmit = (event: CustomEvent): void => {
    const d = event.detail || {};
    if (d.email && d.firstName && d.lastName) {
      this.state.customerInfo = {
        email: d.email,
        firstName: d.firstName,
        lastName: d.lastName,
        phone: d.phone || undefined,
      };
    }
    if (d.address1 && d.city && d.postalCode) {
      this.state.shippingAddress = {
        address1: d.address1,
        address2: d.address2 || undefined,
        city: d.city,
        state: d.state || undefined,
        postalCode: d.postalCode,
        country: d.country || 'US',
      };
    }
  };

  private onAddressChange = (event: CustomEvent): void => {
    const form = (event.detail || {}).formData as Record<string, string> | undefined;
    if (!form) return;
    if (form.email && form.firstName && form.lastName) {
      this.state.customerInfo = {
        email: form.email,
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone || undefined,
      };
    }
    if (form.address1 && form.city && form.postalCode) {
      this.state.shippingAddress = {
        address1: form.address1,
        address2: form.address2 || undefined,
        city: form.city,
        state: form.state || undefined,
        postalCode: form.postalCode,
        country: form.country || 'US',
      };
    }
  };

  private syncFormIntoState(): void {
    const customer = readCustomerFromForm();
    if (customer) this.state.customerInfo = customer;
    const address = readAddressFromForm();
    if (address) this.state.shippingAddress = address;
  }

  private cartSignature(): string {
    return JSON.stringify(this.cart.map((l) => [l.variantExternalId, l.quantity]));
  }

  // Cart selection arrives from the VariantSelector island, which hydrates after this script
  // boots. A buyer who clicks PayPal Express immediately can reach submit before any selection
  // broadcast — re-request it and wait briefly so we never submit an empty cart.
  private waitForCart(timeoutMs: number): Promise<void> {
    if (this.cart.length > 0) return Promise.resolve();
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        window.removeEventListener('autonnel:productsSelected', onSelected);
        clearTimeout(timer);
        resolve();
      };
      const onSelected = () => {
        if (this.cart.length > 0) finish();
      };
      window.addEventListener('autonnel:productsSelected', onSelected);
      const timer = setTimeout(finish, timeoutMs);
      window.dispatchEvent(new CustomEvent('autonnel:requestProductSelection'));
    });
  }

  // Cart mutations run on a serial chain so concurrent callers (selection change + ensureOrder)
  // never add the same line twice and an awaiting caller blocks until the server cart is filled.
  private syncSession(): Promise<void> {
    const next = this.syncChain.catch(() => {}).then(() => this.runSyncOnce());
    this.syncChain = next;
    return next;
  }

  private async runSyncOnce(): Promise<void> {
    // An upsell acts on the session that paid the first order; a fresh session would replace its cookie.
    if (this.pageType === 'UPSELL') return;
    if (this.cart.length === 0) return;
    const signature = this.cartSignature();
    if (signature === this.syncedSignature) return;
    try {
      if (!this.sessionReady) {
        const session = await postJson('/api/checkout/session', { stepSlug: this.stepSlug });
        if (!session.ok) {
          warn('Session create failed (continuing best-effort)', session.status);
          return;
        }
        this.sessionReady = true;
      }
      this.cartError = null;
      this.cartErrorReason = null;
      // The first line replaces the server cart so a changed selection never accumulates lines.
      const rejected = new Set<string>();
      for (const [index, line] of this.cart.entries()) {
        const res = await postJson<{ error?: string; message?: string }>('/api/checkout/cart', {
          variantExternalId: line.variantExternalId,
          quantity: line.quantity,
          replace: index === 0,
        });
        if (!res.ok) {
          this.cartErrorReason = res.data?.message || res.data?.error || t('en', 'checkout.productUnavailable');
          this.cartError = translateCheckoutMessage(pageLanguage(), this.cartErrorReason, 'checkout.productUnavailable');
          warn('Cart add failed', { variant: line.variantExternalId, status: res.status, error: this.cartError });
          rejected.add(line.variantExternalId);
        }
      }
      this.syncedSignature = signature;
      if (rejected.size > 0) this.dropRejectedLines(rejected);
    } catch (err) {
      warn('Session sync error', err);
    }
  }

  // A line the server refused is not in the server cart, so it must not stay on display either.
  private dropRejectedLines(rejected: Set<string>): void {
    if (this.cartSignature() !== this.syncedSignature) return;
    this.cart = this.cart.filter((l) => !rejected.has(l.variantExternalId));
    window.__AUTONNEL_PRODUCTS__ = this.cart;
    this.syncedSignature = this.cartSignature();
    for (const variantId of rejected) {
      window.dispatchEvent(new CustomEvent('autonnel:cartLineRejected', { detail: { variantId, message: this.cartError } }));
    }
  }

  async ensureOrder(buyer?: BuyerBody, provider: string = 'STRIPE'): Promise<EnsuredOrder | null> {
    if (this.ensuredByProvider[provider]) return this.ensuredByProvider[provider];
    if (this.orderPromiseByProvider[provider]) return this.orderPromiseByProvider[provider]!;

    const promise = (async () => {
      this.syncFormIntoState();
      await this.waitForCart(3000);
      if (this.cart.length === 0) {
        const message = this.cartError || t(pageLanguage(), 'checkout.chooseProduct');
        const reason = this.cartErrorReason || t('en', 'checkout.chooseProduct');
        warn('Submit aborted: empty cart');
        window.dispatchEvent(new CustomEvent('autonnel:showPaymentError', { detail: { message, reason } }));
        this.orderPromiseByProvider[provider] = undefined;
        return null;
      }
      await this.syncSession();
      const resolvedBuyer = buyer ?? buyerFromState(this.state);
      const res = await postJson<{ saleRef?: string; clientHandle?: string; error?: string; message?: string }>(
        '/api/checkout/submit',
        {
          buyer: resolvedBuyer,
          captureMethod: 'automatic',
          provider,
          locale: document.querySelector('.landing-page')?.getAttribute('data-language') ?? undefined,
          ...this.returnTargets(),
        },
      );
      if (!res.ok || !res.data.saleRef) {
        // `message` first: it carries the actual reason. `reason` keeps the untranslated text and is
        // what lands in the payment_error analytics row; `error` alone is an opaque code like
        // "checkout_failed", which makes a live outage indistinguishable from a bad coupon.
        const reason =
          this.cartErrorReason || res.data.message || res.data.error || t('en', 'checkout.startFailed');
        const message =
          this.cartError ||
          translateCheckoutMessage(pageLanguage(), res.data.message || res.data.error, 'checkout.startFailed');
        warn('Submit failed', { status: res.status, error: res.data.error, cartError: this.cartError });
        window.dispatchEvent(new CustomEvent('autonnel:showPaymentError', { detail: { message, reason } }));
        this.orderPromiseByProvider[provider] = undefined;
        return null;
      }
      this.cartError = null;
      this.cartErrorReason = null;
      const ensured: EnsuredOrder = { orderId: res.data.saleRef, clientHandle: res.data.clientHandle ?? '' };
      this.ensuredByProvider[provider] = ensured;
      this.state.currentOrderId = ensured.orderId;
      log('Order ensured', { orderId: ensured.orderId, provider });
      return ensured;
    })();

    this.orderPromiseByProvider[provider] = promise;
    return promise;
  }

  // Hosted-page providers bounce the buyer back through the server; these are the same-site paths
  // to continue to (next funnel step) or to retry from (this page).
  private returnTargets(): { returnTo?: string; cancelTo: string; pageId?: string; funnelId?: string } {
    const cancelTo = `${window.location.pathname}${window.location.search}`;
    const nextRaw = window.__FUNNEL_NEXT_STEP_URL__;
    let returnTo: string | undefined;
    if (nextRaw) {
      const u = new URL(withPropagatedParams(nextRaw), window.location.origin);
      const trackingId = window.Autonnel?.trackingId;
      if (trackingId && !u.searchParams.has('trackingId')) u.searchParams.set('trackingId', String(trackingId));
      if (u.origin === window.location.origin) returnTo = `${u.pathname}${u.search}`;
    }
    return { returnTo, cancelTo, pageId: window.__AUTONNEL_PAGE_ID__, funnelId: window.__AUTONNEL_FUNNEL_ID__ ?? undefined };
  }

  // Full-screen "processing" overlay shown after payment authorization while the server captures
  // and materializes the order, until the thank-you redirect. Covers every payment widget uniformly.
  private showProcessing(): void {
    if (this.processingOverlay) { this.processingOverlay.style.display = 'flex'; return; }
    const text = (window as { __CHECKOUT_PROCESSING_TEXT__?: string }).__CHECKOUT_PROCESSING_TEXT__ || t(pageLanguage(), 'checkout.processingOrder');
    const overlay = document.createElement('div');
    overlay.setAttribute('data-autonnel-processing', '');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,0.55);';
    const card = document.createElement('div');
    card.style.cssText = 'background:#fff;border-radius:14px;padding:28px 36px;display:flex;flex-direction:column;align-items:center;gap:14px;box-shadow:0 10px 40px rgba(0,0,0,0.25);max-width:90vw;';
    const spinner = document.createElement('div');
    spinner.style.cssText = 'width:42px;height:42px;border:4px solid #e5e7eb;border-top-color:#2563eb;border-radius:50%;animation:autonnel-spin .8s linear infinite;';
    const label = document.createElement('div');
    label.style.cssText = 'font:600 15px/1.4 system-ui,-apple-system,sans-serif;color:#0f172a;text-align:center;';
    label.textContent = text;
    const style = document.createElement('style');
    style.textContent = '@keyframes autonnel-spin{to{transform:rotate(360deg)}}';
    card.appendChild(spinner);
    card.appendChild(label);
    overlay.appendChild(card);
    overlay.appendChild(style);
    document.body.appendChild(overlay);
    this.processingOverlay = overlay;
  }

  private hideProcessing(): void {
    if (this.processingOverlay) this.processingOverlay.style.display = 'none';
  }

  private onPaymentProcessing = (event: CustomEvent): void => {
    if ((event.detail || {}).active === false) this.hideProcessing();
    else this.showProcessing();
  };

  private onShowPaymentError = (): void => {
    this.hideProcessing();
  };

  private onPaypalCreateOrder = (): void => {
    void (async () => {
      const ensured = await this.ensureOrder(undefined, 'PAYPAL');
      // PayPal's createOrder must receive the PayPal order id (clientHandle), NOT the autonnel saleRef.
      if (ensured && ensured.clientHandle) {
        window.dispatchEvent(new CustomEvent('autonnel:paypalOrderCreated', { detail: { orderId: ensured.clientHandle } }));
      } else {
        window.dispatchEvent(
          new CustomEvent('autonnel:paypalOrderCreated', { detail: { error: 'Failed to create order' } }),
        );
      }
    })();
  };

  private onPaypalApproved = (event: CustomEvent): void => {
    const detail = event.detail || {};
    const orderId = this.ensuredByProvider['PAYPAL']?.orderId || this.state.currentOrderId;
    if (!orderId) {
      warn('PayPal approved without an order');
      return;
    }
    this.showProcessing();
    void (async () => {
      const res = await postJson<{ success?: boolean; redirectUrl?: string; error?: string }>(
        '/api/shop/payment/paypal',
        {
          action: 'approved',
          orderId,
          trackingId: window.Autonnel?.trackingId,
          paypalOrderId: detail.orderId,
          payerId: detail.payerId,
          funnelId: window.__AUTONNEL_FUNNEL_ID__ ?? undefined,
          pageId: window.__AUTONNEL_PAGE_ID__,
        },
      );
      if (res.ok && res.data.success) {
        window.dispatchEvent(
          new CustomEvent('autonnel:paymentComplete', {
            detail: { orderId, redirectUrl: res.data.redirectUrl },
          }),
        );
      } else {
        warn('PayPal approve capture failed', { status: res.status, error: res.data.error });
        window.dispatchEvent(
          new CustomEvent('autonnel:showPaymentError', {
            detail: {
              message: translateCheckoutMessage(pageLanguage(), res.data.error, 'payment.failedTryAgain'),
              reason: res.data.error || t('en', 'payment.failedTryAgain'),
            },
          }),
        );
      }
    })();
  };

  private onPaymentComplete = (event: CustomEvent): void => {
    const detail = event.detail || {};
    const redirectUrl = detail.redirectUrl as string | undefined;
    const base = redirectUrl && /^https?:\/\//i.test(redirectUrl)
      ? redirectUrl
      : redirectUrl || window.__FUNNEL_NEXT_STEP_URL__ || '';
    if (!base) {
      warn('Payment complete but no redirect target');
      return;
    }
    // The next step (thank-you) reads ?orderId to render the order; carry it through since the
    // backend-driven redirect target is a bare page slug, not a stepSlug round-trip.
    const orderId = (detail.orderId as string | undefined) || this.state.currentOrderId;
    let target = base;
    try {
      const u = new URL(base, window.location.origin);
      if (orderId && !u.searchParams.has('orderId')) u.searchParams.set('orderId', orderId);
      const trackingId = window.Autonnel?.trackingId;
      if (trackingId && !u.searchParams.has('trackingId')) u.searchParams.set('trackingId', String(trackingId));
      target = u.toString();
    } catch {
      // Non-URL target (unexpected) — fall back to the raw value.
    }
    const finalTarget = withPropagatedParams(target);
    log('Redirecting after payment', { target: finalTarget });
    window.location.href = finalTarget;
  };

  private onCouponApplied = (event: CustomEvent): void => {
    const code = (event.detail || {}).code as string | undefined;
    if (!code || !this.sessionReady) return;
    void postJson('/api/checkout/coupon', { code }).catch(() => {});
  };

  private onCouponRemoved = (): void => {
    if (!this.sessionReady) return;
    void postJson('/api/checkout/coupon', { code: '' }).catch(() => {});
  };
}

function boot(): void {
  const pageType = window.__AUTONNEL_PAGE_TYPE__;
  if (!pageType || !ORCHESTRATED_TYPES.has(pageType)) return;
  const stepSlug = window.__AUTONNEL_PAGE_SLUG__ || '';
  if (!stepSlug) {
    warn('Missing page slug; checkout orchestration disabled');
    return;
  }
  new CheckoutOrchestrator(stepSlug, pageType).start();
}

boot();

export {};
