import { describe, it, expect, vi, beforeEach } from 'vitest';
import { replicateProvider } from '@/lib/llm/providers/image/replicate';
import type { LlmModel } from '@/lib/config/llm-models-types';

const fetchMock = vi.fn();
const MODEL: LlmModel = {
  type: 'image', provider: 'replicate',
  name: 'r', modelId: 'stability-ai/sdxl:39ed52f2',
  baseUrl: 'https://api.replicate.com', apiKey: 'r8_xxx',
};

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('replicateProvider.generateImage', () => {
  it('uses Token auth and submits version + input', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonRes({
        id: 'p-1',
        status: 'starting',
        urls: { get: 'https://api.replicate.com/v1/predictions/p-1' },
      }))
      .mockResolvedValueOnce(jsonRes({
        id: 'p-1',
        status: 'succeeded',
        output: 'https://replicate.delivery/out.png',
      }));
    const out = await replicateProvider.generateImage(
      { prompt: 'a cat', aspectRatio: '16:9' },
      MODEL,
    );
    expect(out).toEqual([{ type: 'url', url: 'https://replicate.delivery/out.png' }]);
    const [submitUrl, submitInit] = fetchMock.mock.calls[0];
    expect(submitUrl).toBe('https://api.replicate.com/v1/predictions');
    expect(new Headers((submitInit as RequestInit).headers).get('Authorization')).toBe('Token r8_xxx');
    const body = JSON.parse((submitInit as RequestInit).body as string);
    expect(body.version).toBe('39ed52f2');
    expect(body.input).toMatchObject({ prompt: 'a cat', aspect_ratio: '16:9' });
  });

  it('throws when modelId is missing :version', async () => {
    await expect(
      replicateProvider.generateImage(
        { prompt: 'x' },
        { ...MODEL, modelId: 'stability-ai/sdxl' },
      ),
    ).rejects.toThrow(/version/i);
  });

  it('extracts output[0] when output is an array', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonRes({
        id: 'p-2',
        status: 'starting',
        urls: { get: 'https://api.replicate.com/v1/predictions/p-2' },
      }))
      .mockResolvedValueOnce(jsonRes({
        id: 'p-2',
        status: 'succeeded',
        output: ['https://replicate.delivery/a.png', 'https://replicate.delivery/b.png'],
      }));
    const out = await replicateProvider.generateImage({ prompt: 'x' }, MODEL);
    expect(out[0].type).toBe('url');
    if (out[0].type === 'url') expect(out[0].url).toBe('https://replicate.delivery/a.png');
  });

  it('throws when output shape is unsupported', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonRes({
        id: 'p-3',
        status: 'starting',
        urls: { get: 'https://api.replicate.com/v1/predictions/p-3' },
      }))
      .mockResolvedValueOnce(jsonRes({
        id: 'p-3',
        status: 'succeeded',
        output: { weird: 'shape' },
      }));
    await expect(
      replicateProvider.generateImage({ prompt: 'x' }, MODEL),
    ).rejects.toThrow(/output shape/i);
  });

  it('throws when status is failed', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonRes({
        id: 'p-4',
        urls: { get: 'https://api.replicate.com/v1/predictions/p-4' },
      }))
      .mockResolvedValueOnce(jsonRes({
        id: 'p-4',
        status: 'failed',
        error: 'gpu oom',
      }));
    await expect(
      replicateProvider.generateImage({ prompt: 'x' }, MODEL),
    ).rejects.toThrow();
  });

  it('forwards input image as URL string', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonRes({
        id: 'p-5',
        status: 'starting',
        urls: { get: 'https://api.replicate.com/v1/predictions/p-5' },
      }))
      .mockResolvedValueOnce(jsonRes({
        id: 'p-5',
        status: 'succeeded',
        output: 'https://replicate.delivery/x.png',
      }));
    await replicateProvider.generateImage(
      { prompt: 'x', inputImageUrl: 'https://in/a.png' },
      MODEL,
    );
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.input.image).toBe('https://in/a.png');
  });
});
