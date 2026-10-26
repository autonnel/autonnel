// Webhook routes resolve tenancy themselves and verify-then-enter their own ALS scope.
import type { APIContext, MiddlewareNext } from 'astro';
import { makeIdentity } from '@/composition/make-identity';
import { SESSION_COOKIE } from '@/composition/identity-deps';
import { getCurrentPrincipal } from '@/modules/identity/infra/als-tenant-context';
import { setRuntimeEnv, getRuntimeEnv } from '@/lib/runtime/env';
import { resolveSessionSecret } from '@/lib/services/session-secret';
import { isAdminHost, isPublicStorefrontPath } from '@/lib/runtime/admin-host';
import { resolveSetupState, isSetupExemptPath } from '@/lib/auth/setup-state';
import { checkAuth } from '@/lib/auth/middleware';
import { getBasePrisma } from '@/lib/db';
import { getTenantPrisma } from '@/modules/platform/infra/prisma-tenant-extension';
import { getSiteNoindex } from '@/lib/config/keys';
import { NOINDEX_ROBOTS_DIRECTIVE } from '@/lib/seo/robots';
import { ensureNodeScheduler } from '@/composition/node-scheduler';

export async function onRequest(context: APIContext, next: MiddlewareNext): Promise<Response> {
  ensureNodeScheduler();
  const deps = resolveIdentityDeps(context);
  setRuntimeEnv(deps.env);
  const identity = makeIdentity({
    rawPrisma: deps.rawPrisma,
    scopedPrisma: deps.scopedPrisma,
    sessionSecret: deps.sessionSecret,
  });

  return identity.tenantContext.establish(context.request, async () => {
    context.locals.principal = getCurrentPrincipal();

    const host = context.request.headers.get('host');
    const requestUrl = new URL(context.request.url);
    const pathname = requestUrl.pathname;
    const storefrontHost = !isAdminHost(host);
    // Applied here rather than per page so imported-HTML pages, funnel steps and error
    // responses are all covered by the one switch. robots.txt sets its own headers.
    const tagNoindex = async (response: Response): Promise<Response> => {
      if (!storefrontHost || pathname === '/robots.txt') return response;
      if (await getSiteNoindex().catch(() => false)) {
        response.headers.set('X-Robots-Tag', NOINDEX_ROBOTS_DIRECTIVE);
      }
      return response;
    };
    if (storefrontHost && !isPublicStorefrontPath(pathname)) {
      // Storefront hosts serve pages at clean bare-slug URLs (shop.com/landing); route them
      // through the storefront renderer, which 404s only when the page truly does not exist.
      // Preserve the query string so click ids (fbclid/gclid) + utm reach the renderer for attribution.
      const target = pathname === '/' ? '/storefront/' : `/storefront${pathname}`;
      return tagNoindex(await next(`${target}${requestUrl.search}`));
    }

    if (context.request.method === 'GET' && !isSetupExemptPath(pathname)) {
      const setup = await resolveSetupState();
      if (setup.needsSetup) {
        // Fresh install: everything (including /login) funnels into the wizard.
        // Provisioned tenant (account exists): only signed-in users are redirected,
        // so /login stays reachable to authenticate first.
        const gate = setup.needsAccount || (await checkAuth(context)).authenticated;
        if (gate) return context.redirect('/setup', 302);
      }
    }

    if (isExpiredAdminApiSession(context, pathname)) return jsonError('Unauthorized', 401);

    return tagNoindex(await next());
  });
}

// An admin session cookie that no longer resolves (idle/absolute expiry, revoked) must read as
// 401 rather than each feature gate's 403, so the admin UI can send the user back to sign in.
function isExpiredAdminApiSession(context: APIContext, pathname: string): boolean {
  return (
    pathname.startsWith('/api/') &&
    !pathname.startsWith('/api/auth/') &&
    !isPublicStorefrontPath(pathname) &&
    !context.locals.principal &&
    context.cookies.has(SESSION_COOKIE)
  );
}

function jsonError(error: string, status: number): Response {
  return new Response(JSON.stringify({ error }), { status, headers: { 'content-type': 'application/json' } });
}

function resolveIdentityDeps(_context: APIContext) {
  const env = getRuntimeEnv();
  return {
    env,
    rawPrisma: getBasePrisma(),
    scopedPrisma: getTenantPrisma(),
    sessionSecret: resolveSessionSecret('AUTH_SESSION_SECRET', env),
  };
}
