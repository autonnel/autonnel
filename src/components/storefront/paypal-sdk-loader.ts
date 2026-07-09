interface PayPalSdkConfig {
  baseParams: string;
  currency: string;
}

declare global {
  interface Window {
    __PAYPAL_SDK_CONFIG__?: PayPalSdkConfig;
    __PAYPAL_SDK_READY__?: boolean;
    __PAYPAL_SDK_CURRENCY__?: string | null;
  }
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 3000;

function buildSdkUrl(baseParams: string, currency: string): string {
  return 'https://www.paypal.com/sdk/js?' + baseParams + '&currency=' + currency;
}

function loadPayPalSDK(baseParams: string, currency: string, attempt: number): void {
  window.dispatchEvent(
    new CustomEvent('paypal-sdk-status', {
      detail: { status: 'loading', attempt, maxRetries: MAX_RETRIES, currency },
    }),
  );

  const script = document.createElement('script');
  script.src = buildSdkUrl(baseParams, currency);
  // paypal.com/sdk/js serves Access-Control-Allow-Origin:*, so anonymous CORS lets the
  // browser surface real SDK errors instead of an opaque "Script error." (see masked-error.ts).
  script.crossOrigin = 'anonymous';
  script.setAttribute('data-sdk-integration-source', 'button-factory');

  script.onload = function () {
    window.__PAYPAL_SDK_READY__ = true;
    window.__PAYPAL_SDK_CURRENCY__ = currency;
    window.dispatchEvent(new Event('paypal-sdk-ready'));
  };

  script.onerror = function () {
    if (script.parentNode) {
      script.parentNode.removeChild(script);
    }
    if (attempt < MAX_RETRIES) {
      window.dispatchEvent(
        new CustomEvent('paypal-sdk-status', {
          detail: {
            status: 'retrying',
            attempt,
            maxRetries: MAX_RETRIES,
            nextIn: RETRY_DELAY,
            currency,
          },
        }),
      );
      setTimeout(function () {
        loadPayPalSDK(baseParams, currency, attempt + 1);
      }, RETRY_DELAY);
    } else {
      window.dispatchEvent(
        new CustomEvent('paypal-sdk-status', {
          detail: { status: 'failed', attempt, maxRetries: MAX_RETRIES, currency },
        }),
      );
    }
  };

  document.head.appendChild(script);
}

export function initPayPalSdkLoader(): void {
  const config = window.__PAYPAL_SDK_CONFIG__;
  if (!config) return;
  loadPayPalSDK(config.baseParams, config.currency, 1);
}
