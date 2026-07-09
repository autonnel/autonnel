import { getTenantPrisma } from '@/modules/platform/infra/prisma-tenant-extension';
import { resolveFunnelCtaLinksInPuckData } from '@/lib/puck/resolve-funnel-cta-links';
import { migratePuckData } from '@/components/builder/migrate-keys';
import { createLogger } from '@/lib/logger';
import { getGoogleMapsApiKey } from '@/lib/config/keys';
import {
  getTenantInfo,
  findPage,
  getFunnelContext,
  getGlobalScripts,
  getFunnelScripts,
  getPaymentConfig,
  extractScriptsFromHtml,
  extractProductCurrencyFromPuckData,
  getProductImageMap,
  type TenantInfo,
  type PaymentConfigPublic,
  type StorefrontScript,
} from './storefront-data.loaders';

export * from './storefront-data.loaders';

const logger = createLogger('Storefront');

export interface StorefrontPageData {
  tenant: TenantInfo;
  page: any;
  puckData: any;
  resolvedPuckData: any;
  htmlContent: string;
  htmlScripts: string[];
  pageSettings: any;
  pageHeadContent: string;
  pageCssContent: string;
  pageBodyScripts: string;
  meta: any;
  pageTitle: string;
  pageDescription: string;
  funnelCtaUrl: string;
  funnelId: string | null;
  funnelPageType: string | null;
  stepIndex: number;
  paymentConfig: PaymentConfigPublic;
  headScripts: StorefrontScript[];
  bodyStartScripts: StorefrontScript[];
  bodyEndScripts: StorefrontScript[];
  funnelHeadScripts: StorefrontScript[];
  funnelBodyStartScripts: StorefrontScript[];
  funnelBodyEndScripts: StorefrontScript[];
  googleMapsApiKey: string;
}

export async function getStorefrontPageData(
  pageSlug: string,
  funnelIdFromQuery: string | null
): Promise<StorefrontPageData | null> {
  const [tenant, page, scripts, googleMapsApiKey] = await Promise.all([
    getTenantInfo(),
    findPage(pageSlug),
    getGlobalScripts(),
    getGoogleMapsApiKey(),
  ]);
  if (!tenant) return null;
  if (!page) return null;

  const puckData = migratePuckData(page.publishedData || page.draftData);
  const effectiveHtml = page.htmlContent;
  const effectiveSettings = page.settings;
  const pageSettings = (effectiveSettings as any) || {};
  const meta = (page.meta as any) || {};

  const [funnelContext, paymentConfig] = await Promise.all([
    getFunnelContext(page.id, funnelIdFromQuery),
    getPaymentConfig(page.type),
  ]);

  const funnelScripts = await getFunnelScripts(funnelContext.funnelId);

  const resolvedPuckData = resolveFunnelCtaLinksInPuckData(puckData, funnelContext.stepUrl);

  if (paymentConfig.paypal && puckData) {
    const productCurrency = extractProductCurrencyFromPuckData(puckData);
    logger.info('PayPal currency resolution', {
      configCurrency: paymentConfig.paypal.currency,
      productCurrency: productCurrency || 'none',
      pageType: page.type,
    });
    if (productCurrency) {
      paymentConfig.paypal.currency = productCurrency;
    }
  }

  const { htmlWithoutScripts, scripts: htmlScripts } = extractScriptsFromHtml(effectiveHtml || '');

  return {
    tenant,
    page,
    puckData,
    resolvedPuckData,
    htmlContent: htmlWithoutScripts,
    htmlScripts,
    pageSettings,
    pageHeadContent: pageSettings.headContent || '',
    pageCssContent: pageSettings.cssContent || '',
    pageBodyScripts: pageSettings.bodyScripts || '',
    meta,
    pageTitle: meta.title || page.name || tenant.name || '',
    pageDescription: meta.description || '',
    funnelCtaUrl: funnelContext.stepUrl,
    funnelId: funnelContext.funnelId,
    funnelPageType: funnelContext.funnelPageType,
    stepIndex: funnelContext.stepIndex,
    paymentConfig,
    headScripts: scripts.headScripts,
    bodyStartScripts: scripts.bodyStartScripts,
    bodyEndScripts: scripts.bodyEndScripts,
    funnelHeadScripts: funnelScripts.funnelHeadScripts,
    funnelBodyStartScripts: funnelScripts.funnelBodyStartScripts,
    funnelBodyEndScripts: funnelScripts.funnelBodyEndScripts,
    googleMapsApiKey: googleMapsApiKey || '',
  };
}

interface OrderLineJson {
  externalRef?: string;
  title?: string;
  quantity?: number;
  unitPriceMinor?: number;
  lineTotalMinor?: number;
}

interface ThankYouOrderRow {
  id: string;
  orderNumber: string;
  status: string;
  capturedTotal: number;
  currencyCode: string;
  customerEmail: string;
  customerName: string | null;
  lines: unknown;
  attribution: unknown;
  createdAt: Date;
}

export async function getOrderDataForThankYou(orderId: string | null): Promise<any | null> {
  if (!orderId) return null;

  try {
    // The checkout client only knows the saleRef and passes it as ?orderId; the redirect
    // endpoint passes a real Order.id. Match either so the thank-you page resolves both flows.
    const order = (await getTenantPrisma().order.findFirst({
      where: { OR: [{ id: orderId }, { saleRef: orderId }] },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        capturedTotal: true,
        currencyCode: true,
        customerEmail: true,
        customerName: true,
        lines: true,
        attribution: true,
        createdAt: true,
      },
    })) as ThankYouOrderRow | null;
    if (!order) return null;

    const rawLines = Array.isArray(order.lines) ? (order.lines as OrderLineJson[]) : [];
    let items = rawLines.map((line, idx) => ({
      id: line.externalRef || `item-${idx}`,
      productId: line.externalRef || undefined,
      name: line.title || 'Product',
      variant: undefined as string | undefined,
      price: (line.unitPriceMinor ?? 0) / 100,
      quantity: line.quantity ?? 1,
      image: undefined as string | undefined,
    }));

    if (items.some((item) => !item.image)) {
      const imageMap = await getProductImageMap();
      if (imageMap) {
        items = items.map((item) => {
          const img = (item.productId && imageMap[item.productId]) || imageMap[item.id] || undefined;
          return img ? { ...item, image: img } : item;
        });
      }
    }

    const subtotal = rawLines.reduce((sum, l) => sum + (l.lineTotalMinor ?? 0), 0) / 100;
    const total = order.capturedTotal / 100;
    const dateStr = order.createdAt.toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      date: dateStr,
      status: order.status || 'confirmed',
      items,
      subtotal,
      shipping: 0,
      tax: 0,
      discount: 0,
      total,
      currency: order.currencyCode || 'USD',
      customerEmail: order.customerEmail || undefined,
      customerName: order.customerName || undefined,
    };
  } catch (e) {
    logger.error('Failed to fetch order for thank-you page', { error: e });
    return null;
  }
}

export function generateComingSoonHtml(name: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${name}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          margin: 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
        .container { text-align: center; padding: 40px; }
        h1 { font-size: 48px; margin-bottom: 16px; }
        p { font-size: 18px; opacity: 0.9; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>${name}</h1>
        <p>Coming Soon</p>
      </div>
    </body>
    </html>
  `;
}
