interface CheckoutState {
  customerInfo: CustomerInfo | null;
  shippingAddress: ShippingAddress | null;
  currentOrderId: string | null;
}

interface CustomerInfo {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

interface ShippingAddress {
  address1: string;
  address2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
}

interface CartLine {
  productId: string;
  variantExternalId: string;
  quantity: number;
  priceMinor: number;
  currency: string;
  title: string;
}

interface BuyerBody {
  fullName?: string;
  email?: string;
  phone?: string;
  address?: {
    line1: string;
    line2?: string;
    city: string;
    region?: string;
    countryCode: string;
    postalCode: string;
  };
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
  ensureOrder(buyer?: BuyerBody): Promise<EnsuredOrder | null>;
  getState(): CheckoutState;
}

const ORCHESTRATED_TYPES = new Set(['CHECKOUT', 'UPSELL']);

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

function getFormValue(name: string): string {
  const el = document.querySelector(`[name="${name}"]`) as HTMLInputElement | HTMLSelectElement | null;
  return el ? (el.value || '').trim() : '';
}

function readCustomerFromForm(): CustomerInfo | null {
  const email = getFormValue('email');
  const firstName = getFormValue('firstName');
  const lastName = getFormValue('lastName');
  if (!email || !firstName || !lastName) return null;
  return { email, firstName, lastName, phone: getFormValue('phone') || undefined };
}

function readAddressFromForm(): ShippingAddress | null {
  const address1 = getFormValue('address1');
  const city = getFormValue('city');
  const postalCode = getFormValue('postalCode');
  if (!address1 || !city || !postalCode) return null;
  return {
    address1,
    address2: getFormValue('address2') || undefined,
    city,
    state: getFormValue('state') || undefined,
    postalCode,
    country: getFormValue('country') || 'US',
  };
}

function buyerFromState(state: CheckoutState): BuyerBody {
  const info = state.customerInfo;
  const addr = state.shippingAddress;
  const fullName = info ? `${info.firstName} ${info.lastName}`.trim() : '';
  const buyer: BuyerBody = {
    fullName: fullName || undefined,
    email: info?.email,
    phone: info?.phone,
  };
  if (addr) {
    buyer.address = {
      line1: addr.address1,
      line2: addr.address2,
      city: addr.city,
      region: addr.state,
      countryCode: addr.country || 'US',
      postalCode: addr.postalCode,
    };
  }
  return buyer;
}

class CheckoutOrchestrator {
  private readonly stepSlug: string;
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
  private processingOverlay: HTMLElement | null = null;

  constructor(stepSlug: string) {
    this.stepSlug = stepSlug;
    this.state = window.__CHECKOUT_STATE__ ?? { customerInfo: null, shippingAddress: null, currentOrderId: null };
    window.__CHECKOUT_STATE__ = this.state;
  }

  start(): void {
    window.Autonnel = window.Autonnel || {};
    window.Autonnel.checkout = {
      ensureOrder: (buyer) => this.ensureOrder(buyer),
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

    // Selectors that mounted before us will re-broadcast their current selection.
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
      for (const line of this.cart) {
        const res = await postJson<{ error?: string; message?: string }>('/api/checkout/cart', {
          variantExternalId: line.variantExternalId,
          quantity: line.quantity,
        });
        if (!res.ok) {
          this.cartError = res.data?.message || res.data?.error || 'This product is not available for purchase.';
          warn('Cart add failed', { variant: line.variantExternalId, status: res.status, error: this.cartError });
        }
      }
      this.syncedSignature = signature;
    } catch (err) {
      warn('Session sync error', err);
    }
  }

  async ensureOrder(buyer?: BuyerBody, provider: 'STRIPE' | 'PAYPAL' = 'STRIPE'): Promise<EnsuredOrder | null> {
    if (this.ensuredByProvider[provider]) return this.ensuredByProvider[provider];
    if (this.orderPromiseByProvider[provider]) return this.orderPromiseByProvider[provider]!;

    const promise = (async () => {
      this.syncFormIntoState();
      await this.waitForCart(3000);
      if (this.cart.length === 0) {
        const message = this.cartError || 'Please choose a product before continuing to payment.';
        warn('Submit aborted: empty cart');
        window.dispatchEvent(new CustomEvent('autonnel:showPaymentError', { detail: { message } }));
        this.orderPromiseByProvider[provider] = undefined;
        return null;
      }
      await this.syncSession();
      const resolvedBuyer = buyer ?? buyerFromState(this.state);
      const res = await postJson<{ saleRef?: string; clientHandle?: string; error?: string }>(
        '/api/checkout/submit',
        { buyer: resolvedBuyer, captureMethod: 'automatic', provider },
      );
      if (!res.ok || !res.data.saleRef) {
        const message =
          this.cartError ||
          res.data.error ||
          'We could not start your order. Please check the items and try again.';
        warn('Submit failed', { status: res.status, error: res.data.error, cartError: this.cartError });
        window.dispatchEvent(new CustomEvent('autonnel:showPaymentError', { detail: { message } }));
        this.orderPromiseByProvider[provider] = undefined;
        return null;
      }
      this.cartError = null;
      const ensured: EnsuredOrder = { orderId: res.data.saleRef, clientHandle: res.data.clientHandle ?? '' };
      this.ensuredByProvider[provider] = ensured;
      this.state.currentOrderId = ensured.orderId;
      log('Order ensured', { orderId: ensured.orderId, provider });
      return ensured;
    })();

    this.orderPromiseByProvider[provider] = promise;
    return promise;
  }

  // Full-screen "processing" overlay shown after payment authorization while the server captures
  // and materializes the order, until the thank-you redirect. Covers every payment widget uniformly.
  private showProcessing(): void {
    if (this.processingOverlay) { this.processingOverlay.style.display = 'flex'; return; }
    const text = (window as { __CHECKOUT_PROCESSING_TEXT__?: string }).__CHECKOUT_PROCESSING_TEXT__ || 'Processing your order…';
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
            detail: { message: res.data.error || 'Payment failed. Please try again.' },
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
    log('Redirecting after payment', { target });
    window.location.href = target;
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
  new CheckoutOrchestrator(stepSlug).start();
}

boot();

export {};
