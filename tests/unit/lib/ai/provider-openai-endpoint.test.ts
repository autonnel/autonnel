import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateText } from 'ai';

const model = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock('@/lib/config/llm-models', () => ({ getLlmModel: async () => model.current }));

import { resolveLlmModel } from '@/lib/ai/provider';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

async function requestedUrl(): Promise<string> {
  const urls: string[] = [];
  globalThis.fetch = (async (url: unknown) => {
    urls.push(String(url));
    return new Response('{"error":{"message":"stub"}}', { status: 400, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  const resolved = await resolveLlmModel();
  await generateText({ model: resolved.model, prompt: 'hi', maxRetries: 0 }).catch(() => undefined);
  return urls[0];
}

describe('resolveLlmModel', () => {
  it('sends openai-chat models to /chat/completions, not the Responses API', async () => {
    model.current = {
      name: 'ds', type: 'text', apiKey: 'k', baseUrl: 'https://api.deepseek.com/',
      modelId: 'deepseek-chat', provider: 'openai-chat', isDefault: true,
    };
    expect(await requestedUrl()).toBe('https://api.deepseek.com/chat/completions');
  });
});
