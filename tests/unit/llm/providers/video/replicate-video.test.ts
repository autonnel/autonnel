import { describe, it, expect, vi, beforeEach } from 'vitest';
import { replicateVideoProvider } from '@/lib/llm/providers/video/replicate-video';
import type { LlmModel } from '@/lib/config/llm-models-types';

const fetchMock = vi.fn();
const MODEL: LlmModel = {
  type: 'video', provider: 'replicate-video',
  name: 'r', modelId: 'tencent/hunyuan-video:abc123def',
  baseUrl: 'https://api.replicate.com', apiKey: 'r8_xxx',
};

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('replicateVideoProvider.createJob', () => {
  it('POSTs /v1/predictions with Token auth and version split', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({
      id: 'p-1', status: 'starting', urls: { get: 'https://api.replicate.com/v1/predictions/p-1' },
    }));
    const out = await replicateVideoProvider.createJob(
      { prompt: 'a cat', aspectRatio: '16:9', duration: 5 },
      MODEL,
    );
    expect(out.id).toBe('p-1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.replicate.com/v1/predictions');
    const headers = new Headers((init as RequestInit).headers);
    expect(headers.get('Authorization')).toBe('Token r8_xxx');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.version).toBe('abc123def');
    expect(body.input).toMatchObject({ prompt: 'a cat', aspect_ratio: '16:9', duration: 5 });
  });

  it('throws when modelId is missing :version', async () => {
    await expect(
      replicateVideoProvider.createJob(
        { prompt: 'x' },
        { ...MODEL, modelId: 'tencent/hunyuan-video' },
      ),
    ).rejects.toThrow(/version/i);
  });

  it('forwards image URL as input.image', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({
      id: 'p-2', urls: { get: 'https://api.replicate.com/v1/predictions/p-2' },
    }));
    await replicateVideoProvider.createJob(
      { prompt: 'x', image: 'https://in/a.png' },
      MODEL,
    );
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.input.image).toBe('https://in/a.png');
  });

  it('forwards data URL image as input.image (Replicate accepts data URLs)', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({
      id: 'p-3', urls: { get: 'https://api.replicate.com/v1/predictions/p-3' },
    }));
    await replicateVideoProvider.createJob(
      { prompt: 'x', image: 'data:image/png;base64,AAAA' },
      MODEL,
    );
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.input.image).toBe('data:image/png;base64,AAAA');
  });
});

describe('replicateVideoProvider.getJob', () => {
  it('GETs the prediction endpoint with Token auth', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({
      id: 'p-4', status: 'succeeded',
      output: 'https://replicate.delivery/v.mp4',
    }));
    const job = await replicateVideoProvider.getJob('p-4', MODEL);
    expect(job.status).toBe('succeeded');
    expect(job.outputUrl).toBe('https://replicate.delivery/v.mp4');
    const headers = new Headers((fetchMock.mock.calls[0][1] as RequestInit).headers);
    expect(headers.get('Authorization')).toBe('Token r8_xxx');
  });

  it('extracts output[0] when output is an array of URLs', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({
      id: 'p-5', status: 'succeeded',
      output: ['https://replicate.delivery/v1.mp4', 'https://replicate.delivery/v2.mp4'],
    }));
    const job = await replicateVideoProvider.getJob('p-5', MODEL);
    expect(job.outputUrl).toBe('https://replicate.delivery/v1.mp4');
  });

  it('maps processing/starting to processing', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({ id: 'p-6', status: 'processing' }));
    const job = await replicateVideoProvider.getJob('p-6', MODEL);
    expect(job.status).toBe('processing');
  });

  it('throws on unsupported output shape', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({
      id: 'p-7', status: 'succeeded', output: { weird: 'shape' },
    }));
    await expect(replicateVideoProvider.getJob('p-7', MODEL)).rejects.toThrow(/output shape/i);
  });

  it('maps failed status with error', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({
      id: 'p-8', status: 'failed', error: 'gpu oom',
    }));
    const job = await replicateVideoProvider.getJob('p-8', MODEL);
    expect(job.status).toBe('failed');
    expect(job.error).toMatch(/gpu oom/);
  });
});
