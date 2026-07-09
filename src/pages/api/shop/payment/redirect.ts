import type { APIRoute } from 'astro';
import { getBasePrisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';

const logger = createLogger('ShopPaymentRedirect');

interface FunnelStep {
  stepSlug?: string;
  pageId?: string;
}

function readSteps(steps: unknown): FunnelStep[] {
  return Array.isArray(steps) ? (steps as FunnelStep[]) : [];
}

interface OrderLike {
  id: string;
  orderNumber: string;
  tenantId: string;
  attribution: unknown;
}

function attributionField(attribution: unknown, key: string): string | null {
  if (attribution && typeof attribution === 'object' && !Array.isArray(attribution)) {
    const value = (attribution as Record<string, unknown>)[key];
    return typeof value === 'string' ? value : null;
  }
  return null;
}

async function getRedirectUrl(order: OrderLike, trackingId: string | null): Promise<string> {
  const prisma = getBasePrisma();
  const fallback = trackingId
    ? `/thank-you?orderId=${order.id}&trackingId=${encodeURIComponent(trackingId)}`
    : `/thank-you?orderId=${order.id}`;

  const funnelId = attributionField(order.attribution, 'funnelId');
  const checkoutPageId = attributionField(order.attribution, 'pageId');
  if (!funnelId) {
    logger.info('No funnelId on order attribution, using default thank-you');
    return fallback;
  }

  const funnel = await prisma.funnel.findFirst({
    where: { id: funnelId, tenantId: order.tenantId },
    select: { steps: true },
  });
  if (!funnel) return fallback;

  const steps = readSteps(funnel.steps);
  const checkoutIndex = checkoutPageId
    ? steps.findIndex((s) => s.pageId === checkoutPageId)
    : steps.length - 1;
  if (checkoutIndex === -1 || checkoutIndex >= steps.length - 1) {
    logger.info('No step after checkout, using default thank-you');
    return fallback;
  }

  const nextStep = steps[checkoutIndex + 1];
  if (!nextStep?.pageId) return fallback;

  const nextPage = await prisma.page.findFirst({
    where: { id: nextStep.pageId, tenantId: order.tenantId },
    select: { slug: true, tenantId: true },
  });
  if (!nextPage) return fallback;

  const normalizedSlug = nextPage.slug.startsWith('/') ? nextPage.slug : `/${nextPage.slug}`;

  const params = new URLSearchParams();
  params.set('orderId', order.id);
  if (trackingId) params.set('trackingId', trackingId);
  const queryString = params.toString();

  return `${normalizedSlug}?${queryString}`;
}

export const GET: APIRoute = async ({ url }) => {
  const prisma = getBasePrisma();
  try {
    const orderId = url.searchParams.get('orderId');
    const trackingId = url.searchParams.get('trackingId');

    if (!orderId) {
      return new Response(JSON.stringify({ error: 'Order ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId },
      select: { id: true, orderNumber: true, tenantId: true, attribution: true, status: true },
    });

    if (!order) {
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (order.status !== 'PAID') {
      return new Response(JSON.stringify({ error: 'Order not paid yet' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const redirectUrl = await getRedirectUrl(order, trackingId);

    return new Response(
      JSON.stringify({
        success: true,
        redirectUrl,
        orderId: order.id,
        orderNumber: order.orderNumber,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    logger.error('Get redirect URL error', { error });
    return new Response(JSON.stringify({ error: 'Failed to get redirect URL' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
