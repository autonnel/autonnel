import { describe, it, expect, vi, beforeEach } from 'vitest';
import { stabilityProvider } from '@/lib/llm/providers/image/stability';
import { ProviderHttpError } from '@/lib/llm/errors';
import type { LlmModel } from '@/lib/config/llm-models-types';

const fetchMock = vi.fn();
const MODEL: LlmModel = {
  type: 'image', provider: 'stability',
  name: 'r', modelId: 'sd3.5-large',
  baseUrl: 'https://api.stability.ai', apiKey: 'sk-stab',
  options: { endpoint: 'sd3' },
};

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('stabilityProvider.generateImage', () => {
  it('POSTs multipart to /v2beta/stable-image/generate/{endpoint} with Bearer auth', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({ image: 'BASE64DATA', finish_reason: 'SUCCESS' }));
    const out = await stabilityProvider.generateImage(
      { prompt: 'a cat', aspectRatio: '16:9' },
      MODEL,
    );
    expect(out).toEqual([{ type: 'base64', data: 'BASE64DATA', mimeType: 'image/png' }]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.stability.ai/v2beta/stable-image/generate/sd3');
    expect((init as RequestInit).body).toBeInstanceOf(FormData);
    const headers = new Headers((init as RequestInit).headers);
    expect(headers.get('Authorization')).toBe('Bearer sk-stab');
    expect(headers.get('Accept')).toBe('application/json');
  });

  it('falls back to 1:1 for unsupported aspect ratio', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({ image: 'X' }));
    await stabilityProvider.generateImage({ prompt: 'x', aspectRatio: 'weird' }, MODEL);
    const form = fetchMock.mock.calls[0][1].body as FormData;
    expect(form.get('aspect_ratio')).toBe('1:1');
  });

  it('switches to image-to-image mode when inputImage given', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({ image: 'X' }));
    await stabilityProvider.generateImage(
      { prompt: 'edit', inputImageBase64: 'AAA', inputImageMimeType: 'image/png', aspectRatio: '1:1' },
      MODEL,
    );
    const form = fetchMock.mock.calls[0][1].body as FormData;
    expect(form.get('mode')).toBe('image-to-image');
    expect(form.get('image')).toBeInstanceOf(Blob);
  });

  it('infers endpoint from modelId when options.endpoint absent', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({ image: 'X' }));
    await stabilityProvider.generateImage(
      { prompt: 'x' },
      { ...MODEL, options: undefined, modelId: 'sd3.5-large' },
    );
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.stability.ai/v2beta/stable-image/generate/sd3');
  });

  it('throws ProviderHttpError on 400', async () => {
    fetchMock.mockResolvedValueOnce(new Response('bad', { status: 400 }));
    await expect(
      stabilityProvider.generateImage({ prompt: 'x' }, MODEL),
    ).rejects.toBeInstanceOf(ProviderHttpError);
  });
});
