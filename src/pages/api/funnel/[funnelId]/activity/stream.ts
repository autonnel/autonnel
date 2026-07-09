import type { APIRoute } from 'astro';
import { checkAuth } from '@/lib/auth/middleware';
import { userHasFeature, FEATURES } from '@/lib/rbac';
import { getCurrentTenantId } from '@/lib/tenant/context';
import { getBasePrisma, createStandalonePrisma } from '@/lib/db';
import { formatActivityEntry, type RawActivityRow } from '@/lib/dashboard/funnels-helpers';
import { activitySseResponse, type StreamLine } from '@/lib/dashboard/activity-stream';

interface FunnelCursor {
  ts: number;
  id: string;
}

function parseCursor(raw: string | null): FunnelCursor {
  if (!raw) return { ts: Date.now(), id: '' };
  const sep = raw.indexOf(':');
  if (sep < 0) {
    const ts = Number(raw);
    return { ts: Number.isFinite(ts) ? ts : Date.now(), id: '' };
  }
  const ts = Number(raw.slice(0, sep));
  return { ts: Number.isFinite(ts) ? ts : Date.now(), id: raw.slice(sep + 1) };
}

type FunnelActivityRow = RawActivityRow & { id: string };

export const GET: APIRoute = async (context) => {
  const funnelId = context.params.funnelId;
  if (!funnelId) return new Response('Not found', { status: 404 });

  const auth = await checkAuth(context);
  if (!auth.authenticated || !auth.user) return new Response('Unauthorized', { status: 401 });
  if (!(await userHasFeature(auth.user.id, FEATURES.FUNNELS))) {
    return new Response('Forbidden', { status: 403 });
  }

  // Capture the tenant id while the request ALS context is still alive; the stream loop below runs after
  // the handler returns and must never rely on getCurrentTenantId() / the request-scoped client.
  const tenantId = getCurrentTenantId();

  const owns = await getBasePrisma().funnel.findFirst({
    where: { id: funnelId, tenantId },
    select: { id: true },
  });
  if (!owns) return new Response('Not found', { status: 404 });

  const slugCache = new Map<string, string>();

  const poll = async (raw: string | null): Promise<StreamLine[]> => {
    const cursor = parseCursor(raw);
    const client = createStandalonePrisma();
    try {
      const rows = (await client.userActivityEvent.findMany({
        where: { tenantId, funnelId, occurredAt: { gte: new Date(cursor.ts) } },
        orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
        take: 60,
        select: { id: true, kind: true, stepId: true, pageId: true, url: true, metadata: true, occurredAt: true },
      })) as FunnelActivityRow[];

      const fresh = rows.filter((r) => {
        const t = r.occurredAt.getTime();
        return t > cursor.ts || (t === cursor.ts && r.id > cursor.id);
      });
      if (fresh.length === 0) return [];

      const unknownPageIds = Array.from(
        new Set(fresh.map((r) => r.pageId).filter((id): id is string => id !== null && id !== undefined)),
      ).filter((id) => !slugCache.has(id));
      if (unknownPageIds.length > 0) {
        const pages = (await client.page.findMany({
          where: { id: { in: unknownPageIds }, tenantId },
          select: { id: true, slug: true },
        })) as Array<{ id: string; slug: string }>;
        for (const p of pages) slugCache.set(p.id, p.slug);
      }

      return fresh.map((r) => {
        const entry = formatActivityEntry({ ...r, pageSlug: r.pageId ? slugCache.get(r.pageId) ?? null : null });
        const ts = r.occurredAt.getTime();
        return { id: `${ts}:${r.id}`, ts, text: entry.text, tone: entry.tone, payload: entry.payload };
      });
    } finally {
      await client.$disconnect().catch(() => {});
    }
  };

  return activitySseResponse({
    request: context.request,
    queryCursor: new URL(context.request.url).searchParams.get('cursor'),
    poll,
    logLabel: 'FunnelActivityStream',
  });
};
