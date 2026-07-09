import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';

const { mocks } = vi.hoisted(() => ({
  mocks: {
    checkAuth: vi.fn(),
    userHasFeature: vi.fn(),
    canAccessPermissionsPageAsync: vi.fn(),
    validateApiToken: vi.fn(),
    getCurrentTenantId: vi.fn(() => 'default'),
    readEnv: vi.fn((_key: string) => undefined as string | undefined),
  },
}));

vi.mock('@/lib/auth/middleware', () => ({
  checkAuth: mocks.checkAuth,
}));
vi.mock('@/lib/rbac', () => ({
  userHasFeature: mocks.userHasFeature,
  canAccessPermissionsPageAsync: mocks.canAccessPermissionsPageAsync,
  FEATURES: { PERMISSIONS: 'PERMISSIONS', ORDERS: 'ORDERS' },
}));
vi.mock('@/lib/auth/apiAuth', () => ({
  validateApiToken: mocks.validateApiToken,
  createUnauthorizedResponse: (error: string) =>
    new Response(
      JSON.stringify({
        error: { message: error, type: 'authentication_error', code: 'invalid_api_key' },
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'WWW-Authenticate': 'Bearer' },
      },
    ),
}));
vi.mock('@/lib/tenant/context', () => ({
  getCurrentTenantId: mocks.getCurrentTenantId,
}));
vi.mock('@/lib/runtime/env', () => ({
  readEnv: mocks.readEnv,
}));
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
    child: () => ({ info: () => {}, warn: () => {}, error: () => {}, debug: () => {} }),
  }),
}));

import { apiGuard, json, apiError } from '@/lib/api/guard';
import { withAuth, jsonError as legacyJsonError } from '@/lib/api-helpers';
import {
  authenticateExternalApi,
  requireWriteAccess,
} from '@/lib/auth/externalApiAuth';

function buildCtx(opts: {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  params?: Record<string, string | undefined>;
} = {}): any {
  const url = opts.url ?? 'http://localhost/api/test';
  const headers = new Headers(opts.headers ?? {});
  const init: RequestInit = { method: opts.method ?? 'GET', headers };
  if (opts.body !== undefined) {
    init.body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
  }
  const request = new Request(url, init);
  return { request, params: opts.params ?? {}, cookies: { get: () => undefined } };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentTenantId.mockReturnValue('default');
  mocks.readEnv.mockReturnValue(undefined);
});

describe('apiGuard — session auth', () => {
  it('returns 401 with WWW-Authenticate when not authenticated', async () => {
    mocks.checkAuth.mockResolvedValue({ authenticated: false, user: null });
    const route = apiGuard({ auth: 'session' }, async () => json({ ok: true }));
    const res = await route(buildCtx());
    expect(res.status).toBe(401);
    expect(res.headers.get('WWW-Authenticate')).toBe('Bearer');
    const body = (await res.json()) as any;
    expect(body.error.code).toBe('unauthorized');
    expect(body.error.type).toBe('authentication_error');
  });

  it('returns 403 when feature is missing', async () => {
    mocks.checkAuth.mockResolvedValue({
      authenticated: true,
      user: { id: 'u1', providerId: 'p1', email: 'a@b', name: null, avatar: null },
    });
    mocks.userHasFeature.mockResolvedValue(false);
    mocks.canAccessPermissionsPageAsync.mockResolvedValue(false);
    const route = apiGuard(
      { auth: 'session', feature: 'ORDERS' as never },
      async () => json({ ok: true }),
    );
    const res = await route(buildCtx());
    expect(res.status).toBe(403);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe('forbidden');
    expect(body.error.type).toBe('permission_error');
  });

  it('passes user + tenantId to handler on happy path', async () => {
    mocks.checkAuth.mockResolvedValue({
      authenticated: true,
      user: { id: 'u1', providerId: 'p1', email: 'a@b', name: null, avatar: null },
    });
    mocks.userHasFeature.mockResolvedValue(true);
    mocks.getCurrentTenantId.mockReturnValue('acme');

    let captured: any = null;
    const route = apiGuard(
      { auth: 'session', feature: 'ORDERS' as never },
      async (ctx) => {
        captured = ctx;
        return json({ ok: true });
      },
    );
    const res = await route(buildCtx());
    expect(res.status).toBe(200);
    expect(captured.user.id).toBe('u1');
    expect(captured.tenantId).toBe('acme');
  });
});

describe('apiGuard — externalApi auth', () => {
  it('returns 401 on invalid key', async () => {
    mocks.validateApiToken.mockResolvedValue({ valid: false, error: 'Invalid token' });
    const route = apiGuard({ auth: 'externalApi' }, async () => json({ ok: true }));
    const res = await route(buildCtx({ headers: { Authorization: 'Bearer x' } }));
    expect(res.status).toBe(401);
    expect(res.headers.get('WWW-Authenticate')).toBe('Bearer');
  });

  it('returns 403 when writeAccess required but key is read-only', async () => {
    mocks.validateApiToken.mockResolvedValue({
      valid: true,
      userId: 'u1',
      writeAccess: false,
    });
    const route = apiGuard(
      { auth: 'externalApi', writeAccess: true },
      async () => json({ ok: true }),
    );
    const res = await route(buildCtx({ headers: { Authorization: 'Bearer x' } }));
    expect(res.status).toBe(403);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe('write_access_denied');
    expect(body.error.type).toBe('permission_error');
  });

  it('passes apiKey context to handler when valid', async () => {
    mocks.validateApiToken.mockResolvedValue({
      valid: true,
      userId: 'u1',
      writeAccess: true,
    });
    let captured: any = null;
    const route = apiGuard({ auth: 'externalApi' }, async (ctx) => {
      captured = ctx;
      return json({ ok: true });
    });
    const res = await route(buildCtx({ headers: { Authorization: 'Bearer x' } }));
    expect(res.status).toBe(200);
    expect(captured.apiKey).toEqual({ userId: 'u1', writeAccess: true });
  });
});

describe('apiGuard — cron auth', () => {
  it('returns 401 when key is missing', async () => {
    const route = apiGuard({ auth: 'cron' }, async () => json({ ok: true }));
    const res = await route(buildCtx());
    expect(res.status).toBe(401);
  });

  it('invokes handler when key matches', async () => {
    mocks.readEnv.mockImplementationOnce((k: string) =>
      k === 'CRON_KEY' ? 'test-cron-secret' : undefined,
    );
    let called = false;
    const route = apiGuard({ auth: 'cron' }, async () => {
      called = true;
      return json({ ok: true });
    });
    const res = await route(
      buildCtx({ url: 'http://localhost/api/cron?key=test-cron-secret' }),
    );
    expect(res.status).toBe(200);
    expect(called).toBe(true);
  });

  it('returns 401 when CRON_KEY env is unset even if request supplies a key', async () => {
    const route = apiGuard({ auth: 'cron' }, async () => json({ ok: true }));
    const res = await route(
      buildCtx({ url: 'http://localhost/api/cron?key=any-value' }),
    );
    expect(res.status).toBe(401);
  });
});

describe('apiGuard — public', () => {
  it('always invokes handler', async () => {
    let called = false;
    const route = apiGuard({ auth: 'public' }, async () => {
      called = true;
      return json({ ok: true });
    });
    const res = await route(buildCtx());
    expect(res.status).toBe(200);
    expect(called).toBe(true);
  });
});

describe('apiGuard — tenant required', () => {
  it('returns 500 with tenant_unresolved when tenant cannot be resolved', async () => {
    mocks.getCurrentTenantId.mockReturnValue('');
    const route = apiGuard(
      { auth: 'public', tenant: 'required' },
      async () => json({ ok: true }),
    );
    const res = await route(buildCtx());
    expect(res.status).toBe(500);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe('tenant_unresolved');
  });
});

describe('apiGuard — bodySchema validation', () => {
  const schema = z.object({ name: z.string().min(1) });

  it('returns 422 with details on invalid body', async () => {
    const route = apiGuard(
      { auth: 'public', bodySchema: schema },
      async () => json({ ok: true }),
    );
    const res = await route(
      buildCtx({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: { name: '' },
      }),
    );
    expect(res.status).toBe(422);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe('validation_error');
    expect(body.error.type).toBe('validation_error');
    expect(Array.isArray(body.error.details)).toBe(true);
  });

  it('passes parsed body to handler when valid', async () => {
    let captured: any = null;
    const route = apiGuard(
      { auth: 'public', bodySchema: schema },
      async (ctx) => {
        captured = ctx.body;
        return json({ ok: true });
      },
    );
    const res = await route(
      buildCtx({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: { name: 'foo' },
      }),
    );
    expect(res.status).toBe(200);
    expect(captured).toEqual({ name: 'foo' });
  });
});

describe('apiError presets', () => {
  it('NOT_FOUND returns 404 with correct shape', async () => {
    const res = apiError.NOT_FOUND('Funnel');
    expect(res.status).toBe(404);
    const body = (await res.json()) as any;
    expect(body).toEqual({
      error: { code: 'not_found', message: 'Funnel not found', type: 'api_error' },
    });
  });

  it('BAD_REQUEST returns 400', async () => {
    const res = apiError.BAD_REQUEST('bad input');
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe('bad_request');
    expect(body.error.message).toBe('bad input');
  });

  it('UNAUTHORIZED returns 401 with WWW-Authenticate', async () => {
    const res = apiError.UNAUTHORIZED();
    expect(res.status).toBe(401);
    expect(res.headers.get('WWW-Authenticate')).toBe('Bearer');
    const body = (await res.json()) as any;
    expect(body.error.code).toBe('unauthorized');
    expect(body.error.type).toBe('authentication_error');
  });

  it('FORBIDDEN returns 403', async () => {
    const res = apiError.FORBIDDEN();
    expect(res.status).toBe(403);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe('forbidden');
    expect(body.error.type).toBe('permission_error');
  });

  it('CONFLICT returns 409', async () => {
    const res = apiError.CONFLICT('already exists');
    expect(res.status).toBe(409);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe('conflict');
  });

  it('fromException hides stack in production', async () => {
    mocks.readEnv.mockImplementation(
      ((k: string) => (k === 'NODE_ENV' ? 'production' : undefined)) as any,
    );
    const res = apiError.fromException(new Error('db blew up'));
    expect(res.status).toBe(500);
    const body = (await res.json()) as any;
    expect(body.error.message).toBe('Internal server error');
    expect(body.error.details).toBeUndefined();
  });

  it('fromException includes stack in dev', async () => {
    mocks.readEnv.mockReturnValue(undefined);
    const res = apiError.fromException(new Error('db blew up'));
    expect(res.status).toBe(500);
    const body = (await res.json()) as any;
    expect(body.error.message).toBe('db blew up');
    expect(body.error.details).toMatchObject({ name: 'Error' });
    expect(body.error.details.stack).toBeTruthy();
  });
});

describe('Backwards compatibility — legacy helpers preserve old shape', () => {
  it('legacy withAuth 401 still returns { error: string }', async () => {
    mocks.checkAuth.mockResolvedValue({ authenticated: false, user: null });
    const route = withAuth('ORDERS' as never, async () => legacyJsonError('ok', 200));
    const res = await route(buildCtx());
    expect(res.status).toBe(401);
    const body = (await res.json()) as any;
    expect(body).toEqual({ error: 'Unauthorized' });
    // legacy path intentionally does NOT add WWW-Authenticate
    expect(res.headers.get('WWW-Authenticate')).toBeNull();
  });

  it('legacy authenticateExternalApi 401 keeps shape + WWW-Authenticate', async () => {
    mocks.validateApiToken.mockResolvedValue({ valid: false, error: 'Invalid token' });
    const ctx = buildCtx({ headers: { Authorization: 'Bearer x' } });
    const result = await authenticateExternalApi(ctx);
    expect(result).toBeInstanceOf(Response);
    const res = result as Response;
    expect(res.status).toBe(401);
    expect(res.headers.get('WWW-Authenticate')).toBe('Bearer');
    const body = (await res.json()) as any;
    expect(body.error.type).toBe('authentication_error');
    expect(body.error.code).toBe('invalid_api_key');
    expect(body.error.message).toBe('Invalid token');
  });

  it('legacy requireWriteAccess preserves 403 body shape', async () => {
    const res = requireWriteAccess({ authenticated: true, writeAccess: false });
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
    const body = (await res!.json()) as any;
    expect(body.error.type).toBe('permission_error');
    expect(body.error.code).toBe('write_access_denied');
  });
});
