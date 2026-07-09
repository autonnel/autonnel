import { getBasePrisma } from './db';
import { withTenantWhere } from './repositories/tenant-helpers';

// The Funnel aggregate stores ordered steps as JSON ([{ stepSlug, pageId }]).
// Only landing pages are free-edited and must carry a manual redirect link to the
// next step; checkout/thankyou/error/upsell navigation is driven by the backend
// (payment result, upsell accept/decline) so those steps are not link-validated.
const LANDING_PAGE_TYPES = new Set(['custom']);

function isLandingPage(type: string): boolean {
  return LANDING_PAGE_TYPES.has(type.toLowerCase());
}

export interface FunnelValidationError {
  funnelPageId: string;
  pageId: string;
  pageName: string;
  pageType: string;
  error: string;
  expectedUrl?: string;
}

export interface FunnelValidationResult {
  isValid: boolean;
  errors: FunnelValidationError[];
}

interface FunnelStep {
  stepSlug?: string;
  pageId?: string;
}

function readSteps(steps: unknown): FunnelStep[] {
  return Array.isArray(steps) ? (steps as FunnelStep[]) : [];
}

export async function validateFunnel(funnelId: string): Promise<FunnelValidationResult> {
  const prisma = getBasePrisma();
  const errors: FunnelValidationError[] = [];

  const funnel = await prisma.funnel.findFirst({
    where: withTenantWhere({ id: funnelId }),
    select: { id: true, steps: true },
  });

  if (!funnel) {
    throw new Error('Funnel not found');
  }

  const steps = readSteps(funnel.steps);
  let hasCheckoutStep = false;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (!step.pageId) continue;

    const page = await prisma.page.findFirst({
      where: withTenantWhere({ id: step.pageId }),
      select: {
        id: true,
        name: true,
        type: true,
        publishedData: true,
        draftData: true,
        htmlContent: true,
        draftHtml: true,
      },
    });

    if (page && (page.type === 'CHECKOUT' || page.type === 'checkout')) {
      hasCheckoutStep = true;
    }

    if (!page) {
      errors.push({
        funnelPageId: step.stepSlug ?? String(i),
        pageId: step.pageId,
        pageName: 'Unknown',
        pageType: 'STEP',
        error: 'Page not found',
      });
      continue;
    }

    if (!isLandingPage(page.type)) continue;

    const next = steps[i + 1];
    if (!next) continue;

    // The landing embeds a stable link to its OWN step; the /n/ route advances from it
    // to the next step (checkout). Linking the next step's slug would break when that
    // page is swapped and double-advance past it.
    if (!step.stepSlug) {
      errors.push({
        funnelPageId: step.stepSlug ?? String(i),
        pageId: page.id,
        pageName: page.name,
        pageType: 'STEP',
        error: 'Landing step does not have a stepSlug configured',
      });
      continue;
    }

    const expectedUrl = `/n/${funnelId}/${step.stepSlug}`;
    const pageContentStr = [
      JSON.stringify(page.publishedData ?? {}),
      JSON.stringify(page.draftData ?? {}),
      page.htmlContent ?? '',
      page.draftHtml ?? '',
    ].join('\n');

    if (!pageContentStr.includes(expectedUrl)) {
      errors.push({
        funnelPageId: step.stepSlug ?? String(i),
        pageId: page.id,
        pageName: page.name,
        pageType: 'STEP',
        error: 'Step page does not contain expected redirect link',
        expectedUrl,
      });
    }
  }

  if (!hasCheckoutStep) {
    errors.push({
      funnelPageId: 'checkout',
      pageId: '',
      pageName: '—',
      pageType: 'CHECKOUT',
      error: 'Funnel has no checkout step. Add a checkout page.',
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export async function getFunnelValidationErrors(funnelId: string): Promise<FunnelValidationError[]> {
  const result = await validateFunnel(funnelId);
  return result.errors;
}
