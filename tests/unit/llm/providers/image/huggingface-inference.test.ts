import { describe, it, expect, vi, beforeEach } from 'vitest';
import { huggingfaceInferenceProvider } from '@/lib/llm/providers/image/huggingface-inference';
import { ProviderHttpError } from '@/lib/llm/errors';
import type { LlmModel } from '@/lib/config/llm-models-types';

const fetchMock = vi.fn();
const MODEL: LlmModel = {
  type: 'image', provider: 'huggingface-inference',
  name: 'r', modelId: 'black-forest-labs/FLUX.1-schnell',
  baseUrl: 'https://api-inference.huggingface.co', apiKey: 'hf-token',
};

function binaryRes(bytes: number[], mime = 'image/png'): Response {
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: { 'content-type': mime },
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('huggingfaceInferenceProvider.generateImage', () => {
  it('posts to /models/{modelId} with Bearer + inputs/parameters body', async () => {
    fetchMock.mockResolvedValueOnce(binaryRes([0x89, 0x50, 0x4e, 0x47]));
    const out = await huggingfaceInferenceProvider.generateImage(
      { prompt: 'a cat', aspectRatio: '1:1' },
      MODEL,
    );
    expect(out[0].type).toBe('base64');
    if (out[0].type === 'base64') {
      expect(out[0].mimeType).toBe('image/png');
      expect(out[0].data.length).toBeGreaterThan(0);
    }
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell');
    expect(new Headers((init as RequestInit).headers).get('Authorization')).toBe('Bearer hf-token');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({ inputs: 'a cat', parameters: { width: 1024, height: 1024 } });
  });

  it('maps aspectRatio 16:9 to 1344x768', async () => {
    fetchMock.mockResolvedValueOnce(binaryRes([1]));
    await huggingfaceInferenceProvider.generateImage({ prompt: 'x', aspectRatio: '16:9' }, MODEL);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.parameters).toEqual({ width: 1344, height: 768 });
  });

  it('falls back to 1024x1024 for unsupported aspect ratio', async () => {
    fetchMock.mockResolvedValueOnce(binaryRes([1]));
    await huggingfaceInferenceProvider.generateImage({ prompt: 'x', aspectRatio: 'weird' }, MODEL);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.parameters).toEqual({ width: 1024, height: 1024 });
  });

  it('does not include input image — caller fields are dropped with a warn', async () => {
    fetchMock.mockResolvedValueOnce(binaryRes([1]));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      await huggingfaceInferenceProvider.generateImage(
        { prompt: 'x', inputImageUrl: 'https://in/a.png' },
        MODEL,
      );
      const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
      expect(body).toEqual({ inputs: 'x', parameters: { width: 1024, height: 1024 } });
    } finally {
      warn.mockRestore();
    }
  });

  it('throws ProviderHttpError on 503', async () => {
    fetchMock.mockResolvedValue(new Response('cold', { status: 503 }));
    await expect(
      huggingfaceInferenceProvider.generateImage({ prompt: 'x' }, MODEL),
    ).rejects.toBeInstanceOf(ProviderHttpError);
  });
});
