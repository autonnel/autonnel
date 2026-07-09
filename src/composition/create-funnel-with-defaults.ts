import { makeFunnelDashboard } from '@/composition/make-funnel-dashboard';
import { makeAuthoring } from '@/composition/make-authoring';
import { authoringDepsFromLocals } from '@/composition/authoring-runtime';
import { getTenantPrisma } from '@/modules/platform/infra/prisma-tenant-extension';
import { getTemplateData } from '@/lib/templates/registry';
import type { FunnelSummary } from '@/modules/funnel-dashboard/application/ports';
import type { PageType } from '@/modules/authoring/domain/page';

type Authoring = ReturnType<typeof makeAuthoring>;

interface DefaultPageSpec {
  type: Extract<PageType, 'thankyou' | 'error'>;
  dbTypes: string[];
  name: string;
  slug: string;
  templateName: string;
}

const DEFAULT_PAGES: DefaultPageSpec[] = [
  { type: 'thankyou', dbTypes: ['THANKYOU', 'thankyou'], name: 'Thank You', slug: 'thank-you', templateName: 'THANKYOU_SKINCARE' },
  { type: 'error', dbTypes: ['ERROR', 'error'], name: 'Error', slug: 'error', templateName: 'ERROR' },
];

async function uniqueSlug(base: string): Promise<string> {
  const db = getTenantPrisma();
  let candidate = base;
  let n = 1;
  while (await db.page.findFirst({ where: { slug: candidate }, select: { id: true } })) {
    candidate = `${base}-${n++}`;
  }
  return candidate;
}

// Storefront renders Puck pages from page.publishedData with status PUBLISHED (not the
// DDD PagePublication store), so default pages are seeded into publishedData/draftData and
// published directly to be immediately renderable.
async function ensureDefaultPage(authoring: Authoring, spec: DefaultPageSpec): Promise<{ id: string; slug: string }> {
  const existing = await getTenantPrisma().page.findFirst({
    where: { type: { in: spec.dbTypes } },
    select: { id: true, slug: true },
  });
  if (existing) return existing;

  const data = getTemplateData(spec.templateName);
  const slug = await uniqueSlug(spec.slug);
  const created = await authoring.pageDashboard.create({
    name: spec.name,
    slug,
    type: spec.type,
    editorType: 'PUCK',
    templateName: spec.templateName,
    draftData: data,
    publishedData: data,
    status: 'PUBLISHED',
    meta: { title: spec.name },
  });
  return { id: created.id, slug: created.slug };
}

export async function createFunnelWithDefaults(input: {
  name: string;
  description?: string | null;
  locals?: unknown;
}): Promise<FunnelSummary> {
  const { funnels } = makeFunnelDashboard();
  const funnel = await funnels.create({ name: input.name, description: input.description });

  const authoring = makeAuthoring(authoringDepsFromLocals(input.locals));
  for (const spec of DEFAULT_PAGES) {
    const page = await ensureDefaultPage(authoring, spec);
    await authoring.funnelComposing.addStep({ funnelId: funnel.id, stepSlug: page.slug, pageId: page.id });
  }

  return funnel;
}
