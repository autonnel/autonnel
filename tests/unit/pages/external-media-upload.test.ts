import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  withApiPrincipal: vi.fn(),
  store: vi.fn(),
}));

vi.mock('@/composition/external-auth', () => ({
  withApiPrincipal: hoisted.withApiPrincipal,
}));

vi.mock('@/composition/make-ai-media-deps', () => ({
  makeAiMediaUpload: vi.fn(async () => ({ store: hoisted.store })),
}));

import { POST } from '@/pages/api/v1.1/media/upload';

function apiPrincipal(writeAccess: boolean) {
  return {
    kind: 'apiClient' as const,
    apiKeyId: 'k1',
    tenantId: 'default',
    writeAccess,
    permissions: { has: () => true },
  };
}

function ctx(body?: BodyInit) {
  return {
    request: new Request('https://admin.example.com/api/v1.1/media/upload', {
      method: 'POST',
      headers: { Authorization: 'Bearer test' },
      body,
    }),
  };
}

beforeEach(() => {
  hoisted.withApiPrincipal.mockReset();
  hoisted.store.mockReset();
});

describe('POST /api/v1.1/media/upload', () => {
  it('rejects read-only API keys before uploading', async () => {
    hoisted.withApiPrincipal.mockImplementation((_c: unknown, fn: any) => fn(apiPrincipal(false)));

    const res = await POST(ctx() as never);

    expect(res.status).toBe(403);
    expect(hoisted.store).not.toHaveBeenCalled();
  });

  it('allows writable API keys to upload a file', async () => {
    hoisted.withApiPrincipal.mockImplementation((_c: unknown, fn: any) => fn(apiPrincipal(true)));
    hoisted.store.mockResolvedValue({
      assetId: 'asset_1',
      url: 'https://cdn.example.com/media/a.png',
    });

    const form = new FormData();
    form.append('file', new File([new Uint8Array([1, 2, 3])], 'a.png', { type: 'image/png' }));

    const res = await POST(ctx(form) as never);
    const data = (await res.json()) as { assetId: string; url: string };

    expect(res.status).toBe(201);
    expect(data.assetId).toBe('asset_1');
    expect(data.url).toBe('https://cdn.example.com/media/a.png');
    expect(hoisted.store).toHaveBeenCalledWith(expect.objectContaining({ contentType: 'image/png' }));
  });

  it('rejects unsupported file types before uploading', async () => {
    hoisted.withApiPrincipal.mockImplementation((_c: unknown, fn: any) => fn(apiPrincipal(true)));

    const form = new FormData();
    form.append('file', new File([new Uint8Array([1, 2, 3])], 'a.txt', { type: 'text/plain' }));

    const res = await POST(ctx(form) as never);

    expect(res.status).toBe(400);
    expect(hoisted.store).not.toHaveBeenCalled();
  });
});
