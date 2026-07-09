import { getTenantPrisma } from '@/modules/platform/infra/prisma-tenant-extension';
import { makeFunnelDashboard } from '@/composition/make-funnel-dashboard';
import { assignArm } from '@/modules/funnel-dashboard/application/assign-arm';
import { createLogger } from '@/lib/logger';

const logger = createLogger('ExperimentRouting');

interface FunnelStepJson {
  stepSlug?: string;
  pageId?: string;
}

// Returns null when no active split exists. Otherwise always returns the assigned arm so the
// caller can stamp it for attribution; `redirectSlug` is non-null only when the variant target
// differs from the current entry. Never throws into the render path.
export async function resolveEntryExperiment(input: {
  funnelId: string;
  currentPageId: string;
  currentPageSlug: string;
  trackingId: string;
}): Promise<{ experimentId: string; armId: string; redirectSlug: string | null } | null> {
  try {
    const dashboard = makeFunnelDashboard();
    const loaded = await dashboard.experiments.get(input.funnelId);
    if (!loaded) return null;

    const picked = await assignArm(dashboard.assignments, loaded, input.trackingId);
    if (!picked) return null;

    const { arm } = picked;
    const base = { experimentId: picked.experimentId, armId: arm.id };

    if (arm.isControl || arm.targetFunnelId === input.funnelId) {
      return { ...base, redirectSlug: null };
    }

    const targetSlug = await resolveTargetSlug(arm.targetPageId, arm.targetFunnelId);
    const redirectSlug = targetSlug && targetSlug !== input.currentPageSlug ? targetSlug : null;
    return { ...base, redirectSlug };
  } catch (error) {
    logger.error('resolveEntryExperiment failed; staying on entry', { error });
    return null;
  }
}

async function resolveTargetSlug(
  targetPageId: string | null,
  targetFunnelId: string | null,
): Promise<string | null> {
  const db = getTenantPrisma();

  if (targetPageId) {
    const page = (await db.page.findFirst({
      where: { id: targetPageId },
      select: { slug: true },
    })) as { slug: string } | null;
    return page?.slug ?? null;
  }

  if (targetFunnelId) {
    const funnel = (await db.funnel.findFirst({
      where: { id: targetFunnelId },
      select: { steps: true },
    })) as { steps: unknown } | null;
    const steps = Array.isArray(funnel?.steps) ? (funnel!.steps as FunnelStepJson[]) : [];
    const entryPageId = steps[0]?.pageId;
    if (!entryPageId) return null;

    const page = (await db.page.findFirst({
      where: { id: entryPageId },
      select: { slug: true },
    })) as { slug: string } | null;
    return page?.slug ?? null;
  }

  return null;
}
