import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LlmModel } from '@/lib/config/llm-models-types';

const { getLlmModelMock } = vi.hoisted(() => ({ getLlmModelMock: vi.fn() }));
vi.mock('@/lib/config/llm-models', () => ({ getLlmModel: getLlmModelMock }));

import '@/lib/llm';
import { callText } from '@/lib/llm/call-text';
import { LlmNotConfiguredError, UnknownProviderError } from '@/lib/llm/errors';

const TEXT_DEFAULT: LlmModel = {
  type: 'text', provider: 'openai-chat',
  name: 'openai-prod', modelId: 'gpt-4o',
  baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-default',
  isDefault: true,
};

const fetchMock = vi.fn();
function ok(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

beforeEach(() => {
  getLlmModelMock.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('callText', () => {
  it('throws LlmNotConfiguredError when no row resolves', async () => {
    getLlmModelMock.mockResolvedValue(undefined);
    await expect(
      callText({ messages: [{ role: 'user', content: 'hi' }] }),
    ).rejects.toBeInstanceOf(LlmNotConfiguredError);
  });

  it('routes to OpenAI Chat provider for openai-chat rows', async () => {
    getLlmModelMock.mockResolvedValue(TEXT_DEFAULT);
    fetchMock.mockResolvedValueOnce(ok({ choices: [{ message: { content: 'hi back' } }] }));
    const out = await callText({ messages: [{ role: 'user', content: 'hi' }] });
    expect(out).toBe('hi back');
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.openai.com/v1/chat/completions');
  });

  it('routes to Anthropic provider for anthropic-messages rows', async () => {
    getLlmModelMock.mockResolvedValue({
      ...TEXT_DEFAULT,
      provider: 'anthropic-messages',
      modelId: 'claude-sonnet-4-5-20250929',
      baseUrl: 'https://api.anthropic.com',
    });
    fetchMock.mockResolvedValueOnce(ok({ content: [{ type: 'text', text: 'hi' }] }));
    await callText({ messages: [{ role: 'user', content: 'hi' }] });
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.anthropic.com/v1/messages');
  });

  it('throws UnknownProviderError when row.provider is not registered', async () => {
    getLlmModelMock.mockResolvedValue({ ...TEXT_DEFAULT, provider: 'mystery' });
    await expect(
      callText({ messages: [{ role: 'user', content: 'hi' }] }),
    ).rejects.toBeInstanceOf(UnknownProviderError);
  });

  it('uses explicit modelName when provided', async () => {
    const explicit: LlmModel = {
      ...TEXT_DEFAULT, name: 'gpt-4o-mini', modelId: 'gpt-4o-mini',
    };
    getLlmModelMock.mockImplementation((type: string, name?: string) => {
      if (name === 'gpt-4o-mini') return Promise.resolve(explicit);
      if (name === undefined || name === '') return Promise.resolve(TEXT_DEFAULT);
      return Promise.resolve(undefined);
    });
    fetchMock.mockResolvedValueOnce(ok({ choices: [{ message: { content: 'x' } }] }));
    await callText({ modelName: 'gpt-4o-mini', messages: [{ role: 'user', content: 'hi' }] });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.model).toBe('gpt-4o-mini');
  });

  it('falls back to default when explicit modelName is not found', async () => {
    getLlmModelMock.mockImplementation((type: string, name?: string) => {
      if (name && name.length > 0) return Promise.resolve(undefined);
      return Promise.resolve(TEXT_DEFAULT);
    });
    fetchMock.mockResolvedValueOnce(ok({ choices: [{ message: { content: 'fb' } }] }));
    const out = await callText({ modelName: 'nope', messages: [{ role: 'user', content: 'hi' }] });
    expect(out).toBe('fb');
  });

  it('passes temperature and response_format through to provider', async () => {
    getLlmModelMock.mockResolvedValue(TEXT_DEFAULT);
    fetchMock.mockResolvedValueOnce(ok({ choices: [{ message: { content: '{}' } }] }));
    await callText({
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.temperature).toBe(0.7);
    expect(body.response_format).toEqual({ type: 'json_object' });
  });
});
