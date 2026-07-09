import type { APIContext } from 'astro';
import { makeIdentity } from '@/composition/make-identity';
import { resolveIdentityDeps, readSessionCookie, clearedSessionCookie } from '@/composition/identity-deps';

export async function POST(context: APIContext): Promise<Response> {
  const token = readSessionCookie(context.request);
  if (token) {
    const identity = makeIdentity(resolveIdentityDeps(context));
    await identity.authentication.logout(token).catch(() => {});
  }
  const res = new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
  res.headers.set('set-cookie', clearedSessionCookie(context));
  return res;
}
