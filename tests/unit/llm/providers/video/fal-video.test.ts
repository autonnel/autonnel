import { describe, it, expect, vi, beforeEach } from 'vitest';
import { falVideoProvider } from '@/lib/llm/providers/video/fal-video';
import type { LlmModel } from '@/lib/config/llm-models-types';

const fetchMock = vi.fn();
const MODEL: LlmModel = {
  type: 'video', provider: 'fal-video',
  name: 'r', modelId: 'fal-ai/kling-video/v1.5/pro',
  baseUrl: 'https://queue.fal.run', apiKey: 'fal-key',
};

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('falVideoProvider.createJob', () => {
  it('POSTs to /{modelId} with Key auth', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({
      request_id: 'req-1',
      status_url: 'https://queue.fal.run/fal-ai/kling-video/v1.5/pro/requests/req-1/status',
      response_url: 'https://queue.fal.run/fal-ai/kling-video/v1.5/pro/requests/req-1',
    }));
    const out = await falVideoProvider.createJob(
      { prompt: 'a cat', aspectRatio: '16:9', duration: 5 },
      MODEL,
    );
    expect(out.id.startsWith('req-1|')).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://queue.fal.run/fal-ai/kling-video/v1.5/pro');
    const headers = new Headers((init as RequestInit).headers);
    expect(headers.get('Authorization')).toBe('Key fal-key');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toMatchObject({ prompt: 'a cat', aspect_ratio: '16:9', duration: 5 });
  });

  it('forwards image_url when image given', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({
      request_id: 'req-2', status_url: 'x', response_url: 'y',
    }));
    await falVideoProvider.createJob(
      { prompt: 'edit', image: 'https://in/a.png' },
      MODEL,
    );
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.image_url).toBe('https://in/a.png');
  });
});

describe('falVideoProvider.getJob', () => {
  it('polls status_url; on COMPLETED fetches response_url, returns video.url', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonRes({
        request_id: 'req-3', status_url: 'https://queue.fal.run/x/requests/req-3/status',
        response_url: 'https://queue.fal.run/x/requests/req-3',
      }))
      .mockResolvedValueOnce(jsonRes({ status: 'COMPLETED' }))
      .mockResolvedValueOnce(jsonRes({ video: { url: 'https://fal.media/v.mp4' } }));

    const created = await falVideoProvider.createJob({ prompt: 'x' }, MODEL);
    const job = await falVideoProvider.getJob(created.id, MODEL);
    expect(job.status).toBe('succeeded');
    expect(job.outputUrl).toBe('https://fal.media/v.mp4');
  });

  it('extracts videos[0].url when video is array shape', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonRes({
        request_id: 'req-4', status_url: 'https://queue.fal.run/x/requests/req-4/status',
        response_url: 'https://queue.fal.run/x/requests/req-4',
      }))
      .mockResolvedValueOnce(jsonRes({ status: 'COMPLETED' }))
      .mockResolvedValueOnce(jsonRes({ videos: [{ url: 'https://fal.media/multi.mp4' }] }));
    const created = await falVideoProvider.createJob({ prompt: 'x' }, MODEL);
    const job = await falVideoProvider.getJob(created.id, MODEL);
    expect(job.outputUrl).toBe('https://fal.media/multi.mp4');
  });

  it('returns processing for IN_QUEUE / IN_PROGRESS', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonRes({
        request_id: 'req-5', status_url: 'https://queue.fal.run/x/requests/req-5/status',
        response_url: 'https://queue.fal.run/x/requests/req-5',
      }))
      .mockResolvedValueOnce(jsonRes({ status: 'IN_PROGRESS' }));
    const created = await falVideoProvider.createJob({ prompt: 'x' }, MODEL);
    const job = await falVideoProvider.getJob(created.id, MODEL);
    expect(job.status).toBe('processing');
  });

  it('returns failed when status is FAILED', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonRes({
        request_id: 'req-6', status_url: 'https://queue.fal.run/x/requests/req-6/status',
        response_url: 'https://queue.fal.run/x/requests/req-6',
      }))
      .mockResolvedValueOnce(jsonRes({ status: 'FAILED', error: 'safety' }));
    const created = await falVideoProvider.createJob({ prompt: 'x' }, MODEL);
    const job = await falVideoProvider.getJob(created.id, MODEL);
    expect(job.status).toBe('failed');
    expect(job.error).toMatch(/safety/);
  });
});
