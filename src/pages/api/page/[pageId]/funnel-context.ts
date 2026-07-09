import type { APIRoute } from 'astro';
import { requireFeature } from '@/modules/identity/published/principal';

export const GET: APIRoute = async () => {
  await requireFeature('PAGES');
  return new Response(JSON.stringify({ funnelContext: null }), { status: 200 });
};
