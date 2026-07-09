import { describe, it, expect, vi, beforeEach } from 'vitest';
import { geminiImageProvider } from '@/lib/llm/providers/image/gemini-image';
import { ProviderHttpError } from '@/lib/llm/errors';
import type { LlmModel } from '@/lib/config/llm-models-types';

const fetchMock = vi.fn();
const MODEL: LlmModel = {
  type: 'image', provider: 'gemini-image',
  name: 'r', modelId: 'imagen-4.0-generate-001',
  baseUrl: 'https://generativelanguage.googleapis.com', apiKey: 'AIza-test',
};

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('geminiImageProvider.generateImage', () => {
  it('POSTs to ?key=apikey URL with contents and generationConfig', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({
      candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'AAA=' } }] } }],
    }));
    const out = await geminiImageProvider.generateImage(
      { prompt: 'a cat', aspectRatio: '16:9' },
      MODEL,
    );
    expect(out).toEqual([{ type: 'base64', data: 'AAA=', mimeType: 'image/png' }]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:generateContent?key=AIza-test');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.contents[0].parts[0]).toEqual({ text: 'a cat' });
    expect(body.generationConfig.aspectRatio).toBe('16:9');
    expect(body.generationConfig.responseModalities).toEqual(['IMAGE']);
  });

  it('falls back to 1:1 for unsupported aspect ratio', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({
      candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'A' } }] } }],
    }));
    await geminiImageProvider.generateImage({ prompt: 'x', aspectRatio: '21:9' }, MODEL);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.generationConfig.aspectRatio).toBe('1:1');
  });

  it('includes base64 input image as inlineData part', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({
      candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'A' } }] } }],
    }));
    await geminiImageProvider.generateImage(
      { prompt: 'edit', inputImageBase64: 'IMG', inputImageMimeType: 'image/jpeg' },
      MODEL,
    );
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.contents[0].parts).toContainEqual({
      inlineData: { mimeType: 'image/jpeg', data: 'IMG' },
    });
  });

  it('fetches URL input image, converts to base64, includes as inlineData', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(new Uint8Array([0x89, 0x50]), {
        status: 200,
        headers: { 'content-type': 'image/png' },
      }))
      .mockResolvedValueOnce(jsonRes({
        candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'A' } }] } }],
      }));
    await geminiImageProvider.generateImage(
      { prompt: 'edit', inputImageUrl: 'https://example.com/in.png' },
      MODEL,
    );
    const body = JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string);
    const inline = body.contents[0].parts.find((p: any) => p.inlineData);
    expect(inline.inlineData.mimeType).toBe('image/png');
    expect(typeof inline.inlineData.data).toBe('string');
    expect(inline.inlineData.data.length).toBeGreaterThan(0);
  });

  it('throws ProviderHttpError on 4xx', async () => {
    fetchMock.mockResolvedValueOnce(new Response('bad', { status: 403 }));
    await expect(
      geminiImageProvider.generateImage({ prompt: 'x' }, MODEL),
    ).rejects.toBeInstanceOf(ProviderHttpError);
  });

  it('throws when response has no inlineData part', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({ candidates: [{ content: { parts: [{ text: 'oops' }] } }] }));
    await expect(
      geminiImageProvider.generateImage({ prompt: 'x' }, MODEL),
    ).rejects.toThrow(/missing inlineData/i);
  });
});
