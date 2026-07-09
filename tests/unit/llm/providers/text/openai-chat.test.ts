import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openaiChatProvider } from '@/lib/llm/providers/text/openai-chat';
import { ProviderHttpError } from '@/lib/llm/errors';
import type { LlmModel } from '@/lib/config/llm-models-types';

const fetchMock = vi.fn();

const MODEL: LlmModel = {
  type: 'text',
  provider: 'openai-chat',
  name: 'openai-prod',
  modelId: 'gpt-4o',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: 'sk-test',
};

function ok(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('openaiChatProvider.generateText', () => {
  it('posts to /chat/completions with correct body and headers', async () => {
    fetchMock.mockResolvedValueOnce(ok({ choices: [{ message: { content: 'hi back' } }] }));
    const out = await openaiChatProvider.generateText(
      {
        modelId: MODEL.modelId,
        messages: [{ role: 'user', content: 'hello' }],
        temperature: 0.2,
        response_format: { type: 'json_object' },
        maxTokens: 256,
      },
      MODEL,
    );
    expect(out.content).toBe('hi back');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'hello' }],
      temperature: 0.2,
      response_format: { type: 'json_object' },
      max_tokens: 256,
    });
    const headers = new Headers((init as RequestInit).headers);
    expect(headers.get('Authorization')).toBe('Bearer sk-test');
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('omits undefined optional fields from body', async () => {
    fetchMock.mockResolvedValueOnce(ok({ choices: [{ message: { content: 'x' } }] }));
    await openaiChatProvider.generateText(
      { modelId: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }] },
      MODEL,
    );
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({ model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }] });
  });

  it('strips trailing slashes from baseUrl', async () => {
    fetchMock.mockResolvedValueOnce(ok({ choices: [{ message: { content: 'x' } }] }));
    await openaiChatProvider.generateText(
      { modelId: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }] },
      { ...MODEL, baseUrl: 'https://api.openai.com/v1///' },
    );
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.openai.com/v1/chat/completions');
  });

  it('writes OpenAI-Organization header when options.organization set', async () => {
    fetchMock.mockResolvedValueOnce(ok({ choices: [{ message: { content: 'x' } }] }));
    await openaiChatProvider.generateText(
      { modelId: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }] },
      { ...MODEL, options: { organization: 'org-123' } },
    );
    const headers = new Headers((fetchMock.mock.calls[0][1] as RequestInit).headers);
    expect(headers.get('OpenAI-Organization')).toBe('org-123');
  });

  it('throws ProviderHttpError on non-2xx', async () => {
    fetchMock.mockResolvedValueOnce(new Response('bad key', { status: 401 }));
    await expect(
      openaiChatProvider.generateText(
        { modelId: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }] },
        MODEL,
      ),
    ).rejects.toBeInstanceOf(ProviderHttpError);
  });

  it('throws when response is missing choices', async () => {
    fetchMock.mockResolvedValueOnce(ok({}));
    await expect(
      openaiChatProvider.generateText(
        { modelId: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }] },
        MODEL,
      ),
    ).rejects.toThrow(/missing choices/i);
  });
});
