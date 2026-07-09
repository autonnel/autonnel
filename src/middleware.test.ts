import { describe, it, expect, vi } from 'vitest';
import { onRequest } from './middleware';
import { getCurrentTenantId } from '@/modules/identity/infra/als-tenant-context';
import { DEFAULT_TENANT } from '@/modules/shared-kernel/tenant-id';

describe('AstroAuthMiddleware', () => {
  it('runs the downstream handler inside an ALS context with a resolved tenantId', async () => {
    let observedTenant: string | undefined;
    const next = vi.fn(async () => {
      observedTenant = getCurrentTenantId();
      return new Response('ok');
    });
    const ctx: any = {
      request: new Request('https://shop.example.com/overview'),
      locals: {},
    };
    const res = await onRequest(ctx, next);
    expect(res.status).toBe(200);
    expect(observedTenant).toBe(DEFAULT_TENANT);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('exposes the resolved principal on locals (null when unauthenticated)', async () => {
    const ctx: any = {
      request: new Request('https://shop.example.com/overview'),
      locals: {},
    };
    await onRequest(ctx, vi.fn(async () => new Response('ok')));
    expect(ctx.locals.principal).toBeNull();
  });

  it('rewrites bare-slug paths on a storefront host to the storefront renderer', async () => {
    const prev = process.env.ADMIN_DOMAIN;
    process.env.ADMIN_DOMAIN = 'admin.example.com';
    try {
      let rewrittenTo: string | undefined;
      const next = vi.fn(async (path?: string | URL | Request) => {
        rewrittenTo = typeof path === 'string' ? path : undefined;
        return new Response('ok');
      });
      const ctx: any = {
        request: new Request('https://shop.example.com/special-offer'),
        locals: {},
      };
      await onRequest(ctx, next);
      expect(rewrittenTo).toBe('/storefront/special-offer');
    } finally {
      process.env.ADMIN_DOMAIN = prev;
    }
  });

  it('binds the CF runtime env and keeps cfContext on locals for the waitUntil adapter', async () => {
    const cfContext = { waitUntil: vi.fn() };
    const ctx: any = {
      request: new Request('https://x/'),
      locals: { cfContext, runtime: { env: { AUTH_SESSION_SECRET: 's' } } },
    };
    await onRequest(ctx, vi.fn(async () => new Response('ok')));
    expect(ctx.locals.cfContext).toBe(cfContext);
  });
});
