import { describe, it, expect, vi, beforeEach } from 'vitest';
import { falProvider } from '@/lib/llm/providers/image/fal';
import type { LlmModel } from '@/lib/config/llm-models-types';

const fetchMock = vi.fn();
const MODEL: LlmModel = {
  type: 'image', provider: 'fal',
  name: 'r', modelId: 'fal-ai/flux-pro/v1.1',
  baseUrl: 'https://queue.fal.run', apiKey: 'fal-key',
};

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('falProvider.generateImage', () => {
  it('uses Key auth, posts to /{modelId}, polls status, fetches result', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonRes({
        request_id: 'req-1',
        status_url: 'https://queue.fal.run/fal-ai/flux-pro/v1.1/requests/req-1/status',
        response_url: 'https://queue.fal.run/fal-ai/flux-pro/v1.1/requests/req-1',
      }))
      .mockResolvedValueOnce(jsonRes({ status: 'COMPLETED' }))
      .mockResolvedValueOnce(jsonRes({ images: [{ url: 'https://fal.media/x.png' }] }));
    const out = await falProvider.generateImage(
      { prompt: 'a cat', aspectRatio: '16:9' },
      MODEL,
    );
    expect(out).toEqual([{ type: 'url', url: 'https://fal.media/x.png' }]);
    const [submitUrl, submitInit] = fetchMock.mock.calls[0];
    expect(submitUrl).toBe('https://queue.fal.run/fal-ai/flux-pro/v1.1');
    expect(new Headers((submitInit as RequestInit).headers).get('Authorization')).toBe('Key fal-key');
    const body = JSON.parse((submitInit as RequestInit).body as string);
    expect(body.image_size).toBe('landscape_16_9');
  });

  it('maps aspectRatio 1:1 to square_hd', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonRes({
        request_id: 'r',
        status_url: 'https://queue.fal.run/x/requests/r/status',
        response_url: 'https://queue.fal.run/x/requests/r',
      }))
      .mockResolvedValueOnce(jsonRes({ status: 'COMPLETED' }))
      .mockResolvedValueOnce(jsonRes({ images: [{ url: 'x' }] }));
    await falProvider.generateImage({ prompt: 'x', aspectRatio: '1:1' }, MODEL);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.image_size).toBe('square_hd');
  });

  it('falls back to square_hd for unsupported aspect ratio', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonRes({
        request_id: 'r',
        status_url: 'https://queue.fal.run/x/requests/r/status',
        response_url: 'https://queue.fal.run/x/requests/r',
      }))
      .mockResolvedValueOnce(jsonRes({ status: 'COMPLETED' }))
      .mockResolvedValueOnce(jsonRes({ images: [{ url: 'x' }] }));
    await falProvider.generateImage({ prompt: 'x', aspectRatio: 'weird' }, MODEL);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.image_size).toBe('square_hd');
  });

  it('throws when status is FAILED', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonRes({
        request_id: 'r',
        status_url: 'https://queue.fal.run/x/requests/r/status',
        response_url: 'https://queue.fal.run/x/requests/r',
      }))
      .mockResolvedValueOnce(jsonRes({ status: 'FAILED', error: 'bad' }));
    await expect(
      falProvider.generateImage({ prompt: 'x' }, MODEL),
    ).rejects.toThrow();
  });

  it('forwards inputImageUrl as image_urls by default', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonRes({
        request_id: 'r',
        status_url: 'https://queue.fal.run/x/requests/r/status',
        response_url: 'https://queue.fal.run/x/requests/r',
      }))
      .mockResolvedValueOnce(jsonRes({ status: 'COMPLETED' }))
      .mockResolvedValueOnce(jsonRes({ images: [{ url: 'x' }] }));
    await falProvider.generateImage(
      { prompt: 'edit', inputImageUrl: 'https://in/a.png' },
      MODEL,
    );
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.image_urls).toEqual(['https://in/a.png']);
  });

  it('can forward inputImageUrl as legacy image_url when configured', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonRes({
        request_id: 'r',
        status_url: 'https://queue.fal.run/x/requests/r/status',
        response_url: 'https://queue.fal.run/x/requests/r',
      }))
      .mockResolvedValueOnce(jsonRes({ status: 'COMPLETED' }))
      .mockResolvedValueOnce(jsonRes({ images: [{ url: 'x' }] }));
    await falProvider.generateImage(
      { prompt: 'edit', inputImageUrl: 'https://in/a.png' },
      { ...MODEL, options: { inputImageParam: 'image_url' } },
    );
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.image_url).toBe('https://in/a.png');
  });
});
