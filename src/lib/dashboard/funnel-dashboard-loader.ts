import { makeFunnelDashboard } from '@/composition/make-funnel-dashboard';
import { getTenantPrisma } from '@/modules/platform/infra/prisma-tenant-extension';
import type { FunnelDto, FunnelScriptDto, ExperimentDto } from '@/contracts/funnel';
import { toExperimentDto } from '@/lib/dashboard/experiment-dto';
import { loadFunnelViewUrl } from '@/lib/dashboard/funnels-data';
import { toFunnelDto } from '@/pages/api/funnel/index';

export interface FunnelDetailHeader {
  funnel: FunnelDto;
  viewUrl: string | null;
}

export async function loadFunnelHeader(funnelId: string): Promise<FunnelDetailHeader | null> {
  const { funnels } = makeFunnelDashboard();
  const summary = await funnels.list().then((list) => list.find((f) => f.id === funnelId) ?? null);
  if (!summary) return null;
  return { funnel: toFunnelDto(summary), viewUrl: await loadFunnelViewUrl(funnelId) };
}

export async function loadFunnelScripts(funnelId: string): Promise<FunnelScriptDto[]> {
  const { scripts } = makeFunnelDashboard();
  const rows = await scripts.list(funnelId);
  return rows.map((s) => ({
    id: s.id,
    name: s.name,
    position: s.position,
    content: s.content,
    isActive: s.isActive,
    order: s.order,
  }));
}

export interface FunnelExperimentData {
  experiment: ExperimentDto | null;
  availableFunnels: Array<{ id: string; name: string }>;
  availablePages: Array<{ id: string; title: string }>;
}

interface PageRow {
  id: string;
  name: string;
  slug: string;
}

export async function loadFunnelExperiment(funnelId: string): Promise<FunnelExperimentData> {
  const { experiments, funnels } = makeFunnelDashboard();
  const db = getTenantPrisma();
  const [found, all, pageRows] = await Promise.all([
    experiments.get(funnelId),
    funnels.list(),
    db.page.findMany({ select: { id: true, name: true, slug: true }, orderBy: { name: 'asc' } }) as Promise<PageRow[]>,
  ]);
  const availableFunnels = all.filter((f) => f.id !== funnelId).map((f) => ({ id: f.id, name: f.name }));
  const availablePages = pageRows.map((p) => ({ id: p.id, title: p.name || p.slug || p.id }));
  return {
    experiment: found ? toExperimentDto(found) : null,
    availableFunnels,
    availablePages,
  };
}
