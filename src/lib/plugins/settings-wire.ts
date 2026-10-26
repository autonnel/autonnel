import { getConfig } from '@/lib/config/get-config';
import { getTenantPrisma } from '@/modules/platform/infra/prisma-tenant-extension';
import type { PluginJobRow, PluginSettingsWire } from '@/contracts/settings';
import type { PluginSettingsPanel } from './types';
import { withDefaults } from './settings-values';

const JOB_LOG_LIMIT = 20;

function jobLabel(payload: unknown): string | null {
  const label = (payload as { label?: unknown } | null)?.label;
  return typeof label === 'string' ? label : null;
}

async function loadJobRows(kinds: string[]): Promise<PluginJobRow[]> {
  if (kinds.length === 0) return [];
  const rows = await getTenantPrisma().job.findMany({
    where: { kind: { in: kinds } },
    orderBy: { createdAt: 'desc' },
    take: JOB_LOG_LIMIT,
    select: { id: true, status: true, attemptCount: true, maxAttempts: true, payload: true, failureReason: true, createdAt: true, updatedAt: true },
  });
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    attemptCount: r.attemptCount,
    maxAttempts: r.maxAttempts,
    label: jobLabel(r.payload),
    failureReason: r.failureReason,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

// Pass `written` right after a write: the config read path is KV-cached and can serve the previous
// value for about a minute on Cloudflare.
export async function loadPluginSettingsWire(
  panel: PluginSettingsPanel,
  written?: { stored: unknown },
): Promise<PluginSettingsWire> {
  const [stored, jobs] = await Promise.all([
    written ? written.stored : getConfig<unknown>(panel.configKey),
    loadJobRows(panel.jobKinds ?? []),
  ]);
  return {
    panel: { id: panel.id, title: panel.title, description: panel.description, fields: panel.fields },
    values: withDefaults(panel, stored),
    hasConfig: stored != null,
    jobs,
  };
}
