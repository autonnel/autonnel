import { describe, it, expect, beforeEach, vi } from 'vitest';

// The stored key must never travel to a destination the caller chose. We assert on the
// probe model actually handed to the provider, which is where the credential would leak.
const h = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  probes: [] as Record<string, unknown>[],
}));

vi.mock('@/lib/config/llm-models', () => ({ listLlmModels: async () => h.rows }));
vi.mock('@/lib/llm', () => ({}));
vi.mock('@/lib/llm/registry', () => ({
  getTextProvider: () => ({
    generateText: async (_input: unknown, model: Record<string, unknown>) => {
      h.probes.push(model);
      return { text: 'pong' };
    },
  }),
  getImageProvider: () => ({ generateImage: async () => [{ url: 'x' }] }),
  getVideoProvider: () => ({ createJob: async () => ({ id: 'j1' }) }),
}));
vi.mock('@/lib/llm/poll', () => ({ pollJob: async () => ({ status: 'succeeded' }) }));

import { POST } from './test';
import { runWithContext } from '@/modules/identity/infra/als-tenant-context';
import { PermissionSet } from '@/modules/identity/domain/permission-set';
import { toFeatureKey } from '@/modules/identity/domain/feature-key';

const principal = {
  kind: 'user' as const,
  userId: 'u1',
  tenantId: 'default',
  permissions: PermissionSet.of([toFeatureKey('SETTINGS_LLM')]),
};

function ctx(body: unknown) {
  return {
    request: new Request('http://test/api/settings/llm/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    params: {},
    locals: {},
  } as never;
}

const call = (body: unknown) =>
  runWithContext({ tenantId: 'default', principal }, async () => POST(ctx(body)));

beforeEach(() => {
  h.probes = [];
  h.rows = [
    {
      type: 'text',
      provider: 'openai',
      name: 'prod-gpt',
      modelId: 'gpt-4o',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-live-SECRET',
      options: undefined,
    },
  ];
});

describe('POST /api/settings/llm/test — stored-key reuse', () => {
  it('rejects an empty apiKey when baseUrl differs from the stored row', async () => {
    const res = (await call({
      type: 'text', provider: 'openai', name: 'prod-gpt', modelId: 'gpt-4o',
      baseUrl: 'https://attacker.example.com/v1', apiKey: '',
    })) as Response;
    expect(res.status).toBe(400);
    expect(h.probes).toHaveLength(0);
  });

  it('rejects an empty apiKey when provider differs from the stored row', async () => {
    const res = (await call({
      type: 'text', provider: 'anthropic', name: 'prod-gpt', modelId: 'gpt-4o',
      baseUrl: 'https://api.openai.com/v1', apiKey: '',
    })) as Response;
    expect(res.status).toBe(400);
    expect(h.probes).toHaveLength(0);
  });

  it('rejects an empty apiKey when modelId differs from the stored row', async () => {
    const res = (await call({
      type: 'text', provider: 'openai', name: 'prod-gpt', modelId: 'gpt-4o-mini',
      baseUrl: 'https://api.openai.com/v1', apiKey: '',
    })) as Response;
    expect(res.status).toBe(400);
    expect(h.probes).toHaveLength(0);
  });

  it('allows re-testing the unchanged stored destination', async () => {
    const res = (await call({
      type: 'text', provider: 'openai', name: 'prod-gpt', modelId: 'gpt-4o',
      baseUrl: 'https://api.openai.com/v1', apiKey: '',
    })) as Response;
    expect(res.status).toBe(200);
    expect(h.probes[0]).toMatchObject({ apiKey: 'sk-live-SECRET', baseUrl: 'https://api.openai.com/v1' });
  });

  it('allows an arbitrary destination when the caller supplies its own key', async () => {
    const res = (await call({
      type: 'text', provider: 'openai', name: 'prod-gpt', modelId: 'gpt-4o',
      baseUrl: 'https://attacker.example.com/v1', apiKey: 'sk-caller-own',
    })) as Response;
    expect(res.status).toBe(200);
    expect(h.probes[0]).toMatchObject({ apiKey: 'sk-caller-own' });
  });

  it('trailing-slash differences do not defeat the destination match', async () => {
    const res = (await call({
      type: 'text', provider: 'openai', name: 'prod-gpt', modelId: 'gpt-4o',
      baseUrl: 'https://api.openai.com/v1/', apiKey: '',
    })) as Response;
    expect(res.status).toBe(200);
  });
});
