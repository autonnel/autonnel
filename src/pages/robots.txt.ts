import type { APIRoute } from 'astro';
import { isAdminHost } from '@/lib/runtime/admin-host';
import { getSiteNoindex } from '@/lib/config/keys';
import { buildAdminRobotsTxt, buildRobotsTxt } from '@/lib/seo/robots';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const host = request.headers.get('host');
  const body = isAdminHost(host)
    ? buildAdminRobotsTxt()
    : buildRobotsTxt(await getSiteNoindex().catch(() => false));

  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  });
};
