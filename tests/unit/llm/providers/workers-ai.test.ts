// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { workersAiTextProvider, workersAiImageProvider } from '@/lib/llm/providers/workers-ai';
import { setRuntimeEnv } from '@/lib/runtime/env';
import type { LlmModel } from '@/lib/config/llm-models-types';

const ACCOUNT = '0123456789abcdef0123456789abcdef';
const REST_BASE = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/ai/v1`;
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 9]);

const fetchMock = vi.fn();

function model(type: 'text' | 'image', modelId: string, baseUrl = REST_BASE): LlmModel {
  return { type, provider: 'workers-ai', name: 'cf', modelId, baseUrl, apiKey: baseUrl ? 'cf-token' : '' };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  setRuntimeEnv(undefined);
});

describe('workersAiTextProvider', () => {
  it('runs through the AI binding when the base URL is empty', async () => {
    const run = vi.fn().mockResolvedValue({ response: 'hello from binding' });
    setRuntimeEnv({ AI: { run } });

    const out = await workersAiTextProvider.generateText(
      {
        modelId: '@cf/zai-org/glm-4.7-flash',
        messages: [{ role: 'system', content: 'be brief' }, { role: 'user', content: 'hi' }],
        maxTokens: 64,
      },
      model('text', '@cf/zai-org/glm-4.7-flash', ''),
    );

    expect(out.content).toBe('hello from binding');
    expect(fetchMock).not.toHaveBeenCalled();
    const [modelId, inputs] = run.mock.calls[0];
    expect(modelId).toBe('@cf/zai-org/glm-4.7-flash');
    expect(inputs.messages).toEqual([
      { role: 'system', content: 'be brief' },
      { role: 'user', content: 'hi' },
    ]);
    expect(inputs.max_tokens).toBe(64);
  });

  it('calls the account REST endpoint with the API token', async () => {
    fetchMock.mockResolvedValueOnce(json({ success: true, result: { response: 'hello from rest' } }));

    const out = await workersAiTextProvider.generateText(
      { modelId: '@cf/zai-org/glm-4.7-flash', messages: [{ role: 'user', content: 'hi' }] },
      model('text', '@cf/zai-org/glm-4.7-flash'),
    );

    expect(out.content).toBe('hello from rest');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/ai/run/@cf/zai-org/glm-4.7-flash`);
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer cf-token');
  });

  it('explains the missing binding instead of failing obscurely', async () => {
    await expect(
      workersAiTextProvider.generateText(
        { modelId: '@cf/x', messages: [{ role: 'user', content: 'hi' }] },
        model('text', '@cf/x', ''),
      ),
    ).rejects.toThrow(/no "AI" binding/);
  });

  it('rejects a REST base URL outside the Cloudflare account API', async () => {
    await expect(
      workersAiTextProvider.generateText(
        { modelId: '@cf/x', messages: [{ role: 'user', content: 'hi' }] },
        model('text', '@cf/x', 'https://evil.example/ai/v1'),
      ),
    ).rejects.toThrow(/must look like/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('workersAiImageProvider', () => {
  it('decodes base64 JSON output (FLUX) over REST', async () => {
    fetchMock.mockResolvedValueOnce(json({ success: true, result: { image: Buffer.from(JPEG).toString('base64') } }));

    const [out] = await workersAiImageProvider.generateImage(
      { prompt: 'cube', aspectRatio: '1:1' },
      model('image', '@cf/black-forest-labs/flux-1-schnell'),
    );

    expect(out).toEqual({ type: 'base64', data: Buffer.from(JPEG).toString('base64'), mimeType: 'image/jpeg' });
  });

  it('reads binary image output (SDXL) over REST and sends the aspect-ratio size', async () => {
    fetchMock.mockResolvedValueOnce(new Response(PNG, { status: 200, headers: { 'content-type': 'image/png' } }));

    const [out] = await workersAiImageProvider.generateImage(
      { prompt: 'cube', aspectRatio: '16:9' },
      model('image', '@cf/stabilityai/stable-diffusion-xl-base-1.0'),
    );

    expect(out).toMatchObject({ type: 'base64', mimeType: 'image/png', data: Buffer.from(PNG).toString('base64') });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ prompt: 'cube', width: 1344, height: 768 });
  });

  it('retries without dimensions when the model rejects width/height', async () => {
    fetchMock
      .mockResolvedValueOnce(json({
        success: false,
        errors: [{ code: 5006, message: "AiError: Bad input: Error: Additional or unevaluated properties '/height, /width' at '/' not allowed" }],
      }, 400))
      .mockResolvedValueOnce(json({ success: true, result: { image: Buffer.from(JPEG).toString('base64') } }));

    const [out] = await workersAiImageProvider.generateImage(
      { prompt: 'cube', aspectRatio: '16:9' },
      model('image', '@cf/black-forest-labs/flux-1-schnell'),
    );

    expect(out.type).toBe('base64');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ prompt: 'cube' });
  });

  it('does not retry other input errors', async () => {
    fetchMock.mockResolvedValueOnce(json({ success: false, errors: [{ code: 5006, message: 'prompt too long' }] }, 400));

    await expect(
      workersAiImageProvider.generateImage({ prompt: 'cube' }, model('image', '@cf/black-forest-labs/flux-1-schnell')),
    ).rejects.toThrow(/prompt too long/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reads a ReadableStream from the AI binding', async () => {
    const run = vi.fn().mockResolvedValue(new Response(PNG).body);
    setRuntimeEnv({ AI: { run } });

    const [out] = await workersAiImageProvider.generateImage(
      { prompt: 'cube' },
      model('image', '@cf/stabilityai/stable-diffusion-xl-base-1.0', ''),
    );

    expect(out).toMatchObject({ mimeType: 'image/png', data: Buffer.from(PNG).toString('base64') });
    expect(run).toHaveBeenCalledWith('@cf/stabilityai/stable-diffusion-xl-base-1.0', { prompt: 'cube', width: 1024, height: 1024 });
  });
});
