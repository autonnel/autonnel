import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runwayVideoProvider } from '@/lib/llm/providers/video/runway-video';
import type { LlmModel } from '@/lib/config/llm-models-types';

const { ensureImageUrlMock } = vi.hoisted(() => ({ ensureImageUrlMock: vi.fn() }));
vi.mock('@/lib/llm/video-output', () => ({
  ensureImageUrl: ensureImageUrlMock,
  normalizeVideoToS3Url: vi.fn(),
}));

const fetchMock = vi.fn();
const MODEL: LlmModel = {
  type: 'video', provider: 'runway-video',
  name: 'r', modelId: 'gen3a_turbo',
  baseUrl: 'https://api.dev.runwayml.com', apiKey: 'rwk-test',
};

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  fetchMock.mockReset();
  ensureImageUrlMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('runwayVideoProvider.createJob', () => {
  it('POSTs to /v1/text_to_video when no image', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({ id: 'task-1' }));
    const out = await runwayVideoProvider.createJob(
      { prompt: 'a cat', aspectRatio: '16:9', duration: 5 },
      MODEL,
    );
    expect(out.id).toBe('task-1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.dev.runwayml.com/v1/text_to_video');
    const headers = new Headers((init as RequestInit).headers);
    expect(headers.get('Authorization')).toBe('Bearer rwk-test');
    expect(headers.get('X-Runway-Version')).toBe('2024-11-06');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({
      model: 'gen3a_turbo',
      promptText: 'a cat',
      ratio: '1280:720',
      duration: 5,
    });
  });

  it('POSTs to /v1/image_to_video when image present and includes promptImage', async () => {
    ensureImageUrlMock.mockResolvedValue('https://cdn/in.png');
    fetchMock.mockResolvedValueOnce(jsonRes({ id: 'task-2' }));
    await runwayVideoProvider.createJob(
      { prompt: 'go', image: 'https://in/a.png', aspectRatio: '9:16', duration: 10 },
      MODEL,
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.dev.runwayml.com/v1/image_to_video');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.promptImage).toBe('https://cdn/in.png');
    expect(body.promptText).toBe('go');
    expect(body.ratio).toBe('720:1280');
    expect(body.duration).toBe(10);
  });

  it('clamps non-5/10 duration to 5', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({ id: 'task-3' }));
    await runwayVideoProvider.createJob({ prompt: 'x', duration: 7 }, MODEL);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.duration).toBe(5);
  });

  it('overrides X-Runway-Version via options.runwayVersion', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({ id: 'task-4' }));
    await runwayVideoProvider.createJob(
      { prompt: 'x' },
      { ...MODEL, options: { runwayVersion: '2024-12-01' } },
    );
    const headers = new Headers((fetchMock.mock.calls[0][1] as RequestInit).headers);
    expect(headers.get('X-Runway-Version')).toBe('2024-12-01');
  });
});

describe('runwayVideoProvider.getJob', () => {
  it('maps RUNNING to processing', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({ id: 'task-5', status: 'RUNNING' }));
    const job = await runwayVideoProvider.getJob('task-5', MODEL);
    expect(job.status).toBe('processing');
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.dev.runwayml.com/v1/tasks/task-5');
  });

  it('maps SUCCEEDED to succeeded with output[0]', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({
      id: 'task-6', status: 'SUCCEEDED', output: ['https://runway/v1.mp4', 'https://runway/v2.mp4'],
    }));
    const job = await runwayVideoProvider.getJob('task-6', MODEL);
    expect(job.status).toBe('succeeded');
    expect(job.outputUrl).toBe('https://runway/v1.mp4');
  });

  it('maps FAILED to failed with failure message', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({
      id: 'task-7', status: 'FAILED', failure: 'safety',
    }));
    const job = await runwayVideoProvider.getJob('task-7', MODEL);
    expect(job.status).toBe('failed');
    expect(job.error).toMatch(/safety/);
  });
});
