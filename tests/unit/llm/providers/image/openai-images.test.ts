import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openaiImagesProvider } from '@/lib/llm/providers/image/openai-images';
import { ProviderHttpError } from '@/lib/llm/errors';
import type { LlmModel } from '@/lib/config/llm-models-types';

const fetchMock = vi.fn();
const MODEL: LlmModel = {
  type: 'image', provider: 'openai-images',
  name: 'r', modelId: 'gpt-image-1',
  baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-test',
};

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('openaiImagesProvider.generateImage', () => {
  it('POSTs /images/generations with body fields and bearer auth', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({ data: [{ b64_json: 'aGVsbG8=' }] }));
    const out = await openaiImagesProvider.generateImage(
      { prompt: 'a cat', aspectRatio: '1:1' },
      MODEL,
    );
    expect(out).toEqual([{ type: 'base64', data: 'aGVsbG8=', mimeType: 'image/png' }]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/images/generations');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({
      model: 'gpt-image-1',
      prompt: 'a cat',
      size: '1024x1024',
      n: 1,
      response_format: 'b64_json',
    });
    const headers = new Headers((init as RequestInit).headers);
    expect(headers.get('Authorization')).toBe('Bearer sk-test');
  });

  it('maps aspectRatio 16:9 to size 1792x1024', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({ data: [{ b64_json: 'x' }] }));
    await openaiImagesProvider.generateImage({ prompt: 'x', aspectRatio: '16:9' }, MODEL);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.size).toBe('1792x1024');
  });

  it('maps aspectRatio 9:16 to size 1024x1792', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({ data: [{ b64_json: 'x' }] }));
    await openaiImagesProvider.generateImage({ prompt: 'x', aspectRatio: '9:16' }, MODEL);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.size).toBe('1024x1792');
  });

  it('writes OpenAI-Organization header when options.organization set', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({ data: [{ b64_json: 'x' }] }));
    await openaiImagesProvider.generateImage(
      { prompt: 'x' },
      { ...MODEL, options: { organization: 'org-1' } },
    );
    const headers = new Headers((fetchMock.mock.calls[0][1] as RequestInit).headers);
    expect(headers.get('OpenAI-Organization')).toBe('org-1');
  });

  it('uses /images/edits multipart endpoint when input image given', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'content-type': 'image/png' },
      }))
      .mockResolvedValueOnce(jsonRes({ data: [{ b64_json: 'edited' }] }));
    const out = await openaiImagesProvider.generateImage(
      { prompt: 'edit', inputImageUrl: 'https://example.com/in.png', aspectRatio: '1:1' },
      MODEL,
    );
    expect(out[0]).toEqual({ type: 'base64', data: 'edited', mimeType: 'image/png' });
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.openai.com/v1/images/edits');
    const init = fetchMock.mock.calls[1][1] as RequestInit;
    expect(init.body).toBeInstanceOf(FormData);
  });

  it('throws ProviderHttpError on 401', async () => {
    fetchMock.mockResolvedValueOnce(new Response('bad key', { status: 401 }));
    await expect(
      openaiImagesProvider.generateImage({ prompt: 'x' }, MODEL),
    ).rejects.toBeInstanceOf(ProviderHttpError);
  });
});
