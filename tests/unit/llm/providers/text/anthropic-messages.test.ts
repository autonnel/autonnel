import { describe, it, expect, vi, beforeEach } from 'vitest';
import { anthropicMessagesProvider } from '@/lib/llm/providers/text/anthropic-messages';
import { ProviderHttpError } from '@/lib/llm/errors';
import type { LlmModel } from '@/lib/config/llm-models-types';

const fetchMock = vi.fn();
const MODEL: LlmModel = {
  type: 'text',
  provider: 'anthropic-messages',
  name: 'anthropic-prod',
  modelId: 'claude-sonnet-4-5-20250929',
  baseUrl: 'https://api.anthropic.com',
  apiKey: 'sk-ant-test',
};

function ok(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('anthropicMessagesProvider.generateText', () => {
  it('posts to /v1/messages with correct headers', async () => {
    fetchMock.mockResolvedValueOnce(ok({ content: [{ type: 'text', text: 'hi' }] }));
    await anthropicMessagesProvider.generateText(
      { modelId: 'claude-sonnet-4-5-20250929', messages: [{ role: 'user', content: 'hello' }] },
      MODEL,
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    const headers = new Headers((init as RequestInit).headers);
    expect(headers.get('x-api-key')).toBe('sk-ant-test');
    expect(headers.get('anthropic-version')).toBe('2023-06-01');
    expect(headers.get('content-type')).toBe('application/json');
  });

  it('extracts a single system message to top-level system field', async () => {
    fetchMock.mockResolvedValueOnce(ok({ content: [{ type: 'text', text: 'x' }] }));
    await anthropicMessagesProvider.generateText(
      {
        modelId: 'claude-sonnet-4-5-20250929',
        messages: [
          { role: 'system', content: 'You are helpful.' },
          { role: 'user', content: 'hi' },
        ],
      },
      MODEL,
    );
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.system).toBe('You are helpful.');
    expect(body.messages).toEqual([{ role: 'user', content: 'hi' }]);
  });

  it('joins multiple system messages with double newline', async () => {
    fetchMock.mockResolvedValueOnce(ok({ content: [{ type: 'text', text: 'x' }] }));
    await anthropicMessagesProvider.generateText(
      {
        modelId: 'claude-sonnet-4-5-20250929',
        messages: [
          { role: 'system', content: 'rule one' },
          { role: 'system', content: 'rule two' },
          { role: 'user', content: 'go' },
        ],
      },
      MODEL,
    );
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.system).toBe('rule one\n\nrule two');
  });

  it('translates image_url content parts to Anthropic image blocks', async () => {
    fetchMock.mockResolvedValueOnce(ok({ content: [{ type: 'text', text: 'ok' }] }));
    await anthropicMessagesProvider.generateText(
      {
        modelId: 'claude-sonnet-4-5-20250929',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'describe' },
              { type: 'image_url', image_url: { url: 'https://x/y.png' } },
            ],
          },
        ],
      },
      MODEL,
    );
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.messages[0].content).toEqual([
      { type: 'text', text: 'describe' },
      { type: 'image', source: { type: 'url', url: 'https://x/y.png' } },
    ]);
  });

  it('drops response_format and reasoning_effort silently', async () => {
    fetchMock.mockResolvedValueOnce(ok({ content: [{ type: 'text', text: 'x' }] }));
    await anthropicMessagesProvider.generateText(
      {
        modelId: 'claude-sonnet-4-5-20250929',
        messages: [{ role: 'user', content: 'hi' }],
        response_format: { type: 'json_object' },
        reasoning_effort: 'high',
      },
      MODEL,
    );
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.response_format).toBeUndefined();
    expect(body.reasoning_effort).toBeUndefined();
  });

  it('defaults max_tokens to 4096 when caller omits it', async () => {
    fetchMock.mockResolvedValueOnce(ok({ content: [{ type: 'text', text: 'x' }] }));
    await anthropicMessagesProvider.generateText(
      { modelId: 'claude-sonnet-4-5-20250929', messages: [{ role: 'user', content: 'hi' }] },
      MODEL,
    );
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.max_tokens).toBe(4096);
  });

  it('respects caller-provided max_tokens', async () => {
    fetchMock.mockResolvedValueOnce(ok({ content: [{ type: 'text', text: 'x' }] }));
    await anthropicMessagesProvider.generateText(
      { modelId: 'claude-sonnet-4-5-20250929', messages: [{ role: 'user', content: 'hi' }], maxTokens: 1024 },
      MODEL,
    );
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.max_tokens).toBe(1024);
  });

  it('overrides anthropic-version header via options.anthropicVersion', async () => {
    fetchMock.mockResolvedValueOnce(ok({ content: [{ type: 'text', text: 'x' }] }));
    await anthropicMessagesProvider.generateText(
      { modelId: 'claude-sonnet-4-5-20250929', messages: [{ role: 'user', content: 'hi' }] },
      { ...MODEL, options: { anthropicVersion: '2024-01-01' } },
    );
    const headers = new Headers((fetchMock.mock.calls[0][1] as RequestInit).headers);
    expect(headers.get('anthropic-version')).toBe('2024-01-01');
  });

  it('concatenates multiple text blocks in the response', async () => {
    fetchMock.mockResolvedValueOnce(ok({
      content: [
        { type: 'text', text: 'first' },
        { type: 'tool_use', id: 't1' },
        { type: 'text', text: 'second' },
      ],
    }));
    const out = await anthropicMessagesProvider.generateText(
      { modelId: 'claude-sonnet-4-5-20250929', messages: [{ role: 'user', content: 'hi' }] },
      MODEL,
    );
    expect(out.content).toBe('firstsecond');
  });

  it('throws ProviderHttpError on non-2xx', async () => {
    fetchMock.mockResolvedValueOnce(new Response('bad key', { status: 401 }));
    await expect(
      anthropicMessagesProvider.generateText(
        { modelId: 'claude-sonnet-4-5-20250929', messages: [{ role: 'user', content: 'hi' }] },
        MODEL,
      ),
    ).rejects.toBeInstanceOf(ProviderHttpError);
  });

  it('strips trailing slashes from baseUrl', async () => {
    fetchMock.mockResolvedValueOnce(ok({ content: [{ type: 'text', text: 'x' }] }));
    await anthropicMessagesProvider.generateText(
      { modelId: 'claude-sonnet-4-5-20250929', messages: [{ role: 'user', content: 'hi' }] },
      { ...MODEL, baseUrl: 'https://api.anthropic.com///' },
    );
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.anthropic.com/v1/messages');
  });
});
