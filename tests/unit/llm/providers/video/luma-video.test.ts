import { describe, it, expect, vi, beforeEach } from 'vitest';
import { lumaVideoProvider } from '@/lib/llm/providers/video/luma-video';
import type { LlmModel } from '@/lib/config/llm-models-types';

const { ensureImageUrlMock } = vi.hoisted(() => ({ ensureImageUrlMock: vi.fn() }));
vi.mock('@/lib/llm/video-output', () => ({
  ensureImageUrl: ensureImageUrlMock,
  normalizeVideoToS3Url: vi.fn(),
}));

const fetchMock = vi.fn();
const MODEL: LlmModel = {
  type: 'video', provider: 'luma-video',
  name: 'r', modelId: 'ray-2',
  baseUrl: 'https://api.lumalabs.ai', apiKey: 'luma-test',
};

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  fetchMock.mockReset();
  ensureImageUrlMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('lumaVideoProvider.createJob', () => {
  it('POSTs body with prompt, aspect_ratio, model and bearer auth', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({ id: 'gen-1', state: 'queued' }));
    const out = await lumaVideoProvider.createJob(
      { prompt: 'a cat', aspectRatio: '16:9' },
      MODEL,
    );
    expect(out.id).toBe('gen-1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.lumalabs.ai/dream-machine/v1/generations/video');
    const headers = new Headers((init as RequestInit).headers);
    expect(headers.get('Authorization')).toBe('Bearer luma-test');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toMatchObject({
      prompt: 'a cat',
      aspect_ratio: '16:9',
      model: 'ray-2',
    });
  });

  it('converts numeric duration to string with s suffix', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({ id: 'gen-2' }));
    await lumaVideoProvider.createJob({ prompt: 'x', duration: 9 }, MODEL);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.duration).toBe('9s');
  });

  it('includes keyframes.frame0 when image present', async () => {
    ensureImageUrlMock.mockResolvedValue('https://cdn/in.png');
    fetchMock.mockResolvedValueOnce(jsonRes({ id: 'gen-3' }));
    await lumaVideoProvider.createJob(
      { prompt: 'edit', image: 'https://in/a.png' },
      MODEL,
    );
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.keyframes).toEqual({
      frame0: { type: 'image', url: 'https://cdn/in.png' },
    });
  });

  it('falls back to 16:9 for unsupported aspect ratio', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({ id: 'gen-4' }));
    await lumaVideoProvider.createJob({ prompt: 'x', aspectRatio: 'weird' }, MODEL);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.aspect_ratio).toBe('16:9');
  });
});

describe('lumaVideoProvider.getJob', () => {
  it('maps state=dreaming to processing', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({ id: 'gen-5', state: 'dreaming' }));
    const job = await lumaVideoProvider.getJob('gen-5', MODEL);
    expect(job.status).toBe('processing');
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.lumalabs.ai/dream-machine/v1/generations/gen-5');
  });

  it('maps state=completed to succeeded with assets.video', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({
      id: 'gen-6', state: 'completed', assets: { video: 'https://luma/v.mp4' },
    }));
    const job = await lumaVideoProvider.getJob('gen-6', MODEL);
    expect(job.status).toBe('succeeded');
    expect(job.outputUrl).toBe('https://luma/v.mp4');
  });

  it('maps state=failed to failed with failure_reason', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({
      id: 'gen-7', state: 'failed', failure_reason: 'safety',
    }));
    const job = await lumaVideoProvider.getJob('gen-7', MODEL);
    expect(job.status).toBe('failed');
    expect(job.error).toMatch(/safety/);
  });
});
