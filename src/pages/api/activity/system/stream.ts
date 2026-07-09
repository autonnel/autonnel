import type { APIRoute } from 'astro';
import { checkAuth } from '@/lib/auth/middleware';
import { getCurrentTenantId } from '@/lib/tenant/context';
import { createStandalonePrisma } from '@/lib/db';
import { querySystemActivity } from '@/lib/dashboard/system-activity';
import { activitySseResponse, type StreamLine } from '@/lib/dashboard/activity-stream';

const TAIL_WINDOW_MS = 10 * 60 * 1000;

function parseSinceTs(raw: string | null): number {
  if (!raw) return Date.now();
  const ts = Number(raw.split('|')[0]);
  return Number.isFinite(ts) ? ts : Date.now();
}

export const GET: APIRoute = async (context) => {
  const auth = await checkAuth(context);
  if (!auth.authenticated || !auth.user) return new Response('Unauthorized', { status: 401 });

  // Captured inside the request ALS scope; the poll loop below runs after the handler returns.
  const tenantId = getCurrentTenantId();

  const poll = async (raw: string | null): Promise<StreamLine[]> => {
    const since = parseSinceTs(raw);
    const client = createStandalonePrisma();
    try {
      const now = new Date();
      const entries = await querySystemActivity(client, tenantId, now, 50, TAIL_WINDOW_MS);
      return entries
        .filter((e) => e.ts.getTime() > since)
        .sort((a, b) => a.ts.getTime() - b.ts.getTime())
        .map((e) => {
          const ts = e.ts.getTime();
          return {
            id: `${ts}|${e.kind}|${e.text}|${e.payload}`,
            ts,
            text: e.text,
            tone: e.tone,
            payload: e.payload,
          };
        });
    } finally {
      await client.$disconnect().catch(() => {});
    }
  };

  return activitySseResponse({
    request: context.request,
    queryCursor: new URL(context.request.url).searchParams.get('cursor'),
    poll,
    logLabel: 'SystemActivityStream',
  });
};
