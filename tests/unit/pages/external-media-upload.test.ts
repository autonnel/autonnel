import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  writeAccess: true,
  store: vi.fn(),
}));

// Only identity is faked, so the route runs through the real withApiPrincipal/requireWriteAccess
// pair - that seam is exactly what the write-denial envelope assertion below is pinning.
vi.mock('@/composition/identity-deps', () => ({ resolveIdentityDeps: () => ({}) }));
vi.mock('@/composition/make-identity', () => ({
  makeIdentity: () => ({
    apiAuth: {
      authenticate: async () => {
        const { PermissionSet } = await import('@/modules/identity/domain/permission-set');
        const { toFeatureKey } = await import('@/modules/identity/domain/feature-key');
        return {
          kind: 'apiClient',
          apiKeyId: 'k1',
          tenantId: 'default',
          writeAccess: hoisted.writeAccess,
          permissions: PermissionSet.of([toFeatureKey('PAGES')]),
        };
      },
    },
  }),
}));

vi.mock('@/composition/make-ai-media-deps', () => ({
  makeAiMediaUpload: vi.fn(async () => ({ store: hoisted.store })),
}));

import { POST } from '@/pages/api/v1.1/media/upload';
import { StorageNotConfiguredError } from '@/lib/s3';

function ctx(body?: BodyInit) {
  return {
    request: new Request('https://admin.example.com/api/v1.1/media/upload', {
      method: 'POST',
      headers: { Authorization: 'Bearer test' },
      body,
    }),
    locals: {},
    params: {},
    url: new URL('https://admin.example.com/api/v1.1/media/upload'),
  };
}

function imageForm(type = 'image/png') {
  const form = new FormData();
  form.append('file', new File([new Uint8Array([1, 2, 3])], 'a.png', { type }));
  return form;
}

beforeEach(() => {
  hoisted.writeAccess = true;
  hoisted.store.mockReset();
});

describe('POST /api/v1.1/media/upload', () => {
  it('rejects read-only API keys before uploading, in the shared write-denied envelope', async () => {
    hoisted.writeAccess = false;

    const res = (await POST(ctx() as never)) as Response;

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: {
        message: 'Write access is not enabled for this API key. Enable it in API Settings.',
        type: 'permission_error',
        code: 'write_access_denied',
      },
    });
    expect(hoisted.store).not.toHaveBeenCalled();
  });

  it('allows writable API keys to upload a file', async () => {
    hoisted.store.mockResolvedValue({
      assetId: 'asset_1',
      url: 'https://cdn.example.com/media/a.png',
    });

    const res = (await POST(ctx(imageForm()) as never)) as Response;
    const data = (await res.json()) as { assetId: string; url: string };

    expect(res.status).toBe(201);
    expect(data.assetId).toBe('asset_1');
    expect(data.url).toBe('https://cdn.example.com/media/a.png');
    expect(hoisted.store).toHaveBeenCalledWith(expect.objectContaining({ contentType: 'image/png' }));
  });

  it('rejects unsupported file types before uploading', async () => {
    const res = (await POST(ctx(imageForm('text/plain')) as never)) as Response;

    expect(res.status).toBe(400);
    expect(hoisted.store).not.toHaveBeenCalled();
  });

  it('names unconfigured storage instead of reporting a generic internal error', async () => {
    hoisted.store.mockRejectedValue(new StorageNotConfiguredError());

    const res = (await POST(ctx(imageForm()) as never)) as Response;
    const body = (await res.json()) as { error: string; code: string };

    expect(res.status).toBe(412);
    expect(body.code).toBe('STORAGE_NOT_CONFIGURED');
    expect(body.error).toMatch(/Settings/);
  });

  it('still hides an unrelated failure behind a 500', async () => {
    hoisted.store.mockRejectedValue(new Error('postgres://user:pw@host/db'));

    const res = (await POST(ctx(imageForm()) as never)) as Response;

    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain('postgres://');
  });
});
