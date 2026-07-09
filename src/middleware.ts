// Webhook routes resolve tenancy themselves and verify-then-enter their own ALS scope.
import type { APIContext, MiddlewareNext } from 'astro';
import { makeIdentity } from '@/composition/make-identity';
import { getCurrentPrincipal } from '@/modules/identity/infra/als-tenant-context';
import { setRuntimeEnv, getRuntimeEnv } from '@/lib/runtime/env';
import { resolveSessionSecret } from '@/lib/services/session-secret';
import { isAdminHost, isPublicStorefrontPath } from '@/lib/runtime/admin-host';
import { resolveSetupState, isSetupExemptPath } from '@/lib/auth/setup-state';
import { checkAuth } from '@/lib/auth/middleware';
import { getBasePrisma } from '@/lib/db';
import { getTenantPrisma } from '@/modules/platform/infra/prisma-tenant-extension';

export async function onRequest(context: APIContext, next: MiddlewareNext): Promise<Response> {
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
    if (!isAdminHost(host) && !isPublicStorefrontPath(pathname)) {
      // Storefront hosts serve pages at clean bare-slug URLs (shop.com/landing); route them
      // through the storefront renderer, which 404s only when the page truly does not exist.
      // Preserve the query string so click ids (fbclid/gclid) + utm reach the renderer for attribution.
      const target = pathname === '/' ? '/storefront/' : `/storefront${pathname}`;
      return next(`${target}${requestUrl.search}`);
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

    return next();
  });
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
